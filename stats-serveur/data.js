// Collecte + stockage des statistiques (JSON sur le volume Railway). Aucun Discord ici : testable seul.
const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'stats-serveur.json');
const TZ = 'Europe/Paris';
fs.mkdirSync(DIR, { recursive: true });

let db = { days: {}, meta: {} };
try {
  if (fs.existsSync(FILE)) db = { days: {}, meta: {}, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch (e) {
  console.error('[stats] fichier illisible, on repart de zéro (l’ancien est conservé en .bad)', e.message);
  try { fs.renameSync(FILE, `${FILE}.bad`); } catch {}
}

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' });
const fmtWeekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const dayKeyOf = (ms = Date.now()) => fmtDay.format(new Date(ms));
const hourOf = (ms = Date.now()) => Number(fmtHour.format(new Date(ms)));
const weekdayOf = (ms = Date.now()) => fmtWeekday.format(new Date(ms));
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

let timer = null;
function saveNow() {
  clearTimeout(timer);
  timer = null;
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function save() { if (!timer) timer = setTimeout(saveNow, 5000); }
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { saveNow(); } catch {} });

function day(key = dayKeyOf()) {
  if (!db.days[key]) db.days[key] = { joins: 0, leaves: 0, members: null, msgs: 0, hours: Array(24).fill(0), users: {}, voice: {}, channels: {} };
  return db.days[key];
}
function prune() {
  const keys = Object.keys(db.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete db.days[k];
}

function recordMessage(userId, channelId, ms = Date.now()) {
  const d = day(dayKeyOf(ms));
  d.msgs += 1;
  d.hours[hourOf(ms)] += 1;
  d.users[userId] = (d.users[userId] || 0) + 1;
  d.channels[channelId] = (d.channels[channelId] || 0) + 1;
  save();
}
function recordVoiceMinute(userId, ms = Date.now()) {
  const d = day(dayKeyOf(ms));
  d.voice[userId] = (d.voice[userId] || 0) + 1;
  save();
}
function recordJoin(memberCount, ms = Date.now()) { const d = day(dayKeyOf(ms)); d.joins += 1; d.members = memberCount; save(); }
function recordLeave(memberCount, ms = Date.now()) { const d = day(dayKeyOf(ms)); d.leaves += 1; d.members = memberCount; save(); }
function snapshotMembers(memberCount, ms = Date.now()) { day(dayKeyOf(ms)).members = memberCount; prune(); save(); }

/** Résumé des `n` derniers jours (aujourd'hui inclus). */
function summary(n, ms = Date.now()) {
  const end = dayKeyOf(ms);
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(addDays(end, -i));
  const rows = keys.map((k) => ({ key: k, ...(db.days[k] || {}) }));
  const users = {}, voice = {}, channels = {};
  const hours = Array(24).fill(0);
  let msgs = 0, joins = 0, leaves = 0;
  for (const r of rows) {
    if (!r.hours) continue;
    msgs += r.msgs; joins += r.joins; leaves += r.leaves;
    r.hours.forEach((v, h) => { hours[h] += v; });
    for (const [id, v] of Object.entries(r.users)) users[id] = (users[id] || 0) + v;
    for (const [id, v] of Object.entries(r.voice)) voice[id] = (voice[id] || 0) + v;
    for (const [id, v] of Object.entries(r.channels)) channels[id] = (channels[id] || 0) + v;
  }
  // courbe des membres : on reporte la dernière valeur connue sur les jours sans mesure
  let last = null;
  const growth = rows.map((r) => {
    if (typeof r.members === 'number') last = r.members;
    return { key: r.key, members: last, joins: r.joins || 0, leaves: r.leaves || 0 };
  });
  const top = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, value]) => ({ id, value }));
  const known = growth.filter((g) => g.members !== null);
  return {
    days: n, msgs, joins, leaves, growth, hours,
    topUsers: top(users, 10), topVoice: top(voice, 8), topChannels: top(channels, 6),
    firstMembers: known.length ? known[0].members : null,
    lastMembers: known.length ? known[known.length - 1].members : null,
    daysWithData: rows.filter((r) => r.hours).length,
  };
}

module.exports = { db: () => db, recordMessage, recordVoiceMinute, recordJoin, recordLeave, snapshotMembers, summary, saveNow, save, dayKeyOf, hourOf, weekdayOf, addDays };
