// ============================================================
// МОДУЛЬ: Маршруты авторизации
// ФАЙЛ: routes/auth.js
// МАРШРУТЫ:
//   POST /api/auth/register — регистрация нового пользователя
//   POST /api/auth/login    — вход в систему
//   GET  /api/auth/me       — получить данные текущего пользователя
// ============================================================

const express = require('express');
const bcrypt  = require('bcryptjs');           // Библиотека для хэширования паролей
const { db } = require('../db/database');
const { createToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ============================================================
// POST /api/auth/register — Регистрация
// ============================================================
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // --- Валидация входных данных ---
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Заполните все поля.' });
  }

  // Роль может быть только 'student' или 'teacher'
  const userRole = role === 'teacher' ? 'teacher' : 'student';

  // --- Проверяем, не занят ли email ---
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует.' });
  }

  // --- Хэшируем пароль ---
  // bcrypt.hash добавляет "соль" (случайные данные) к паролю
  // число 10 — "стоимость" хэширования (чем больше — тем надёжнее, но медленнее)
  const hashedPassword = await bcrypt.hash(password, 10);

  // --- Сохраняем пользователя в БД ---
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, email, hashedPassword, userRole);

  // Создаём объект пользователя для токена
  const newUser = { id: result.lastInsertRowid, name, email, role: userRole };
  const token   = createToken(newUser);

  res.status(201).json({
    message: 'Регистрация прошла успешно!',
    token,
    user: newUser
  });
});

// ============================================================
// POST /api/auth/login — Вход в систему
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль.' });
  }

  // --- Ищем пользователя по email ---
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль.' });
  }

  // --- Сравниваем введённый пароль с хэшом в БД ---
  // bcrypt.compare сам добавляет соль и сравнивает хэши
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Неверный email или пароль.' });
  }

  // --- Создаём токен и отвечаем ---
  const token = createToken(user);
  res.json({
    message: 'Вход выполнен успешно!',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// ============================================================
// GET /api/auth/me — Получить данные текущего пользователя
// Используется при загрузке страницы, чтобы узнать кто вошёл
// ============================================================
router.get('/me', requireAuth, (req, res) => {
  // req.user заполняется в middleware requireAuth
  res.json({ user: req.user });
});

module.exports = router;
