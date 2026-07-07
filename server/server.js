// ================================================================
//  Indovina Chi 3D — server lobby & matchmaking
//  Zero dipendenze: si avvia con `node server.js`
//  Deploy gratuito consigliato: Render.com (Web Service, Node)
// ================================================================
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Il server serve anche il client: cerca index.html accanto a sé o nella cartella padre
const CLIENT_PATHS = [path.join(__dirname, 'index.html'), path.join(__dirname, '..', 'index.html')];
function clientHtml() {
  for (const p of CLIENT_PATHS) { try { return fs.readFileSync(p); } catch (e) { } }
  return null;
}

const PORT = process.env.PORT || 8787;
const MAX_PLAYERS = 10;
const STALE_MS = 30_000;        // giocatore senza heartbeat -> rimosso
const LOBBY_TTL_MS = 120_000;   // lobby vuota -> cancellata
const MATCH_TTL_MS = 5 * 60_000;// partita senza esito -> reset

/** lobbies: id -> {id,name,open,code,board,players:{peerId:{name,score,status,last,match}},last} */
const lobbies = new Map();
/** coda random: [{peerId,name,last,match}] */
let queue = [];

const rid = n => crypto.randomBytes(8).toString('base64url').replace(/[-_]/g,'A').slice(0, n).toUpperCase();
const now = () => Date.now();
const points = flips => Math.max(10, 100 - 3 * (Number(flips) || 0));

function sweep() {
  const t = now();
  for (const [id, lb] of lobbies) {
    for (const [pid, p] of Object.entries(lb.players)) {
      if (t - p.last > STALE_MS) delete lb.players[pid];
      else if (p.status === 'playing' && t - (p.matchStart || 0) > MATCH_TTL_MS) { p.status = 'idle'; p.match = null; }
    }
    if (Object.keys(lb.players).length === 0 && t - lb.last > LOBBY_TTL_MS) lobbies.delete(id);
  }
  queue = queue.filter(q => t - q.last < STALE_MS);
}

function pairInLobby(lb) {
  const idle = Object.entries(lb.players).filter(([, p]) => p.status === 'idle' && !p.match);
  while (idle.length >= 2) {
    // accoppiamento casuale
    const i = Math.floor(Math.random() * idle.length); const [aId, a] = idle.splice(i, 1)[0];
    const j = Math.floor(Math.random() * idle.length); const [bId, b] = idle.splice(j, 1)[0];
    a.match = { opp: bId, oppName: b.name, call: true };
    b.match = { opp: aId, oppName: a.name, call: false };
    a.matchStart = b.matchStart = now();
  }
}

function pairQueue() {
  const free = queue.filter(q => !q.match);
  while (free.length >= 2) {
    const a = free.shift(), b = free.shift();
    a.match = { opp: b.peerId, oppName: b.name, call: true };
    b.match = { opp: a.peerId, oppName: a.name, call: false };
  }
}

function playersView(lb) {
  return Object.entries(lb.players)
    .map(([pid, p]) => ({ peerId: pid, name: p.name, score: p.score, status: p.status }))
    .sort((x, y) => y.score - x.score);
}

