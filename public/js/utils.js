// ============================================================
// УТИЛИТЫ: Вспомогательные функции для всего фронтенда
// Файл подключается на каждой странице
// ============================================================

// ============================================================
// API-запросы: обёртки над fetch()
// Автоматически добавляют заголовок авторизации (JWT-токен)
// ============================================================

// GET-запрос (получить данные)
async function apiGet(url) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}` // прикрепляем токен к каждому запросу
    }
  });
  return res.json();
}

// POST-запрос (отправить данные)
async function apiPost(url, body) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body) // конвертируем объект в строку JSON
  });
  return res.json();
}

// PATCH-запрос (частичное обновление)
async function apiPatch(url, body) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

// DELETE-запрос (удаление)
async function apiDelete(url) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}

// Загрузка файла (multipart/form-data — нельзя использовать JSON)
async function apiUpload(url, formData) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Content-Type НЕ ставим — браузер сам добавит boundary для multipart
    },
    body: formData
  });
  return res.json();
}

// ============================================================
// УВЕДОМЛЕНИЯ (toast)
// ============================================================
function showToast(message, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `show ${type}`;
  setTimeout(() => { toast.className = ''; }, 3500);
}

// ============================================================
// АВТОРИЗАЦИЯ: Получить текущего пользователя из localStorage
// ============================================================
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Выход из системы
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Защита страниц: перенаправить на логин если не авторизован
function requireLogin() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/';
    return null;
  }
  return getCurrentUser();
}

// ============================================================
// ФОРМАТИРОВАНИЕ ДАТ
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Получить день и сокращённый месяц для календаря дедлайнов
function formatDeadline(dateStr) {
  const date = new Date(dateStr);
  const day   = date.getDate();
  const month = date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
  return { day, month };
}

// Проверка: просрочено ли задание
function isOverdue(deadlineStr) {
  return new Date(deadlineStr) < new Date();
}

// ============================================================
// ГЕНЕРАЦИЯ HTML: Бейдж статуса сдачи
// ============================================================
function statusBadge(status) {
  const labels = {
    pending: ['pending',  '🕐 Не проверено'],
    checked: ['checked',  '🤖 Проверено ИИ'],
    graded:  ['graded',   '✅ Оценено'],
    null:    ['overdue',  '📤 Не сдано']
  };
  const [cls, text] = labels[status] || labels[null];
  return `<span class="badge badge-${cls}">${text}</span>`;
}
