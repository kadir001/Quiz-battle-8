
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const { initDatabase } = require("./database/db");
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = Number(process.env.PORT) || 8080;

const rooms = new Map();

let database = null;

// Gezondheidscontrole van de webserver.
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    application: "Quiz Battle 8",
    database: database ? "connected" : "disconnected"
  });
});

// Serveer de gebouwde React-app vanaf dezelfde origin als de API en Socket.IO.
app.use(express.static(path.join(__dirname, "../../client/dist")));

// Genereer een unieke kamercode.
function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      code += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
  } while (rooms.has(code));

  return code;
}

// Stuur de openbare kamerinformatie naar alle spelers.
function broadcastRoom(roomCode) {
  const room = rooms.get(roomCode);

  if (!room) return;

  const publicRoom = {
    ...room,
    currentQuestionId: undefined,
    correctAnswer: undefined,
    playerAnswers: undefined,
    roundResultSent: undefined,
    usedQuestionIds: undefined
  };

  io.to(roomCode).emit("room:updated", publicRoom);
}

// Haal een willekeurige vraag uit de database.
// Een eerder gebruikte vraag wordt uitgesloten.
function getRandomQuestion(category, difficulty, usedQuestionIds = []) {
  const statement = database.prepare(`
    SELECT id, question, answers_json, correct_answer
    FROM questions
    WHERE category = ?
      AND level = ?
  `);

  try {
    statement.bind([category, difficulty]);

    const availableQuestions = [];

    while (statement.step()) {
      const result = statement.getAsObject();

      if (!usedQuestionIds.includes(Number(result.id))) {
        availableQuestions.push(result);
      }
    }

    if (availableQuestions.length === 0) {
      return null;
    }

    const result = availableQuestions[
      Math.floor(Math.random() * availableQuestions.length)
    ];

    return {
      id: result.id,
      question: result.question,
      answers: JSON.parse(result.answers_json),
      correctAnswer: Number(result.correct_answer)
    };
  } catch (error) {
    console.error("Fout bij ophalen quizvraag:", error);
    return null;
  } finally {
    statement.free();
  }
}

// Controleer of alle actieve spelers hebben geantwoord.
function haveAllPlayersAnswered(room) {
  return room.players.length > 0 &&
    room.players.every((player) => room.playerAnswers[player.id]);
}

// Verstuur de uitslag van een ronde.
function sendRoundResult(roomCode, room) {
  if (room.roundResultSent || !haveAllPlayersAnswered(room)) {
    return;
  }

  room.roundResultSent = true;

  const results = room.players.map((player) => ({
    nickname: player.nickname,
    score: player.score,
    answerIndex: room.playerAnswers[player.id].answerIndex,
    isCorrect: room.playerAnswers[player.id].isCorrect
  }));

  io.to(roomCode).emit("quiz:round-result", {
    questionId: room.currentQuestionId,
    correctAnswer: room.correctAnswer,
    roundNumber: room.roundNumber,
    results
  });

  console.log(`Ronde ${room.roundNumber} afgerond in ${roomCode}.`);
}

// Verstuur een quizvraag naar alle spelers.
function sendQuestion(roomCode, room, question) {
  room.currentQuestionId = question.id;
  room.correctAnswer = question.correctAnswer;
  room.playerAnswers = {};
  room.roundResultSent = false;

  io.to(roomCode).emit("quiz:question", {
    id: question.id,
    question: question.question,
    answers: question.answers,
    roundNumber: room.roundNumber
  });

  room.usedQuestionIds.push(Number(question.id));

  broadcastRoom(roomCode);
}

