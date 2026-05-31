// ============================================================
// МОДУЛЬ: Маршруты для сдачи и проверки работ
// ФАЙЛ: routes/submissions.js
// ============================================================

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { db }  = require('../db/database');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { checkWithAI } = require('./ai');

const router = express.Router();

// ============================================================
// СОЗДАЁМ ПАПКУ uploads АВТОМАТИЧЕСКИ (если не существует)
// Это исправляет ошибку ENOENT: no such file or directory
// ============================================================
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('📁 Папка uploads создана:', UPLOADS_DIR);
}

// ============================================================
// НАСТРОЙКА MULTER — обработка загружаемых файлов
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  // Уникальное имя: timestamp + оригинальное имя без пробелов
  filename: (req, file, cb) => {
    // Убираем пробелы из имени файла (они могут вызывать проблемы)
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

// Разрешённые расширения файлов
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.py', '.js', '.zip', '.rar', '.png', '.jpg', '.jpeg'];

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 МБ

  fileFilter: (req, file, cb) => {
    // Получаем расширение из оригинального имени файла
    const ext = path.extname(file.originalname).toLowerCase().trim();

    // Логируем для отладки
    console.log(`📎 Загрузка файла: "${file.originalname}", расширение: "${ext}"`);

    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true); // разрешить
    } else {
      // Передаём ошибку — она поймается в обработчике маршрута
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Недопустимый тип: ${ext}. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

// ============================================================
// POST /api/submissions — Сдать решение
// Параметр skip_ai=true — отправить без ИИ-проверки
// ============================================================
router.post('/', requireAuth, (req, res) => {

  // Используем upload.single внутри маршрута чтобы перехватить ошибки Multer
  upload.single('file')(req, res, async (err) => {

    // --- Обработка ошибок Multer (тип файла, размер) ---
    if (err) {
      console.error('Ошибка загрузки файла:', err.message);
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла.' });
    }

    const { task_id, answer_text, skip_ai } = req.body;

    if (!task_id) {
      return res.status(400).json({ error: 'Не указано ID задания.' });
    }

    if (!answer_text && !req.file) {
      return res.status(400).json({ error: 'Загрузите файл или введите текстовый ответ.' });
    }

    // Проверяем существование задания
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id);
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    // Студент уже сдавал это задание?
    const existing = db.prepare(
      'SELECT id FROM submissions WHERE task_id = ? AND student_id = ?'
    ).get(task_id, req.user.id);

    if (existing) {
      return res.status(409).json({ error: 'Вы уже сдали это задание.' });
    }

    // --------------------------------------------------------
    // ИИ-ПРОВЕРКА (опционально)
    // skip_ai === 'true'  → пропустить, сохранить без проверки
    // skip_ai === 'false' → запросить ИИ-проверку
    // --------------------------------------------------------
    let ai_feedback = null;
    let status = 'pending'; // без ИИ — статус "ожидает проверки преподавателем"

    const shouldCallAI = skip_ai !== 'true' && skip_ai !== true;

    if (shouldCallAI) {
      // Проверяем настроен ли API-ключ
      if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here') {
        ai_feedback = '⚠️ ИИ-проверка недоступна: API-ключ не настроен. Работа будет проверена преподавателем.';
        status = 'pending';
      } else {
        try {
          console.log('🤖 Запускаем ИИ-проверку...');
          const textForAI = answer_text || `[Студент загрузил файл: ${req.file?.originalname}]`;
          ai_feedback = await checkWithAI(task, textForAI);
          status = 'checked';
          console.log('✅ ИИ-проверка завершена');
        } catch (aiErr) {
          console.error('Ошибка ИИ:', aiErr.message);
          ai_feedback = `⚠️ ИИ-проверка временно недоступна (${aiErr.message}). Работа будет проверена преподавателем.`;
          status = 'pending';
        }
      }
    }

    // Сохраняем ответ в БД
    const stmt = db.prepare(`
      INSERT INTO submissions (task_id, student_id, answer_text, file_path, ai_feedback, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      task_id,
      req.user.id,
      answer_text || null,
      req.file ? req.file.filename : null,
      ai_feedback,
      status
    );

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?')
                         .get(result.lastInsertRowid);

    const message = shouldCallAI && ai_feedback && !ai_feedback.startsWith('⚠️')
      ? 'Решение принято и проверено ИИ!'
      : 'Решение принято! Преподаватель проверит вручную.';

    res.status(201).json({ message, submission });
  });
});

// ============================================================
// GET /api/submissions/my — Мои сданные работы (студент)
// ============================================================
router.get('/my', requireAuth, (req, res) => {
  const submissions = db.prepare(`
    SELECT
      s.*,
      t.title     AS task_title,
      t.subject   AS task_subject,
      t.deadline  AS task_deadline,
      t.max_score AS task_max_score
    FROM submissions s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.student_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.user.id);

  res.json({ submissions });
});

// ============================================================
// GET /api/submissions/task/:taskId — Ответы по заданию (преподаватель)
// ============================================================
router.get('/task/:taskId', requireTeacher, (req, res) => {
  const submissions = db.prepare(`
    SELECT
      s.*,
      u.name  AS student_name,
      u.email AS student_email
    FROM submissions s
    JOIN users u ON u.id = s.student_id
    WHERE s.task_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.params.taskId);

  res.json({ submissions });
});

// ============================================================
// PATCH /api/submissions/:id/grade — Выставить оценку (преподаватель)
// ============================================================
router.patch('/:id/grade', requireTeacher, (req, res) => {
  const { score } = req.body;

  if (score === undefined || score < 0 || score > 100) {
    return res.status(400).json({ error: 'Оценка должна быть от 0 до 100.' });
  }

  db.prepare("UPDATE submissions SET score = ?, status = 'graded' WHERE id = ?")
    .run(score, req.params.id);

  res.json({ message: 'Оценка выставлена!' });
});

module.exports = router;

// ============================================================
// DELETE /api/submissions/:id — Отозвать свою работу (студент)
// Позволяет студенту удалить сданную работу и сдать заново
// ============================================================
router.delete('/:id', requireAuth, (req, res) => {
  // Находим работу и проверяем что она принадлежит этому студенту
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);

  if (!sub) {
    return res.status(404).json({ error: 'Работа не найдена.' });
  }

  // Студент может удалить только свою работу, преподаватель — любую
  if (req.user.role === 'student' && sub.student_id !== req.user.id) {
    return res.status(403).json({ error: 'Нет доступа.' });
  }

  // Нельзя отозвать уже оценённую работу
  if (sub.status === 'graded') {
    return res.status(400).json({ error: 'Нельзя отозвать работу с выставленной оценкой.' });
  }

  db.prepare('DELETE FROM submissions WHERE id = ?').run(req.params.id);
  res.json({ message: 'Работа отозвана. Теперь можно сдать заново.' });
});
