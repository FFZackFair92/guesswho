# Indovina Chi 3D — Server

Piccolo server (Node.js, zero dipendenze) per:
- **Lobby personalizzate** fino a 10 giocatori (ingresso libero o con invito `ID-CODICE`)
- Accoppiamento casuale delle sfide 1v1 dentro la lobby
- **Classifica a punti**: vittoria = `100 − 3 × tessere abbattute` (minimo 10)
- **Coda random**: abbina due giocatori qualsiasi

Le partite vere restano P2P (PeerJS): il server gestisce solo lobby, abbinamenti e punti.
Le foto delle board custom passano dal server solo per essere distribuite ai membri della lobby.

## Prova in locale
```
node server.js
```
Il server parte su `http://localhost:8787`. Nel gioco, sezione **⚙️ Server**, inserisci
`http://localhost:8787` e premi Salva (deve dire "✅ Server ok").

## Deploy gratuito su Render.com
1. Crea un account su https://render.com (gratis)
2. Carica la cartella `server/` in un repository GitHub (o usa "Deploy from Git")
3. New → **Web Service** → seleziona il repo
4. Impostazioni: Runtime **Node**, Build command *(vuoto)*, Start command `node server.js`, piano **Free**
5. Al termine ottieni un URL tipo `https://guesswho-xyz.onrender.com`
6. Nel gioco, sezione **⚙️ Server**, incolla quell'URL e premi Salva

Nota piano Free: il server "si addormenta" dopo 15 minuti di inattività e il primo
accesso successivo impiega ~30s a svegliarlo. Le lobby vivono in memoria: un riavvio le azzera.

## API (per riferimento)
- `GET  /api/ping`
- `GET  /api/lobbies` — lobby aperte
- `POST /api/lobby` `{name, open, board}` → `{id, code}`
- `POST /api/lobby/:id/join` `{peerId, name, code?}`
- `POST /api/lobby/:id/beat` `{peerId}` → `{players, match?}`
- `POST /api/lobby/:id/result` `{peerId, won, flips}`
- `POST /api/lobby/:id/leave` `{peerId}`
- `POST /api/queue` `{peerId, name}` / `GET /api/queue/:peerId` / `DELETE /api/queue/:peerId`
