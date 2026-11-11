
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL
  || "http://localhost:8080";

function App() {
  const [serverStatus, setServerStatus] = useState("Verbinden...");
  const [socketStatus, setSocketStatus] = useState("Verbinden...");

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => {
        setServerStatus(data.status === "online"
          ? "Online"
          : "Offline");
      })
      .catch(() => setServerStatus("Offline"));

    const socket = io(API_URL);

    socket.on("connect", () => {
      setSocketStatus("Verbonden");
    });

    socket.on("disconnect", () => {
      setSocketStatus("Verbinding verbroken");
    });

    return () => socket.disconnect();
  }, []);

  return (
    <main className="app">
      <section className="welcome">
        <p className="subtitle">DAAG JEZELF UIT</p>

        <h1>QUIZ BATTLE 8</h1>

        <p>
          Test je kennis. Speel samen.
          Word de quizkampioen!
        </p>

        <div className="status">
          <p>Webserver: {serverStatus}</p>
          <p>Realtime: {socketStatus}</p>
        </div>
      </section>
    </main>
  );
}

export default App;
