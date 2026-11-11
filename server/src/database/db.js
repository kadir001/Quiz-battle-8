
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const databasePath = path.join(__dirname, "../../data/quiz.sqlite");
const questionsPath = path.join(__dirname, "../questions.json");

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: () =>
      require.resolve("sql.js/dist/sql-wasm.wasm"),
  });

  let db;

  if (fs.existsSync(databasePath)) {
    const file = fs.readFileSync(databasePath);
    db = new SQL.Database(new Uint8Array(file));
    console.log("Bestaande database geladen.");
  } else {
    db = new SQL.Database();
    console.log("Nieuwe database aangemaakt.");
  }

  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5),
      question TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      correct_answer INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      host_player_id INTEGER,
      status TEXT DEFAULT 'waiting',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      status TEXT DEFAULT 'active',
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS player_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES game_sessions(id),
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS player_achievements (
      player_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, achievement_id),
      FOREIGN KEY (player_id) REFERENCES players(id),
      FOREIGN KEY (achievement_id) REFERENCES achievements(id)
    );
  `);

  fs.mkdirSync(path.dirname(databasePath), {
    recursive: true
  });

  // Nieuwe vragen uit JSON aanvullend importeren. De vraagtekst voorkomt
  // dat dezelfde vraag bij iedere serverstart opnieuw wordt toegevoegd.
  const questions = JSON.parse(
    fs.readFileSync(questionsPath, "utf8")
  );
  const insertQuestion = db.prepare(`
    INSERT INTO questions (
      category,
      level,
      question,
      answers_json,
      correct_answer,
      explanation
    )
    SELECT ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM questions
      WHERE category = ? AND level = ? AND question = ?
    )
  `);

  let importedCount = 0;

  try {
    for (const question of questions) {
      insertQuestion.run([
        question.category,
        question.difficulty,
        question.question,
        JSON.stringify(question.answers),
        question.correctAnswer,
        question.explanation,
        question.category,
        question.difficulty,
        question.question
      ]);
      importedCount += db.getRowsModified();
    }
  } finally {
    insertQuestion.free();
  }

  const totalQuestions = db.exec(
    "SELECT COUNT(*) AS total FROM questions"
  )[0].values[0][0];
  console.log(
    `${importedCount} nieuwe quizvragen geïmporteerd; ${totalQuestions} staan in de database.`
  );

  function saveDatabase() {
    const data = db.export();
    fs.writeFileSync(databasePath, Buffer.from(data));
  }

  saveDatabase();

  return { db, saveDatabase };
}

module.exports = { initDatabase };
