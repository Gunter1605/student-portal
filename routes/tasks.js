// ============================================================
// МОДУЛЬ: Маршруты для работы с заданиями
// ФАЙЛ: routes/tasks.js
// МАРШРУТЫ:
//   GET    /api/tasks        — список всех заданий
//   POST   /api/tasks        — создать задание (только преподаватель)
//   GET    /api/tasks/:id    — одно задание по ID
//   DELETE /api/tasks/:id    — удалить задание (только преподаватель)
// ============================================================

const express  = require('express');
const { db }   = require('../db/database');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// GET /api/tasks — Получить все задания
// Студент видит все задания + статус своей сдачи
// ============================================================
router.get('/', requireAuth, (req, res) => {
  let tasks;

  if (req.user.role === 'student') {
    // Для студента: задания + информация, сдал ли он каждое
    // LEFT JOIN — берём все задания, и если есть сдача от студента — прикрепляем её
    tasks = db.prepare(`
      SELECT 
        t.*,
        u.name          AS teacher_name,
        s.status        AS submission_status,
        s.score         AS my_score
      FROM tasks t
      JOIN users u ON u.id = t.teacher_id
      LEFT JOIN submissions s ON s.task_id = t.id AND s.student_id = ?
      ORDER BY t.deadline ASC
    `).all(req.user.id);

  } else {
    // Для преподавателя: задания + количество сдавших
    tasks = db.prepare(`
      SELECT 
        t.*,
        COUNT(s.id) AS submissions_count
      FROM tasks t
      LEFT JOIN submissions s ON s.task_id = t.id
      WHERE t.teacher_id = ?
      GROUP BY t.id
      ORDER BY t.deadline ASC
    `).all(req.user.id);
  }

  res.json({ tasks });
});

// ============================================================
// POST /api/tasks — Создать новое задание
// Только преподаватель может создавать задания
// ============================================================
router.post('/', requireTeacher, (req, res) => {
  const { title, description, subject, deadline, max_score } = req.body;

  // Проверка обязательных полей
  if (!title || !description || !subject || !deadline) {
    return res.status(400).json({ error: 'Заполните все поля задания.' });
  }

  const stmt = db.prepare(`
    INSERT INTO tasks (title, description, subject, deadline, max_score, teacher_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    title,
    description,
    subject,
    deadline,
    max_score || 100,   // если балл не указан — по умолчанию 100
    req.user.id         // ID преподавателя из токена
  );

  // Возвращаем созданное задание
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Задание создано!', task });
});

// ============================================================
// GET /api/tasks/:id — Получить одно задание по ID
// ============================================================
router.get('/:id', requireAuth, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name AS teacher_name
    FROM tasks t
    JOIN users u ON u.id = t.teacher_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!task) {
    return res.status(404).json({ error: 'Задание не найдено.' });
  }

  res.json({ task });
});

// ============================================================
// DELETE /api/tasks/:id — Удалить задание
// Только преподаватель, создавший задание
// ============================================================
router.delete('/:id', requireTeacher, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?')
                 .get(req.params.id, req.user.id);

  if (!task) {
    return res.status(404).json({ error: 'Задание не найдено или нет доступа.' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Задание удалено.' });
});

module.exports = router;
