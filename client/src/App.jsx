
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

const categories = [
  { value: "rekenen", label: "Rekenen" },
  { value: "begrijpend-lezen", label: "Begrijpend lezen" },
  { value: "taalverzorging", label: "Taalverzorging" },
  { value: "logisch-redeneren", label: "Logisch redeneren" }
];

function App() {
  const [serverStatus, setServerStatus] = useState("Verbinden...");
  const [socketStatus, setSocketStatus] = useState("Verbinden...");
  const [socket, setSocket] = useState(null);

  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");

  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [roundResult, setRoundResult] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => {
        setServerStatus(
          data.status === "online" ? "Online" : "Offline"
        );
      })
      .catch(() => setServerStatus("Offline"));

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setSocketStatus("Verbonden");
    });

    newSocket.on("connect_error", () => {
      setSocketStatus("Verbinding mislukt");
    });

    newSocket.on("disconnect", () => {
      setSocketStatus("Verbinding verbroken");
      setRoom(null);
      setQuizQuestion(null);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setRoundResult(null);
    });

    newSocket.on("room:updated", (updatedRoom) => {
      setRoom(updatedRoom);
    });

    // Ontvang een nieuwe quizvraag.
    newSocket.on("quiz:question", (question) => {
      console.log("Quizvraag ontvangen:", question);

      setQuizQuestion(question);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setRoundResult(null);
      setError("");
    });

    // Ontvang de resultaten zodra alle spelers hebben geantwoord.
    newSocket.on("quiz:round-result", (result) => {
      console.log("Ronderesultaat ontvangen:", result);

      setRoundResult(result);
      setHasAnswered(true);
    });

    return () => newSocket.disconnect();
  }, []);

  function createRoom() {
    setError("");
    setQuizQuestion(null);
    setRoundResult(null);

    if (!nickname.trim()) {
      setError("Vul eerst een nickname in.");
      return;
    }

    socket.emit("room:create", nickname, (response) => {
      if (response.success) {
        setRoom(response.room);
      } else {
        setError(response.message);
      }
    });
  }

  function joinRoom() {
    setError("");
    setQuizQuestion(null);
    setRoundResult(null);

    if (!nickname.trim() || !roomCode.trim()) {
      setError("Vul je nickname en de kamercode in.");
      return;
    }

    socket.emit(
      "room:join",
      { nickname, roomCode },
      (response) => {
        if (response.success) {
          setRoom(response.room);
        } else {
          setError(response.message);
        }
      }
    );
  }

  function updateSettings(category, difficulty) {
    setSettingsMessage("");
    setError("");

    socket.emit(
      "room:update-settings",
      { category, difficulty },
      (response) => {
        if (response.success) {
          setSettingsMessage("Quizinstellingen opgeslagen.");
        } else {
          setError(response.message);
        }
      }
    );
  }

  function startQuiz() {
    setError("");
    setQuizQuestion(null);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setRoundResult(null);

    socket.emit("room:start", (response) => {
      if (response.success) {
        setSettingsMessage("De quiz is gestart!");
      } else {
        setError(response.message);
      }
    });
  }

  function nextQuestion() {
    setError("");
    setSettingsMessage("");

    socket.emit("room:next-question", (response) => {
      if (response.success) {
        setSettingsMessage(
          response.message || "De volgende vraag wordt gestart."
        );
      } else {
        setError(response.message);
      }
    });
  }

  function submitAnswer(answerIndex) {
    if (!socket || hasAnswered || selectedAnswer !== null) {
      return;
    }

    setError("");
    setSelectedAnswer(answerIndex);

    socket.emit(
      "quiz:answer",
      { answerIndex },
      (response) => {
        if (response.success) {
          setHasAnswered(true);
        } else {
          setSelectedAnswer(null);
          setError(response.message);
        }
      }
    );
  }

  function leaveRoom() {
    if (!socket) return;

    socket.disconnect();

    setRoom(null);
    setQuizQuestion(null);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setRoundResult(null);

    setError("Je hebt de spelkamer verlaten.");

    socket.connect();
  }

  const isHost = room?.hostId === socket?.id;

  const correctAnswerText =
    roundResult && quizQuestion
      ? quizQuestion.answers[roundResult.correctAnswer]
      : null;

  return (
    <main className="app">
      <section className="welcome">
        <p className="subtitle">DAAG JEZELF UIT</p>
        <h1>QUIZ BATTLE 8</h1>
        <p>Test je kennis. Speel samen. Word de quizkampioen!</p>

        <div className="status">
          <p>Webserver: {serverStatus}</p>
          <p>Realtime: {socketStatus}</p>
        </div>

        {!room ? (
          <div className="lobby-form">
            <h2>Speel mee!</h2>

            <label htmlFor="nickname">Jouw nickname</label>
            <input
              id="nickname"
              type="text"
              maxLength={20}
              placeholder="Bijvoorbeeld Kadir"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />

            <button
              onClick={createRoom}
              disabled={!socket || !socket.connected}
            >
              Spelkamer aanmaken
            </button>

            <div className="divider">OF</div>

            <label htmlFor="roomCode">Kamercode</label>
            <input
              id="roomCode"
              type="text"
              maxLength={6}
              placeholder="Bijvoorbeeld AB12CD"
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
            />

            <button
              className="secondary-button"
              onClick={joinRoom}
              disabled={!socket || !socket.connected}
            >
              Spelkamer betreden
            </button>

            {error && <p className="error">{error}</p>}
          </div>
        ) : (
          <div className="lobby">
            <h2>Wachtkamer</h2>

            <p>Deel deze code met andere spelers:</p>
            <div className="room-code">{room.code}</div>

            <h3>Spelers ({room.players.length}/8)</h3>

            <ul className="player-list">
              {room.players.map((player) => (
                <li key={player.id}>
                  {player.nickname}
                  {player.isHost && <span>Host</span>}
                  <span>{player.score ?? 0} punten</span>
                </li>
              ))}
            </ul>

            {room.status === "waiting" && (
              <div className="quiz-settings">
                <h3>Quizinstellingen</h3>

                <label htmlFor="category">Quizcategorie</label>
                <select
                  id="category"
                  value={room.settings.category}
                  disabled={!isHost}
                  onChange={(event) =>
                    updateSettings(
                      event.target.value,
                      room.settings.difficulty
                    )
                  }
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>

                <label htmlFor="difficulty">Moeilijkheidsgraad</label>
                <select
                  id="difficulty"
                  value={room.settings.difficulty}
                  disabled={!isHost}
                  onChange={(event) =>
                    updateSettings(
                      room.settings.category,
                      Number(event.target.value)
                    )
                  }
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      Niveau {level}
                    </option>
                  ))}
                </select>

                {!isHost && (
                  <p className="settings-info">
                    Alleen de host kan de quizinstellingen wijzigen.
                  </p>
                )}
              </div>
            )}

            {settingsMessage && (
              <p className="success">{settingsMessage}</p>
            )}

            {room.status === "waiting" && isHost && (
              <button onClick={startQuiz}>
                Quiz starten
              </button>
            )}

            {room.status === "playing" && (
              <div className="game-started">
                <h3>De quiz is gestart!</h3>

                <p>
                  Categorie: {
                    categories.find(
                      (category) =>
                        category.value === room.settings.category
                    )?.label
                  }
                </p>

                <p>
                  Moeilijkheidsgraad: Niveau {room.settings.difficulty}
                </p>

                {quizQuestion ? (
                  <div className="question-card">
                    <h3>Quizvraag</h3>

                    <p>{quizQuestion.question}</p>

                    <div className="answer-options">
                      {quizQuestion.answers.map((answer, index) => (
                        <button
                          className={`answer-option ${
                            selectedAnswer === index ? "selected" : ""
                          }`}
                          key={index}
                          onClick={() => submitAnswer(index)}
                          disabled={hasAnswered || selectedAnswer !== null}
                        >
                          {String.fromCharCode(65 + index)}. {answer}
                        </button>
                      ))}
                    </div>

                    {hasAnswered && !roundResult && (
                      <p className="success">
                        Antwoord ontvangen. Je wacht op de andere spelers...
                      </p>
                    )}

                    {roundResult && (
                      <div className="round-result">
                        <h3>Ronde afgelopen!</h3>

                        <p>
                          Het juiste antwoord is:{" "}
                          <strong>
                            {String.fromCharCode(
                              65 + roundResult.correctAnswer
                            )}
                            . {correctAnswerText}
                          </strong>
                        </p>

                        <h4>Resultaten</h4>

                        <ul className="player-list">
                          {roundResult.results.map((result, index) => (
                            <li key={`${result.nickname}-${index}`}>
                              <span>
                                {result.nickname}
                                {" — "}
                                {result.isCorrect
                                  ? "Goed antwoord"
                                  : "Fout antwoord"}
                              </span>
                              <span>{result.score} punten</span>
                            </li>
                          ))}
                        </ul>

                        {isHost && (
                          <button onClick={nextQuestion}>
                            Volgende vraag
                          </button>
                        )}

                        {!isHost && (
                          <p>Wachten tot de host de volgende vraag start...</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>De quizvraag wordt geladen...</p>
                )}
              </div>
            )}

            {room.status === "finished" && (
              <div className="game-started">
                <h3>Alle niveaus afgerond!</h3>
                <p>Goed gespeeld. De eindscore staat hierboven bij de spelers.</p>
              </div>
            )}

            {error && <p className="error">{error}</p>}

            <button
              className="secondary-button"
              onClick={leaveRoom}
            >
              Spelkamer verlaten
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
