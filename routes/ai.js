// ============================================================
// МОДУЛЬ: ИИ-ассистент для проверки работ студентов
// ТЕХНОЛОГИЯ: OpenRouter API (бесплатно)
//
// КАК ПОЛУЧИТЬ КЛЮЧ:
//   1. openrouter.ai → Sign In → Keys → Create Key
//   2. Вставь в .env: OPENROUTER_API_KEY=sk-or-...
//   Карта не нужна. Бесплатно 200 запросов/день.
// ============================================================

const express = require('express');
const OpenAI  = require('openai');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// СПИСОК МОДЕЛЕЙ: пробуем по очереди пока одна не сработает
// openrouter/free — официальный роутер, сам выбирает модель
// Остальные — резерв на случай если роутер недоступен
// Актуальный список: https://openrouter.ai/models?q=free
// ============================================================
const FREE_MODELS = [
  'openrouter/free',                        // авто-роутер (рекомендуется)
  'meta-llama/llama-3.3-70b-instruct:free', // Llama 3.3 70B
  'deepseek/deepseek-chat-v3-0324:free',    // DeepSeek v3
  'meta-llama/llama-4-maverick:free',       // Llama 4 Maverick
  'qwen/qwen3-235b-a22b:free',              // Qwen 3
];

function getClient() {
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey:  process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title':      'Student Portal Diploma'
    }
  });
}

// ============================================================
// Отправить запрос с автоматической сменой модели при ошибке
// ============================================================
async function callAI(prompt) {
  const client = getClient();

  for (const model of FREE_MODELS) {
    try {
      console.log(`🤖 Пробуем модель: ${model}`);
      const response = await client.chat.completions.create({
        model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      });
      // Возвращаем и текст ответа, и реальное имя модели которая ответила
      const usedModel = response.model || model;
      console.log(`✅ Ответ получен от: ${usedModel}`);
      return { text: response.choices[0].message.content, model: usedModel };
    } catch (err) {
      console.warn(`⚠️ Модель ${model} недоступна: ${err.message}`);
      if (!err.message.includes('404') && !err.message.includes('No endpoints')) {
        throw err;
      }
    }
  }

  throw new Error('Все бесплатные модели недоступны. Проверьте OPENROUTER_API_KEY в .env');
}

// ============================================================
// Проверить работу студента через ИИ
// Экспортируется и вызывается из routes/submissions.js
// ============================================================
async function checkWithAI(task, studentAnswer) {
  const prompt = `Ты — помощник преподавателя в колледже. Проверь ответ студента и дай обратную связь.

ЗАДАНИЕ:
Предмет: ${task.subject}
Название: ${task.title}
Условие: ${task.description}
Максимальный балл: ${task.max_score}

ОТВЕТ СТУДЕНТА:
${studentAnswer}

Дай обратную связь строго в таком формате:

✅ ЧТО СДЕЛАНО ПРАВИЛЬНО:
[сильные стороны ответа]

❌ ЧТО НУЖНО ИСПРАВИТЬ:
[конкретные ошибки или недостатки]

💡 ПОДСКАЗКИ:
[советы по улучшению, но НЕ готовое решение]

📊 ПРЕДВАРИТЕЛЬНАЯ ОЦЕНКА: [число] из ${task.max_score}

Пиши на русском языке. Будь конкретным и доброжелательным.`;

  const result = await callAI(prompt);
  return result.text; // submissions.js ожидает строку
}

// ============================================================
// POST /api/ai/check — Вопрос студента к ИИ-ассистенту
// ============================================================
router.post('/check', requireAuth, async (req, res) => {
  const { question, subject } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Введите вопрос.' });
  }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'your_openrouter_api_key_here') {
    return res.status(503).json({
      error: 'ИИ не настроен. Добавьте OPENROUTER_API_KEY в файл .env (получить бесплатно на openrouter.ai)'
    });
  }

  try {
    const prompt = `Ты — учебный ИИ-ассистент для студентов колледжа.
Предмет: ${subject || 'общий'}
Вопрос студента: ${question}
Дай понятный ответ с примерами на русском языке.`;

    const result = await callAI(prompt);
    res.json({ answer: result.text, model: result.model });

  } catch (err) {
    console.error('Ошибка ИИ:', err.message);
    res.status(500).json({ error: 'ИИ-ассистент недоступен: ' + err.message });
  }
});

module.exports = router;
module.exports.checkWithAI = checkWithAI;
