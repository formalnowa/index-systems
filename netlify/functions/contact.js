/**
 * Netlify Function — POST /.netlify/functions/contact
 * Принимает заявку с сайта INDEX Systems и отправляет её в Telegram.
 *
 * Деплой на Netlify:
 * 1. Поместите этот файл в /netlify/functions/contact.js
 * 2. В настройках сайта Netlify → Site configuration → Environment variables добавьте:
 *    TELEGRAM_BOT_TOKEN  — токен бота (получить у @BotFather)
 *    TELEGRAM_CHAT_ID    — ID чата/канала куда слать заявки
 * 3. В netlify.toml добавьте редирект чтобы форма слала на /api/contact:
 *
 *    [[redirects]]
 *      from = "/api/contact"
 *      to   = "/.netlify/functions/contact"
 *      status = 200
 *
 * Локальная разработка:
 * Создайте файл .env в корне:
 *   TELEGRAM_BOT_TOKEN=your_token_here
 *   TELEGRAM_CHAT_ID=your_chat_id_here
 * Затем: npx netlify dev
 */

const TELEGRAM_API = 'https://api.telegram.org';

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 1000).replace(/[<>]/g, '');
}

function buildMessage({ name, phone, comment, source }) {
  const lines = [
    '📋 *Новая заявка с сайта INDEX Systems*',
    '',
    `*Имя:* ${name || '—'}`,
    `*Телефон:* ${phone || '—'}`,
    `*Комментарий:* ${comment || '—'}`,
    `*Источник:* ${source || '—'}`,
  ];
  return lines.join('\n');
}

exports.handler = async function (event) {
  // Разрешаем только POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Читаем переменные окружения (никогда не в HTML/JS на клиенте)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[contact] Missing env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  // Парсим тело
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const name    = sanitize(body?.name);
  const phone   = sanitize(body?.phone);
  const comment = sanitize(body?.comment);
  const source  = sanitize(body?.source);

  if (!name || !phone) {
    return { statusCode: 422, body: JSON.stringify({ error: 'Name and phone are required' }) };
  }

  // Отправляем в Telegram
  const telegramUrl = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`;
  const message     = buildMessage({ name, phone, comment, source });

  try {
    const tgRes  = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    CHAT_ID,
        text:       message,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error('[contact] Telegram API error:', tgData);
      return { statusCode: 502, body: JSON.stringify({ error: 'Failed to send notification' }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('[contact] Network error:', err);
    return { statusCode: 503, body: JSON.stringify({ error: 'Service unavailable' }) };
  }
};
