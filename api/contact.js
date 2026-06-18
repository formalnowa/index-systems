/**
 * Vercel Serverless Function — POST /api/contact
 * Принимает заявку с сайта INDEX Systems и отправляет её в Telegram.
 *
 * Деплой на Vercel:
 * 1. Поместите этот файл в /api/contact.js в корне проекта.
 * 2. В настройках проекта Vercel добавьте переменные окружения:
 *    TELEGRAM_BOT_TOKEN  — токен бота (получить у @BotFather)
 *    TELEGRAM_CHAT_ID    — ID чата/канала куда слать заявки
 *                          (получить через @userinfobot или API getUpdates)
 * 3. Деплой произойдёт автоматически при push в репозиторий.
 *
 * Локальная разработка:
 * Создайте файл .env.local в корне:
 *   TELEGRAM_BOT_TOKEN=your_token_here
 *   TELEGRAM_CHAT_ID=your_chat_id_here
 * Затем запустите: npx vercel dev
 */

const TELEGRAM_API = 'https://api.telegram.org';

// Простая санитизация входных данных
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 1000).replace(/[<>]/g, '');
}

// Формат сообщения в Telegram (Markdown V2 не используем — проще plain text)
function buildMessage({ name, phone, comment }) {
  const lines = [
    '📋 *Новая заявка с сайта INDEX Systems*',
    '',
    `*Имя:* ${name || '—'}`,
    `*Телефон:* ${phone || '—'}`,
    `*Комментарий:* ${comment || '—'}`,
  ];
  return lines.join('\n');
}

export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Читаем переменные окружения (никогда не в HTML/JS на клиенте)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[contact] Missing env vars: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Парсим тело запроса
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const name    = sanitize(body?.name);
  const phone   = sanitize(body?.phone);
  const comment = sanitize(body?.comment);

  // Минимальная валидация на сервере
  if (!name || !phone) {
    return res.status(422).json({ error: 'Name and phone are required' });
  }

  // Отправляем в Telegram
  const telegramUrl = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`;
  const message     = buildMessage({ name, phone, comment });

  try {
    const tgRes = await fetch(telegramUrl, {
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
      return res.status(502).json({ error: 'Failed to send notification' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[contact] Network error:', err);
    return res.status(503).json({ error: 'Service unavailable' });
  }
}