// Socket.IO-verbindingen.
io.on("connection", (socket) => {
  console.log("Speler verbonden:", socket.id);

  // Nieuwe spelkamer aanmaken.
  socket.on("room:create", (nickname, callback) => {
    if (!nickname || !nickname.trim()) {
      return callback?.({
        success: false,
        message: "Vul een geldige nickname in."
      });
    }

    const roomCode = generateRoomCode();

    const room = {
      code: roomCode,
      status: "waiting",
      hostId: socket.id,
      roundNumber: 0,

      settings: {
        category: "rekenen",
        difficulty: 1
      },

      currentQuestionId: null,
      correctAnswer: null,
      playerAnswers: {},
      roundResultSent: false,
      usedQuestionIds: [],

      players: [
        {
          id: socket.id,
          nickname: nickname.trim(),
          isHost: true,
          score: 0
        }
      ]
    };

    rooms.set(roomCode, room);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    callback?.({
      success: true,
      room
    });

    broadcastRoom(roomCode);

    console.log(`Spelkamer aangemaakt: ${roomCode}`);
  });

  // Bestaande spelkamer betreden.
  socket.on("room:join", (data, callback) => {
    const nickname = data?.nickname?.trim();
    const roomCode = data?.roomCode?.trim().toUpperCase();

    if (!nickname || !roomCode) {
      return callback?.({
        success: false,
        message: "Vul je nickname en de kamercode in."
      });
    }

    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({
        success: false,
        message: "Spelkamer niet gevonden."
      });
    }

    if (room.status !== "waiting") {
      return callback?.({
        success: false,
        message: "Deze quiz is al gestart."
      });
    }

    if (room.players.length >= 8) {
      return callback?.({
        success: false,
        message: "De spelkamer is vol."
      });
    }

    const nicknameExists = room.players.some(
      (player) =>
        player.nickname.toLowerCase() === nickname.toLowerCase()
    );

    if (nicknameExists) {
      return callback?.({
        success: false,
        message: "Deze nickname wordt al gebruikt."
      });
    }

    const player = {
      id: socket.id,
      nickname,
      isHost: false,
      score: 0
    };

    room.players.push(player);

    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    callback?.({
      success: true,
      room
    });

    broadcastRoom(roomCode);

    console.log(`${nickname} heeft kamer ${roomCode} betreden.`);
  });

  // Quizinstellingen aanpassen.
  socket.on("room:update-settings", (data, callback) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({
        success: false,
        message: "Spelkamer niet gevonden."
      });
    }

    if (room.hostId !== socket.id) {
      return callback?.({
        success: false,
        message: "Alleen de host kan de instellingen wijzigen."
      });
    }

    if (room.status !== "waiting") {
      return callback?.({
        success: false,
        message: "De quiz is al gestart."
      });
    }

    const allowedCategories = [
      "rekenen",
      "begrijpend-lezen",
      "taalverzorging",
      "logisch-redeneren"
    ];

    const category = data?.category;
    const difficulty = Number(data?.difficulty);

    if (!allowedCategories.includes(category)) {
      return callback?.({
        success: false,
        message: "Ongeldige quizcategorie."
      });
    }

    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
      return callback?.({
        success: false,
        message: "Ongeldige moeilijkheidsgraad."
      });
    }

    room.settings.category = category;
    room.settings.difficulty = difficulty;
    room.usedQuestionIds = [];

    callback?.({
      success: true,
      message: "Quizinstellingen opgeslagen."
    });

    broadcastRoom(roomCode);
  });

  // Eerste quizvraag starten.
  socket.on("room:start", (callback) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({
        success: false,
        message: "Spelkamer niet gevonden."
      });
    }

    if (room.hostId !== socket.id) {
      return callback?.({
        success: false,
        message: "Alleen de host kan de quiz starten."
      });
    }

    if (room.status !== "waiting") {
      return callback?.({
        success: false,
        message: "De quiz is al gestart."
      });
    }

    if (room.players.length < 2) {
      return callback?.({
        success: false,
        message: "Er zijn minimaal twee spelers nodig."
      });
    }

    const question = getRandomQuestion(
      room.settings.category,
      room.settings.difficulty,
      room.usedQuestionIds
    );

    if (!question) {
      return callback?.({
        success: false,
        message: "Geen quizvraag gevonden voor deze instellingen."
      });
    }

    room.status = "playing";
    room.roundNumber = 1;
    room.usedQuestionIds = [];

    sendQuestion(roomCode, room, question);

    callback?.({
      success: true,
      message: "De quiz is gestart."
    });

    console.log(`Quiz gestart in kamer ${roomCode}.`);
  });

  // Antwoord van een speler verwerken.
  socket.on("quiz:answer", (data, callback) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({
        success: false,
        message: "Spelkamer niet gevonden."
      });
    }

    if (room.status !== "playing" || room.roundResultSent) {
      return callback?.({
        success: false,
        message: "Er is momenteel geen actieve quizvraag."
      });
    }

    const player = room.players.find(
      (item) => item.id === socket.id
    );

    if (!player) {
      return callback?.({
        success: false,
        message: "Je bent geen deelnemer van deze spelkamer."
      });
    }

    if (room.playerAnswers[socket.id]) {
      return callback?.({
        success: false,
        message: "Je hebt deze vraag al beantwoord."
      });
    }

    const answerIndex = data?.answerIndex;

    if (
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex >= 4
    ) {
      return callback?.({
        success: false,
        message: "Ongeldig antwoord."
      });
    }

    const isCorrect = answerIndex === room.correctAnswer;

    room.playerAnswers[socket.id] = {
      answerIndex,
      isCorrect
    };

    if (isCorrect) {
      player.score += 10;
    }

    callback?.({
      success: true,
      message: "Antwoord ontvangen.",
      answered: true
    });

    console.log(
      `${player.nickname} heeft geantwoord. Correct: ${isCorrect}`
    );

    if (haveAllPlayersAnswered(room)) {
      sendRoundResult(roomCode, room);
    }

    broadcastRoom(roomCode);
  });

  // Volgende quizvraag starten.
  socket.on("room:next-question", (callback) => {
    const roomCode = socket.data.roomCode;
    const room = rooms.get(roomCode);

    if (!room) {
      return callback?.({
        success: false,
        message: "Spelkamer niet gevonden."
      });
    }

    if (room.hostId !== socket.id) {
      return callback?.({
        success: false,
        message: "Alleen de host kan de volgende vraag starten."
      });
    }

    if (room.status !== "playing") {
      return callback?.({
        success: false,
        message: "Er is geen actieve quiz."
      });
    }

    if (!room.roundResultSent) {
      return callback?.({
        success: false,
        message: "Wacht totdat alle spelers hebben geantwoord."
      });
    }

    const completedDifficulty = room.settings.difficulty;
    let nextDifficulty = completedDifficulty;
    let question = getRandomQuestion(
      room.settings.category,
      nextDifficulty,
      room.usedQuestionIds
    );

    if (!question && nextDifficulty < 5) {
      nextDifficulty += 1;
      question = getRandomQuestion(
        room.settings.category,
        nextDifficulty,
        []
      );

      if (question) {
        room.settings.difficulty = nextDifficulty;
        room.usedQuestionIds = [];
      }
    }

    if (!question) {
      room.status = "finished";
      broadcastRoom(roomCode);

      return callback?.({
        success: true,
        finished: true,
        message: "Alle vragen zijn beantwoord. Goed gespeeld!"
      });
    }

    room.roundNumber += 1;

    sendQuestion(roomCode, room, question);

    callback?.({
      success: true,
      message: nextDifficulty > completedDifficulty
        ? `Niveau ${completedDifficulty} is afgerond. Niveau ${nextDifficulty} begint!`
        : "De volgende vraag is gestart.",
      roundNumber: room.roundNumber
    });

    console.log(
      `Ronde ${room.roundNumber} gestart in kamer ${roomCode}.`
    );
  });

  // Speler verbreekt de verbinding.
  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;

    if (!roomCode) return;

    const room = rooms.get(roomCode);

    if (!room) return;

    const disconnectedPlayer = room.players.find(
      (player) => player.id === socket.id
    );

    if (disconnectedPlayer) {
      console.log(
        `${disconnectedPlayer.nickname} heeft de verbinding verbroken.`
      );
    }

    room.players = room.players.filter(
      (player) => player.id !== socket.id
    );

    delete room.playerAnswers[socket.id];

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`Spelkamer ${roomCode} verwijderd.`);
      return;
    }

    // Wijs een nieuwe host aan als de host vertrekt.
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;

      room.players.forEach((player) => {
        player.isHost = player.id === room.hostId;
      });

      console.log(
        `${room.players[0].nickname} is nu de nieuwe host.`
      );
    }

    // Controleer of de overgebleven spelers klaar zijn.
    if (
      room.status === "playing" &&
      !room.roundResultSent &&
      haveAllPlayersAnswered(room)
    ) {
      sendRoundResult(roomCode, room);
    }

    broadcastRoom(roomCode);
  });
});

// Start de server en initialiseer de database.
async function startServer() {
  try {
    const { db } = await initDatabase();

    database = db;

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Quiz Battle 8 server draait op poort ${PORT}`);
      console.log(`Webserver: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Fout bij starten van de server:", error);
    process.exit(1);
  }
}

startServer();
