# Installatiegids

Deze gids beschrijft een productie-installatie op een Linux- of Armbian-server. De server levert zowel de React-app als de API en Socket.IO vanaf één poort.

## 1. Vereisten

- Node.js 22.12 of nieuwer om de frontend met de huidige Vite-versie te bouwen.
- npm.
- Een vrije TCP-poort; standaard is dat `8080`.

De backend gebruikt Express 5 en vereist Node.js 18 of nieuwer. Controleer de installatie:

```bash
node --version
npm --version
```

## 2. Download de broncode

Vervang de gebruikersnaam in de GitHub-URL door de eigenaar van de repository:

```bash
git clone https://github.com/<GEBRUIKERSNAAM>/quiz-battle-8.git
cd quiz-battle-8
```

## 3. Bouw de frontend

```bash
cd client
npm ci
npm run build
```

Vite plaatst de productieversie in `client/dist`.

## 4. Installeer en start de backend

```bash
cd ../server
npm ci --omit=dev
npm start
```

De server start standaard op poort `8080`. Controleer op de server:

```bash
curl http://127.0.0.1:8080/api/health
```

De verwachte reactie bevat `"status":"online"` en `"database":"connected"`. Open vanaf een apparaat op hetzelfde netwerk `http://<IP-ADRES-VAN-DE-SERVER>:8080`.

## 5. Automatisch starten met systemd

Vervang `LINUX_GEBRUIKER` door de Linux-gebruikersnaam en pas het pad aan als je de repository ergens anders hebt geplaatst. Maak het servicebestand:

```bash
sudo nano /etc/systemd/system/quiz-battle-8.service
```

Gebruik deze inhoud:

```ini
[Unit]
Description=Quiz Battle 8
After=network.target

[Service]
Type=simple
User=LINUX_GEBRUIKER
WorkingDirectory=/home/LINUX_GEBRUIKER/quiz-battle-8/server
Environment=NODE_ENV=production
Environment=PORT=8080
ExecStart=/usr/bin/node /home/LINUX_GEBRUIKER/quiz-battle-8/server/src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Activeer en start de service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now quiz-battle-8
sudo systemctl status quiz-battle-8 --no-pager
```

Bekijk logs bij problemen:

```bash
sudo journalctl -u quiz-battle-8 -n 50 --no-pager
```

## 6. Netwerktoegang

De server luistert op alle netwerkinterfaces. Op een thuisnetwerk open je hem via het LAN-IP-adres van de server. Als een firewall actief is, sta dan alleen toegang vanaf je LAN toe op de gekozen poort. Stel geen routerpoort door voor een installatie die alleen thuis gebruikt wordt.

Voor toegang vanaf internet is aanvullende configuratie nodig voor HTTPS en Socket.IO/WebSocket-verkeer. De app bevat geen gebruikersaccounts; behandel kamercodes daarom als toegangscodes voor de bijbehorende spelkamer.

## 7. Vragen aanpassen

Bewerk `server/src/questions.json`. De database importeert nieuwe vragen bij de eerstvolgende serverstart en slaat bestaande vragen over. Herstart de service na het kopiëren van de bijgewerkte broncode:

```bash
sudo systemctl restart quiz-battle-8
```

De SQLite-database staat in `server/data/quiz.sqlite`. De database bevat de vragenbank; spelkamers en scores zijn tijdelijk en worden niet na een serverherstart bewaard.