// ---------------- HTTP ----------------
const server = http.createServer((req, res) => {
  const hdr = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, hdr); return res.end(); }

  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 15_000_000) req.destroy(); });
  req.on('end', () => {
    sweep();
    let body = {};
    try { if (raw) body = JSON.parse(raw); } catch (e) { }
    const url = new URL(req.url, 'http://x');
    const parts = url.pathname.split('/').filter(Boolean); // es: api, lobby, ID, join
    const send = (code, obj) => { res.writeHead(code, hdr); res.end(JSON.stringify(obj)); };

    try {
      // ---- client statico ----
      if (parts[0] !== 'api') {
        if (req.method === 'GET' && (parts.length === 0 || parts[0] === 'index.html')) {
          const html = clientHtml();
          if (html) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html); }
        }
        return send(404, { error: 'not found' });
      }

      // ---- salute ----
      if (parts[1] === 'ping') return send(200, { ok: true, lobbies: lobbies.size, queue: queue.length });

      // ---- lista lobby aperte ----
      if (parts[1] === 'lobbies' && req.method === 'GET') {
        const list = [...lobbies.values()].filter(l => l.open)
          .map(l => ({ id: l.id, name: l.name, count: Object.keys(l.players).length, max: MAX_PLAYERS }));
        return send(200, { lobbies: list });
      }

      // ---- crea lobby ----
      if (parts[1] === 'lobby' && parts.length === 2 && req.method === 'POST') {
        const { name, open, board } = body;
        if (!Array.isArray(board) || board.length < 8) return send(400, { error: 'board: servono almeno 8 personaggi' });
        const id = rid(6), code = rid(5);
        lobbies.set(id, { id, name: String(name || 'Lobby').slice(0, 24), open: !!open, code, board, players: {}, last: now() });
        return send(200, { id, code });
      }

      // ---- operazioni su lobby ----
      if (parts[1] === 'lobby' && parts.length === 4) {
        const lb = lobbies.get(parts[2]);
        if (!lb) return send(404, { error: 'lobby inesistente' });
        lb.last = now();
        const act = parts[3];

        if (act === 'join') {
          const { peerId, name, code } = body;
          if (!peerId) return send(400, { error: 'peerId mancante' });
          if (!lb.open && code !== lb.code) return send(403, { error: 'codice errato' });
          if (Object.keys(lb.players).length >= MAX_PLAYERS && !lb.players[peerId]) return send(403, { error: 'lobby piena' });
          lb.players[peerId] = lb.players[peerId] || { name: String(name || 'Player').slice(0, 16), score: 0, status: 'idle', last: now(), match: null };
          lb.players[peerId].last = now();
          return send(200, { ok: true, name: lb.name, code: lb.code, board: lb.board, players: playersView(lb) });
        }

        const me = lb.players[body.peerId];
        if (!me) return send(403, { error: 'non sei nella lobby' });
        me.last = now();

        if (act === 'beat') {
          pairInLobby(lb);
          let match = null;
          if (me.match) { match = me.match; me.match = null; me.status = 'playing'; }
          return send(200, { players: playersView(lb), match });
        }
        if (act === 'result') {
          if (body.won) me.score += points(body.flips);
          me.status = 'idle'; me.match = null;
          return send(200, { ok: true, score: me.score });
        }
        if (act === 'leave') {
          delete lb.players[body.peerId];
          return send(200, { ok: true });
        }
      }

      // ---- coda random ----
      if (parts[1] === 'queue' && req.method === 'POST') {
        const { peerId, name } = body;
        if (!peerId) return send(400, { error: 'peerId mancante' });
        let q = queue.find(x => x.peerId === peerId);
        if (!q) { q = { peerId, name: String(name || 'Player').slice(0, 16), last: now(), match: null }; queue.push(q); }
        q.last = now();
        pairQueue();
        return send(200, { ok: true });
      }
      if (parts[1] === 'queue' && parts.length === 3 && req.method === 'GET') {
        const q = queue.find(x => x.peerId === parts[2]);
        if (!q) return send(200, { match: null, waiting: false });
        q.last = now();
        pairQueue();
        if (q.match) { const m = q.match; queue = queue.filter(x => x.peerId !== q.peerId); return send(200, { match: m }); }
        return send(200, { match: null, waiting: true, inQueue: queue.filter(x => !x.match).length });
      }
      if (parts[1] === 'queue' && parts.length === 3 && req.method === 'DELETE') {
        queue = queue.filter(x => x.peerId !== parts[2]);
        return send(200, { ok: true });
      }

      return send(404, { error: 'not found' });
    } catch (e) {
      return send(500, { error: String(e.message || e) });
    }
  });
});

server.listen(PORT, () => console.log('Indovina Chi server sulla porta ' + PORT));
