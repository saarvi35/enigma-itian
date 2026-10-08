const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
const organizerPin = process.env.ORGANIZER_PIN || crypto.randomInt(10000000, 99999999).toString();
const organizerSession = crypto.randomBytes(32).toString('hex');
const dataDir = process.env.ENIGMA_DATA_DIR || path.join(root, '.enigma-data');
const teamFile = path.join(dataDir, 'teams.json');
const eventFile = path.join(dataDir, 'event.json');
const teamFields = ['id','name','p1','p2','registeredAt','startedAt','completedAt','expiredAt','status','round','variant','answers','hints','freeHints','penaltyHints','penaltySeconds','wrongAttempts','wrongAttemptsByRound','lockedUntil'];
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 10000 });
}
let sharedTeams = [];
let sharedEvent = { state: 'live', startedAt: Date.now(), closedAt: null };
if (!pool) {
  try { sharedTeams = JSON.parse(fs.readFileSync(teamFile, 'utf8')); } catch {}
  try { sharedEvent = JSON.parse(fs.readFileSync(eventFile, 'utf8')); } catch {}
}
const authorized = req => (req.headers.cookie || '').split(';').some(item => item.trim() === `enigma_org=${organizerSession}`);
const publicTeam = team => Object.fromEntries(teamFields.filter(key => Object.hasOwn(team, key)).map(key => [key, team[key]]));
const saveLocalTeams = () => { fs.mkdirSync(dataDir, { recursive: true }); const temp = `${teamFile}.tmp`; fs.writeFileSync(temp, JSON.stringify(sharedTeams, null, 2)); fs.renameSync(temp, teamFile); };
const saveLocalEvent = () => { fs.mkdirSync(dataDir, { recursive: true }); const temp = `${eventFile}.tmp`; fs.writeFileSync(temp, JSON.stringify(sharedEvent, null, 2)); fs.renameSync(temp, eventFile); };
const persistTeam = async team => {
  if (!pool) {
    const index = sharedTeams.findIndex(row => row.id === team.id);
    if (index < 0) return false;
    sharedTeams[index] = team; saveLocalTeams(); return true;
  }
  const result = await pool.query('INSERT INTO enigma_teams (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data RETURNING id', [team.id, team]);
  return result.rowCount > 0;
};
const insertTeam = async team => {
  if (!pool) {
    if (sharedTeams.some(row => row.id === team.id)) return false;
    sharedTeams.push(team); saveLocalTeams(); return true;
  }
  const result = await pool.query('INSERT INTO enigma_teams (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id', [team.id, team]);
  return result.rowCount > 0;
};
const persistAllTeams = async () => {
  if (!pool) { saveLocalTeams(); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const team of sharedTeams) await client.query('INSERT INTO enigma_teams (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [team.id, team]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
const persistEvent = async () => {
  if (!pool) { saveLocalEvent(); return; }
  await pool.query('INSERT INTO enigma_state (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data', ['event', sharedEvent]);
};
const initializeStore = async () => {
  if (!pool) return;
  await pool.query('CREATE TABLE IF NOT EXISTS enigma_teams (id TEXT PRIMARY KEY, data JSONB NOT NULL)');
  await pool.query('CREATE TABLE IF NOT EXISTS enigma_state (key TEXT PRIMARY KEY, data JSONB NOT NULL)');
  const teams = await pool.query('SELECT data FROM enigma_teams ORDER BY id');
  sharedTeams = teams.rows.map(row => row.data);
  const event = await pool.query('SELECT data FROM enigma_state WHERE key = $1', ['event']);
  if (event.rowCount) sharedEvent = event.rows[0].data;
  else await persistEvent();
};
const readBody = req => new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 65536) { reject(new Error('Request too large')); req.destroy(); } }); req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); } }); req.on('error', reject); });
const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); };
console.log(`Organizer console: http://127.0.0.1:${port}/organizer`);
if (!process.env.ORGANIZER_PIN) console.log(`Organizer PIN (keep private): ${organizerPin}`);

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname.split('/').some(segment => segment.startsWith('.'))) { res.writeHead(404); res.end('Not found'); return; }
  if (pathname === '/api/event' && req.method === 'GET') { json(res, 200, sharedEvent); return; }
  if (pathname === '/api/event' && req.method === 'POST') {
    if (!authorized(req)) { json(res, 401, { error: 'Organizer access required' }); return; }
    readBody(req).then(async body => {
      if (!['live','closed'].includes(body.state)) { json(res, 400, { error: 'Invalid event state' }); return; }
      sharedEvent = { state: body.state, startedAt: sharedEvent.startedAt || Date.now(), closedAt: body.state === 'closed' ? Date.now() : null };
      if (body.state === 'closed') { for (const team of sharedTeams) if (team.status === 'active') { team.status = 'expired'; team.expiredAt = Date.now(); } await persistAllTeams(); }
      await persistEvent(); json(res, 200, sharedEvent);
    }).catch(error => { console.error('Could not save event state:', error); json(res, 500, { error: 'Could not save event state' }); });
    return;
  }
  if (pathname === '/api/teams' && req.method === 'GET') {
    if (!authorized(req)) { json(res, 401, { error: 'Organizer access required' }); return; }
    json(res, 200, sharedTeams.map(publicTeam)); return;
  }
  if (pathname === '/api/teams' && req.method === 'POST') {
    readBody(req).then(async body => {
      const team = publicTeam(body);
      if (!team.id || !team.name || sharedEvent.state === 'closed' || sharedTeams.some(row => row.id === team.id)) { json(res, 409, { error: 'Event closed, team already registered, or invalid data' }); return; }
      const syncToken = crypto.randomBytes(32).toString('hex');
      const record = { ...team, syncToken };
      if (!await insertTeam(record)) { json(res, 409, { error: 'Team already registered' }); return; }
      if (pool) sharedTeams.push(record);
      json(res, 201, { syncToken });
    }).catch(error => { console.error('Could not register team:', error); json(res, 500, { error: 'Could not save team registration' }); });
    return;
  }
  if (pathname === '/api/teams/import' && req.method === 'POST') {
    if (!authorized(req)) { json(res, 401, { error: 'Organizer access required' }); return; }
    readBody(req).then(async body => {
      const imported = [];
      for (const item of Array.isArray(body.teams) ? body.teams : []) {
        const team = publicTeam(item);
        if (!team.id || !team.name || sharedTeams.some(row => row.id === team.id)) continue;
        const record = { ...team, syncToken: crypto.randomBytes(32).toString('hex') };
        if (await insertTeam(record)) { if (pool) sharedTeams.push(record); imported.push(team.id); }
      }
      json(res, 200, { imported });
    }).catch(error => { console.error('Could not import teams:', error); json(res, 500, { error: 'Could not import team data' }); });
    return;
  }
  const teamRoute = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (teamRoute && req.method === 'PUT') {
    readBody(req).then(async body => {
      const team = sharedTeams.find(row => row.id === teamRoute[1]);
      const supplied = String(req.headers['x-team-token'] || '');
      if (!team || !supplied || supplied.length !== team.syncToken.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(team.syncToken))) { json(res, 403, { error: 'Team update not authorized' }); return; }
      const updated = { ...team };
      for (const field of teamFields) if (Object.hasOwn(body, field)) updated[field] = body[field];
      await persistTeam(updated);
      Object.assign(team, updated);
      json(res, 200, { saved: true });
    }).catch(error => { console.error('Could not update team:', error); json(res, 500, { error: 'Could not save team update' }); });
    return;
  }
  if (pathname === '/api/organizer-session' && req.method === 'GET') {
    const cookie = req.headers.cookie || '';
    const authorized = cookie.split(';').some(item => item.trim() === `enigma_org=${organizerSession}`);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ authorized }));
    return;
  }
  if (pathname === '/api/organizer-session' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let submitted = '';
      try { submitted = String(JSON.parse(body).pin || ''); } catch {}
      const allowed = submitted.length === organizerPin.length && crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(organizerPin));
      if (!allowed) { res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ authorized: false })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': `enigma_org=${organizerSession}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
      res.end(JSON.stringify({ authorized: true }));
    });
    return;
  }
  if (pathname === '/api/organizer-session' && req.method === 'DELETE') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Set-Cookie': 'enigma_org=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    res.end(JSON.stringify({ authorized: false }));
    return;
  }
  if (pathname === '/organizer') {
    fs.readFile(path.join(root, 'index.html'), (error, content) => {
      if (error) { res.writeHead(500); res.end('Unable to open organizer console'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(content);
    });
    return;
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    const isHtml = path.extname(file) === '.html';
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  });
});

if (pool) pool.on('error', error => console.error('PostgreSQL pool error:', error));
initializeStore()
  .then(() => server.listen(port, '0.0.0.0', () => console.log(`ENIGMA is running on port ${port}${pool ? ' with Render Postgres' : ''}`)))
  .catch(error => { console.error('Could not initialize ENIGMA storage:', error); process.exitCode = 1; });
