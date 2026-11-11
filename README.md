# Quiz Battle 8

Quiz Battle 8 is een multiplayerquiz voor 2 tot 8 spelers. Eén speler maakt een kamer aan als host; de andere spelers doen mee met de kamercode.

## Functies

- Vier categorieën: Rekenen, Begrijpend lezen, Taalverzorging en Logisch redeneren.
- Vijf moeilijkheidsniveaus.
- Vier antwoordmogelijkheden per vraag.
- 10 punten per goed antwoord.
- Dezelfde vraag komt niet opnieuw voor binnen een niveau en een spelkamer.
- Na de laatste vraag van een niveau kan de host met **Volgende vraag** het volgende niveau starten.
- De spelerslijst toont de actuele scores.
- De rekenvragenbank bevat 10 vragen per niveau.

## Technologie

- React en Vite voor de browserapp.
- Express en Socket.IO voor de API en het multiplayerverkeer.
- SQLite via `sql.js` voor de vragenbank.

## Vereisten

- Node.js 22.12 of nieuwer wordt aanbevolen voor de huidige Vite-versie.
- npm, meegeleverd met Node.js.

De Express-server vereist minimaal Node.js 18. De frontend en server hebben elk hun eigen `package.json` en lockbestand.

## Ontwikkelen op je computer

Clone de repository en open twee terminals in de projectmap.

**Terminal 1 – backend**

```bash
cd server
npm ci
npm run dev
```

De backend luistert standaard op poort `8080`.

**Terminal 2 – frontend**

```bash
cd client
npm ci
npm run dev
```

Open de Vite-link die in de terminal verschijnt, standaard `http://localhost:5173`. De Vite-configuratie stuurt `/api`- en Socket.IO-verkeer tijdens ontwikkeling door naar de backend.

## Productie lokaal of op een thuisserver

Build eerst de frontend en start daarna de server:

```bash
cd client
npm ci
npm run build

cd ../server
npm ci --omit=dev
npm start
```

De Express-server serveert de gebouwde frontend uit `client/dist` en biedt ook de API en Socket.IO aan. Open `http://localhost:8080` op dezelfde computer, of `http://<IP-ADRES-VAN-DE-SERVER>:8080` vanaf een ander apparaat op hetzelfde netwerk.

De poort kan worden ingesteld met `PORT`, bijvoorbeeld op Linux:

```bash
PORT=8081 npm start
```

Op PowerShell:

```powershell
$env:PORT = "8081"
npm start
```

Zie [INSTALL.md](INSTALL.md) voor installatie als Linux/Armbian-service.

## Vragenbank en spelgegevens

Vragen staan in [`server/src/questions.json`](server/src/questions.json). Bij het starten importeert de server vragen die nog niet in de database staan. De SQLite-database wordt aangemaakt onder `server/data/quiz.sqlite`; dit bestand wordt door `.gitignore` buiten Git gehouden.

Spelkamers, spelers en scores staan tijdens het spelen in het geheugen. Ze worden gewist als de server opnieuw start. De vragenbank blijft in SQLite opgeslagen.

## Gebruik op internet

Voor een publiek bereikbare installatie is een host nodig die een Node.js-server en Socket.IO/WebSocket-verbindingen ondersteunt. GitHub Pages kan alleen de statische frontendbestanden serveren en voert deze backend niet uit. Gebruik HTTPS en een passende reverse proxy of platformconfiguratie wanneer je de server publiek bereikbaar maakt.

## Licentie

Dit project is beschikbaar onder de [MIT-licentie](LICENSE). Je mag de code gebruiken, aanpassen en verspreiden zolang de copyright- en licentietekst behouden blijven.
