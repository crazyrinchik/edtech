// D1-совместимый доступ к PostgreSQL через внутренний шлюз.
//
// Приложение исполняется в workerd, а там нет ни TCP-сокетов, ни половины
// node-модулей: проверено на стенде — `pg` требует node:fs, `postgres.js`
// требует node:os, и оба падают ещё на загрузке бандла. Поэтому воркер ходит
// в базу обычным fetch(), а SQL исполняет соседний контейнер db-gateway
// (по смыслу это то же, что Hyperdrive у Cloudflare).
//
// Наружу отдаётся ровно тот же интерфейс, что у D1: prepare().bind().first()/
// .all()/.run() и batch(). Благодаря этому ни один из ~50 вызовов в
// app.functions.ts не меняется, а деплой в Cloudflare продолжает работать
// на настоящем D1 — см. db() в core.server.ts.

type Row = Record<string, unknown>;

type GatewayStatement = { sql: string; params: unknown[] };
type GatewayResult = { rows: Row[]; rowCount: number };

export type PreparedStatement = {
  bind(...params: unknown[]): PreparedStatement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }>;
  run(): Promise<{ success: boolean; meta: Record<string, unknown> }>;
  /** Во что statement превращается на шлюзе. Нужно для batch(). */
  toStatement(): GatewayStatement;
};

/**
 * `?` → `$1, $2, …`: D1 использует позиционные плейсхолдеры SQLite,
 * PostgreSQL — нумерованные. Кавычки пропускаются, чтобы вопросительный знак
 * внутри строкового литерала не был принят за плейсхолдер; удвоенная кавычка
 * ('' и "") внутри литерала его не закрывает.
 */
export function toNumberedPlaceholders(sql: string): string {
  let out = "";
  let index = 0;
  let quote: string | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];

    if (quote) {
      out += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) {
          out += sql[i + 1];
          i += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }

    if (ch === "?") {
      index += 1;
      out += `$${index}`;
      continue;
    }

    out += ch;
  }

  return out;
}

async function callGateway(
  endpoint: string,
  token: string,
  statements: GatewayStatement[],
  transaction: boolean,
): Promise<GatewayResult[]> {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/sql`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gateway-token": token },
    body: JSON.stringify({ statements, transaction }),
  });

  if (!response.ok) {
    // Текст ошибки от шлюза содержит сообщение PostgreSQL — без него
    // отладка запроса превращается в гадание.
    const detail = await response.text().catch(() => "");
    throw new Error(`db-gateway ответил ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = (await response.json()) as { results: GatewayResult[] };
  return payload.results;
}

function createStatement(
  endpoint: string,
  token: string,
  sql: string,
  params: unknown[],
): PreparedStatement {
  const statement: GatewayStatement = { sql: toNumberedPlaceholders(sql), params };

  const single = async (): Promise<GatewayResult> => {
    const [result] = await callGateway(endpoint, token, [statement], false);
    return result ?? { rows: [], rowCount: 0 };
  };

  return {
    bind(...next: unknown[]) {
      return createStatement(endpoint, token, sql, next);
    },
    async first<T = Row>() {
      const { rows } = await single();
      // D1 отдаёт именно null, а не undefined — код проверяет `if (!row)`,
      // но на null завязаны возвращаемые типы серверных функций.
      return (rows[0] ?? null) as T | null;
    },
    async all<T = Row>() {
      const { rows } = await single();
      return { results: rows as T[], success: true, meta: {} };
    },
    async run() {
      const { rowCount } = await single();
      return { success: true, meta: { changes: rowCount } };
    },
    toStatement() {
      return statement;
    },
  };
}

/**
 * D1-подобный объект поверх шлюза. `batch()` выполняется одной транзакцией —
 * это ближе к семантике D1, где batch атомарен, чем последовательные запросы.
 */
export function createPgGateway(endpoint: string, token: string) {
  return {
    prepare(sql: string): PreparedStatement {
      return createStatement(endpoint, token, sql, []);
    },
    async batch<T = Row>(statements: PreparedStatement[]) {
      const results = await callGateway(
        endpoint,
        token,
        statements.map((s) => s.toStatement()),
        true,
      );
      return results.map((r) => ({
        results: r.rows as T[],
        success: true,
        meta: { changes: r.rowCount },
      }));
    },
  };
}
