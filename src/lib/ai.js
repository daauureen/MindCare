// AI-собеседник: системный промпт, кризис-детектор, вызов API

export const CRISIS_WORDS = ["не хочу жить", "покончить", "суицид", "убить себя", "самоубий", "порезать себя", "вскрыть вены",
  "смысла жить", "исчезнуть навсегда", "меня бьют", "меня насилу", "хочу умереть", "не вижу выхода"];
export const isCrisis = (t) => { const s = t.toLowerCase(); return CRISIS_WORDS.some((w) => s.includes(w)); };

export const AI_SYSTEM = `Ты — поддерживающий собеседник в приложении MINDCARE для студентов. Отвечай по-русски, тепло, коротко (3–6 предложений), простым языком.
МОЖНО: выслушать, помочь назвать чувство, предложить простое дыхательное или заземляющее упражнение, предложить пройти тест в приложении, порекомендовать обратиться к психологу.
НЕЛЬЗЯ: ставить диагнозы, называть расстройства, советовать лекарства, обещать конфиденциальность, заменять специалиста.
Не используй списки и заголовки — пиши обычным текстом. Не начинай ответ со слов "Я понимаю".`;

const KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

/**
 * Запрос к Anthropic API.
 * ВНИМАНИЕ: прямой вызов из браузера годится только для локальной разработки —
 * ключ виден любому, кто откроет DevTools. В продакшене вызов идёт через ваш бэкенд.
 */
export async function askAI(history, catalog) {
  if (!KEY) return 'Чат не подключён: добавьте VITE_ANTHROPIC_API_KEY в файл .env и перезапустите dev-сервер.';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: AI_SYSTEM + `\nДоступные тесты в приложении: ${catalog || 'пока нет'}.`,
        messages: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    const text = (data.content || []).map((c) => (c.type === 'text' ? c.text : '')).filter(Boolean).join('\n').trim();
    return text || 'Не получилось ответить. Попробуйте ещё раз.';
  } catch {
    return 'Связь пропала. Попробуйте отправить сообщение ещё раз.';
  }
}
