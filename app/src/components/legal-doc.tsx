import { Fragment, type ReactNode } from "react";

/**
 * Печать юридического документа из его исходника в `docs/legal`.
 *
 * Исходник один, копии нет. Оферта — единственный текст в проекте, который
 * при споре читают дословно, и вторая его версия в JSX рано или поздно
 * разошлась бы с той, что правил юрист. Поэтому markdown-файл импортируется
 * как есть (`?raw`) и разбирается здесь.
 *
 * Разметка поддерживается ровно та, что встречается в этих документах:
 * заголовки, абзацы, списки, отступ-формула, `код` и **жирный** внутри
 * строки. Полноценный markdown-движок сюда не тянется — он весит больше
 * самих документов и умеет то, чего в них нет.
 */

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "pre"; text: string }
  | { kind: "hr" };

export function LegalDoc({ source }: { source: string }) {
  return (
    <>
      {parse(source).map((block, index) => (
        <Fragment key={index}>{render(block)}</Fragment>
      ))}
    </>
  );
}

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let pre: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
    if (list.length) blocks.push({ kind: "ul", items: list });
    if (pre.length) blocks.push({ kind: "pre", text: pre.join("\n") });
    paragraph = [];
    list = [];
    pre = [];
  };

  for (const line of lines) {
    // Указания самим себе («Черновик. Перед публикацией…») набраны цитатой и
    // на страницу не идут: это записка автору, а не условие договора.
    if (line.startsWith(">")) continue;

    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("    ")) {
      if (paragraph.length || list.length) flush();
      pre.push(line.slice(4));
      continue;
    }
    if (pre.length) flush();

    if (line.startsWith("- ")) {
      if (paragraph.length) flush();
      list.push(line.slice(2));
      continue;
    }
    // Продолжение пункта списка. Длинные пункты в исходнике переносятся с
    // отступом в два пробела, и без этой ветки хвост уезжал отдельным
    // абзацем: в реквизитах оферты адрес разрывался посреди улицы.
    if (list.length && line.startsWith("  ")) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list.length) flush();

    if (line.startsWith("### ")) {
      flush();
      blocks.push({ kind: "h3", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", text: line.slice(2) });
    } else if (line.trim() === "---") {
      flush();
      blocks.push({ kind: "hr" });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function render(block: Block): ReactNode {
  switch (block.kind) {
    case "h1":
      return <h1>{inline(block.text)}</h1>;
    case "h2":
      return <h2>{inline(block.text)}</h2>;
    case "h3":
      return <h3>{inline(block.text)}</h3>;
    case "ul":
      return (
        <ul>
          {block.items.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "pre":
      return <pre>{block.text}</pre>;
    case "hr":
      return <hr />;
    default:
      return <p>{inline(block.text)}</p>;
  }
}

/** **Жирный** и `код` внутри строки — больше в этих документах ничего нет. */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="sov-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
