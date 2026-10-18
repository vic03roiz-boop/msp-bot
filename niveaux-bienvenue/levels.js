// Niveaux : XP, formule, stockage JSON (volume Railway), import. Aucun Discord ici : testable seul.
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'niveaux.json');
const BACKUPS = path.join(DIR, 'niveaux-backups');
fs.mkdirSync(BACKUPS, { recursive: true });

const COOLDOWN_MS = 60 * 1000; // 1 message qui rapporte de l'XP par minute
const XP_MIN = 15, XP_MAX = 25, MIN_CHARS = 5;

let db = { users: {} };
try { if (fs.existsSync(FILE)) db = { users: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
catch (e) { console.error('[niveaux] fichier illisible, sauvegarde du fichier abîmé en .bad', e.message); try { fs.renameSync(FILE, `${FILE}.bad`); } catch {} }

let timer = null;
function saveNow() { clearTimeout(timer); timer = null; const tmp = `${FILE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
function save() { if (!timer) timer = setTimeout(saveNow, 3000); }
function backupIfNeeded() {
  const name = path.join(BACKUPS, `niveaux-${new Date().toISOString().slice(0, 10)}.json`);
  if (!fs.existsSync(name) && fs.existsSync(FILE)) {
    fs.copyFileSync(FILE, name);
    const all = fs.readdirSync(BACKUPS).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(BACKUPS, old));
  }
}
setInterval(backupIfNeeded, 6 * 60 * 60 * 1000).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { saveNow(); } catch {} });

// XP nécessaire pour passer du niveau l au niveau l+1 (même courbe que MEE6)
const need = (l) => 5 * l * l + 50 * l + 100;
function totalForLevel(level) { let t = 0; for (let l = 0; l < level; l++) t += need(l); return t; }
function levelOf(xp) { let l = 0, left = xp; while (left >= need(l)) { left -= need(l); l++; } return { level: l, into: left, need: need(l) }; }

function user(id) { if (!db.users[id]) db.users[id] = { xp: 0, last: 0 }; return db.users[id]; }

/** Un message : renvoie { gained, from, to } ou null s'il ne compte pas. */
function onMessage(id, length, nowMs = Date.now(), rand = Math.random) {
  if (length < MIN_CHARS) return null;
  const u = user(id);
  if (nowMs - u.last < COOLDOWN_MS) return null;
  const before = levelOf(u.xp).level;
  const gained = XP_MIN + Math.floor(rand() * (XP_MAX - XP_MIN + 1));
  u.xp += gained; u.last = nowMs;
  save();
  return { gained, from: before, to: levelOf(u.xp).level };
}
function setLevel(id, level) { user(id).xp = totalForLevel(level); save(); }
function setXp(id, xp) { user(id).xp = Math.max(0, Math.floor(xp)); save(); }

function ranking() { return Object.entries(db.users).filter(([, u]) => u.xp > 0).sort((a, b) => b[1].xp - a[1].xp); }
function info(id) {
  const u = db.users[id] || { xp: 0 };
  const list = ranking();
  const idx = list.findIndex(([k]) => k === id);
  return { xp: u.xp, ...levelOf(u.xp), rank: idx >= 0 ? idx + 1 : list.length + 1, total: list.length };
}

/** Texte "id;niveau" par ligne (séparateurs ; , tabulation ou espace). mode 'niveau' ou 'xp'. */
function parseImport(text, mode = 'niveau') {
  const ok = [], bad = [], names = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^<?@?!?(\d{16,20})>?\s*[;,\t ]\s*(\d+)\s*$/);
    if (m) { ok.push({ id: m[1], value: Number(m[2]) }); continue; }
    const n = line.match(/^(.*\S)\s*[;\t]\s*(\d+)\s*$/); // « pseudo;niveau » : le bot retrouve le membre par son pseudo
    if (n) names.push({ name: n[1], value: Number(n[2]) });
    else if (!/^(id|user|pseudo)/i.test(line)) bad.push(line.slice(0, 60));
  }
  return { ok, names, bad, mode };
}
function applyImport(parsed) {
  for (const { id, value } of parsed.ok) (parsed.mode === 'xp' ? setXp(id, value) : setLevel(id, value));
  saveNow();
  return parsed.ok.length;
}
function forget(id) { if (db.users[id]) { delete db.users[id]; save(); } }
function reset() { db.users = {}; saveNow(); }

/** Pseudo -> forme comparable : les lettres « fantaisie » (𝓛𝓮𝓷𝓲) deviennent des lettres normales, emojis et symboles disparaissent. */
const norm = (t) => String(t || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** members = [{ id, names: [displayName, username, globalName] }]. Renvoie { matched, ambiguous, missing }. */
function matchNames(entries, members) {
  const index = new Map();
  for (const m of members) for (const n of new Set(m.names.map(norm).filter(Boolean))) { if (!index.has(n)) index.set(n, new Set()); index.get(n).add(m.id); }
  const matched = [], ambiguous = [], missing = [];
  for (const e of entries) {
    const en = norm(e.name);
    const hit = index.get(en);
    if (hit && hit.size === 1) matched.push({ id: [...hit][0], value: e.value, name: e.name });
    else if (hit) ambiguous.push(e);
    else {
      // pas d'égalité exacte : on accepte un pseudo qui en contient un autre (≥ 4 lettres), seulement s'il n'y a qu'un candidat
      const near = new Set();
      if (en.length >= 4) for (const [k, ids] of index) if (k.length >= 4 && (k.includes(en) || en.includes(k))) ids.forEach((id) => near.add(id));
      if (near.size === 1) matched.push({ id: [...near][0], value: e.value, name: e.name, approx: true });
      else missing.push(e);
    }
  }
  return { matched, ambiguous, missing };
}

module.exports = { forget, norm, matchNames, onMessage, setLevel, setXp, info, ranking, parseImport, applyImport, reset, levelOf, totalForLevel, need, backupIfNeeded, saveNow, db: () => db };
