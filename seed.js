// ============================================================
// СКРИПТ: Полный сброс и наполнение БД тестовыми данными
// ЗАПУСК: node seed.js
// Используй каждый раз когда хочешь начать с чистого листа
// ============================================================

const { initDB, db } = require('./db/database');
const bcrypt = require('bcryptjs');

async function seed() {
  await initDB();
  console.log('🧹 Очищаем все таблицы...');

  // Удаляем все данные и сбрасываем счётчики AUTOINCREMENT
  db.prepare('DELETE FROM submissions').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM users').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users','tasks','submissions')").run();

  console.log('🌱 Создаём тестовые данные...\n');

  const hash = await bcrypt.hash('123456', 10);

  // Студенты (id: 1, 2)
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run('Алибек Сейткали',  'alibek@test.com',  hash, 'student');
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run('Айгерим Касымова', 'aigerim@test.com', hash, 'student');
  // Преподаватель (id: 3)
  db.prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)').run('Проф. Ахметов Д.С.', 'teacher@test.com', hash, 'teacher');

  // Задания (teacher_id = 3)
  db.prepare('INSERT INTO tasks (title,description,subject,deadline,max_score,teacher_id) VALUES (?,?,?,?,?,?)').run(
    'Контрольная по алгоритмам',
    'Реализуйте функцию bubbleSort(arr) на JavaScript. Покажите пример работы с массивом [5,3,1,4,2].',
    'Информатика', '2026-05-01', 100, 3
  );
  db.prepare('INSERT INTO tasks (title,description,subject,deadline,max_score,teacher_id) VALUES (?,?,?,?,?,?)').run(
    'Эссе по истории',
    'Напишите эссе (300-500 слов) на тему: Влияние индустриализации на общество XIX века.',
    'История', '2026-04-25', 80, 3
  );
  db.prepare('INSERT INTO tasks (title,description,subject,deadline,max_score,teacher_id) VALUES (?,?,?,?,?,?)').run(
    'Задача по математике',
    'Решите систему уравнений: 2x + y = 7, x - y = 2. Покажите полное пошаговое решение.',
    'Математика', '2026-04-20', 60, 3
  );

  console.log('✅ Пользователи:');
  db.prepare('SELECT id,name,email,role FROM users').all()
    .forEach(u => console.log(`   [id=${u.id}][${u.role}] ${u.name} — ${u.email}`));

  console.log('\n✅ Задания:');
  db.prepare('SELECT id,title,subject,deadline FROM tasks').all()
    .forEach(t => console.log(`   [id=${t.id}][${t.subject}] ${t.title} (до ${t.deadline})`));

  console.log('\n🎉 Готово! Все сдачи очищены. Пароль для всех: 123456');
}

seed().catch(console.error);
