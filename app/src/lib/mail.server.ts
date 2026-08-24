/*
 * Отправка письма.
 *
 * Приложение живёт в workerd, а у него нет ни сокетов, ни файловой
 * системы: SMTP и nodemailer сюда не поставить в принципе. Остаётся HTTP
 * API почтового сервиса — тот же способ, которым уходят сообщения ботам
 * (см. notify.server.ts) и запросы в эквайринг.
 *
 * Сервис — Unisender Go. Выбран по трём причинам, и все три важнее
 * удобства: серверы и данные в России, что для 152-ФЗ существенно, ведь
 * в письме едет почта пользователя; простой ключ в заголовке вместо
 * подписи запроса, которую в воркере пришлось бы собирать руками; и
 * обычный JSON, без SDK, который всё равно не запустился бы.
 *
 * Заменить сервис — переписать deliver() ниже. Всё остальное про почту
 * не знает: оно спрашивает mailReady() и зовёт sendMail().
 */

import { bindings } from "./bindings.server";

type Mail = {
  to: string;
  subject: string;
  /** Только текст. HTML-письмо чаще уезжает в спам и ломается в клиентах,
   *  а сказать здесь нужно две фразы и одну ссылку. */
  text: string;
};

function config() {
  const { UNISENDER_GO_KEY, MAIL_FROM, MAIL_FROM_NAME } = bindings();
  const key = UNISENDER_GO_KEY?.trim();
  const from = MAIL_FROM?.trim();
  if (!key || !from) return null;
  return { key, from, fromName: MAIL_FROM_NAME?.trim() || "Совёнок" };
}

/**
 * Настроена ли почта на сервере.
 *
 * Экран восстановления спрашивает это до того, как принять заявку: без
 * ключа письмо не уйдёт, и предлагать человеку «проверьте почту» было бы
 * враньём. Без ключа он увидит ручной путь — адрес поддержки.
 */
export function mailReady(): boolean {
  return config() !== null;
}

/**
 * Отправка. Возвращает, ушло ли письмо.
 *
 * Ошибку наружу не бросаем: вызывающий код не должен из-за недоступного
 * почтового сервиса отвечать пятисотой. Он и так обязан отвечать
 * одинаково на существующий и несуществующий адрес — иначе форма
 * восстановления превращается в проверку, зарегистрирован ли человек.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const response = await fetch(
      "https://go1.unisender.ru/ru/transactional/api/v1/email/send.json",
      {
        method: "POST",
        headers: { "content-type": "application/json", "X-API-KEY": cfg.key },
        body: JSON.stringify({
          message: {
            recipients: [{ email: mail.to }],
            from_email: cfg.from,
            from_name: cfg.fromName,
            subject: mail.subject,
            body: { plaintext: mail.text },
            // Ссылки не подменяем на трекинговые: человек должен видеть в
            // письме тот же адрес, что откроется, — иначе письмо про
            // безопасность само выглядит как фишинг.
            track_links: 0,
            track_read: 0,
          },
        }),
      },
    );
    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as { status?: string } | null;
    return body?.status === "success";
  } catch {
    return false;
  }
}
