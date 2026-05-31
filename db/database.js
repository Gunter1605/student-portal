
const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_PATH = path.join(__dirname, '../portal.db');

let _db = null;

function _save() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ============================================================
// ОБЁРТКА: эмулирует синхронный API better-sqlite3
// ============================================================
const db = {
  pragma() {},

  exec(sql) {
    // Выполняем несколько SQL-запросов сразу (CREATE TABLE и т.д.)
    _db.exec(sql);
    _save();
  },

  prepare(sql) {
    return {
      get(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },

      // SELECT → все строки
      all(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = _db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },

      // INSERT / UPDATE / DELETE — используем stmt.run() а не _db.run()
      run(...args) {
        const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
        const stmt = _db.prepare(sql);
        stmt.run(params);
        stmt.free();

        const idRow  = _db.exec('SELECT last_insert_rowid()');
        const lastId = idRow[0] ? idRow[0].values[0][0] : null;
        const changes = _db.getRowsModified();

        _save();
        return { lastInsertRowid: lastId, changes };
      }
    };
  }
};

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL UNIQUE,
      password   TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL,
      subject     TEXT    NOT NULL,
      deadline    TEXT    NOT NULL,
      max_score   INTEGER NOT NULL DEFAULT 100,
      teacher_id  INTEGER NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id      INTEGER NOT NULL,
      student_id   INTEGER NOT NULL,
      answer_text  TEXT,
      file_path    TEXT,
      ai_feedback  TEXT,
      score        INTEGER,
      status       TEXT    DEFAULT 'pending',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  _save();
  console.log('✅ База данных готова:', DB_PATH);
}

module.exports = { db, initDB };
