// Stockage JSON sur le volume Railway (/app/data), écriture atomique + sauvegarde quotidienne.
const fs = require('fs');
const path = require('path');
const engine = require('./engine');

const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'bonbons.json');
const BACKUPS = path.join(DIR, 'bonbons-backups');
const JOURNAL = path.join(DIR, 'bonbons-journal.jsonl');

fs.mkdirSync(BACKUPS, { recursive: true });

let db = { users: {}, tickets: {}, stock: {}, giveaways: {}, referrals: {}, meta: { nextTicket: 1 } };
try {
  if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
} catch (e) {
  console.error('[bonbons] fichier illisible, tentative avec la dernière sauvegarde', e);
  const last = fs.readdirSync(BACKUPS).sort().pop();
  if (last) db = { ...db, ...JSON.parse(fs.readFileSync(path.join(BACKUPS, last), 'utf8')) };
}

let timer = null;
function saveNow() {
  clearTimeout(timer);
  timer = null;
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function save() {
  if (!timer) timer = setTimeout(saveNow, 2000);
}
function backupIfNeeded() {
  const name = path.join(BACKUPS, `bonbons-${engine.dayKeyOf(Date.now())}.json`);
  if (!fs.existsSync(name)) {
    saveNow();
    fs.copyFileSync(FILE, name);
    const all = fs.readdirSync(BACKUPS).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(BACKUPS, old));
  }
}
setInterval(backupIfNeeded, 60 * 60 * 1000).unref();
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { saveNow(); } catch {} });

function user(id) {
  if (!db.users[id]) db.users[id] = engine.createUser();
  return db.users[id];
}
function journal(entry) {
  fs.appendFile(JOURNAL, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`, () => {});
}
function reset() {
  db.users = {};
  db.tickets = {};
  db.giveaways = {};
  db.referrals = {};
  db.meta.nextTicket = 1;
  saveNow();
}

module.exports = { get db() { return db; }, user, save, saveNow, journal, backupIfNeeded, reset };
