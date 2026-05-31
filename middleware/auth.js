// ============================================================
// МОДУЛЬ: Middleware для авторизации (проверка JWT-токена)
// ТЕХНОЛОГИЯ: JSON Web Token (JWT)
// ЗАЧЕМ: Проверяет, что пользователь вошёл в систему,
//         прежде чем разрешить доступ к защищённым маршрутам.
//
// КАК РАБОТАЕТ JWT:
//   1. Пользователь входит → сервер создаёт токен (строку)
//   2. Токен хранится в браузере (localStorage)
//   3. При каждом запросе токен отправляется в заголовке
//   4. Этот middleware проверяет токен и извлекает данные
// ============================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'diploma_secret_key_2026';


function requireAuth(req, res, next) {
  // "Bearer <токен>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен. Войдите в систему.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Токен недействителен или истёк.' });
    }

    req.user = user; // { id, name, email, role }
    next(); 
  });
}

// ============================================================
// MIDDLEWARE: Только для преподавателей
// ============================================================
function requireTeacher(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Доступ только для преподавателей.' });
    }
    next();
  });
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Создание JWT-токена
// ============================================================
function createToken(user) {
  // Вкладываем в токен основную информацию о пользователе
  const payload = {
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role
  };
  // token live_time = 7d
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { requireAuth, requireTeacher, createToken };
