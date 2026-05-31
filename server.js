// ============================================================
// ГЛАВНЫЙ ФАЙЛ СЕРВЕРА
// ФАЙЛ: server.js
// ТЕХНОЛОГИЯ: Node.js + Express
//
// ЭТОТ ФАЙЛ — ТОЧКА ВХОДА В ПРИЛОЖЕНИЕ
// Он собирает все части проекта вместе:
//   - Настраивает Express (веб-фреймворк)
//   - Подключает middleware (промежуточные обработчики)
//   - Регистрирует маршруты (API-эндпоинты)
//   - Запускает сервер на указанном порту
// ============================================================

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Импортируем функцию инициализации БД
const { initDB } = require('./db/database');

// Импортируем все маршруты
const authRoutes        = require('./routes/auth');
const tasksRoutes       = require('./routes/tasks');
const submissionsRoutes = require('./routes/submissions');
const aiRoutes          = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================
// РЕГИСТРАЦИЯ МАРШРУТОВ
// ============================================================
app.use('/api/auth',        authRoutes);
app.use('/api/tasks',       tasksRoutes);
app.use('/api/submissions', submissionsRoutes);
app.use('/api/ai',          aiRoutes);

// ============================================================
// ОБРАБОТКА ОШИБОК
// ============================================================
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Файл слишком большой. Максимум 10 МБ.' });
  }
  res.status(500).json({ error: err.message || 'Внутренняя ошибка сервера.' });
});

// ============================================================
// ЗАПУСК: сначала инициализируем БД, потом запускаем сервер
// ============================================================
initDB().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀 Сервер запущен!');
    console.log(`📡 Адрес: http://localhost:${PORT}`);
    console.log(`📂 API:   http://localhost:${PORT}/api`);
    console.log('');
  });
}).catch(err => {
  console.error('❌ Ошибка запуска:', err);
});
