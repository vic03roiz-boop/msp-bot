// Génère des images d'exemple avec de fausses données (aucun Discord) : node test/render.js
process.env.DATA_DIR = require('os').tmpdir() + '/stats-test-' + Date.now();
const fs = require('fs');
const assert = require('assert');
const data = require('../data');
const charts = require('../charts');

const now = Date.now();
const users = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
let members = 190;
for (let d = 29; d >= 0; d--) {
  const t = now - d * 864e5;
  const j = Math.floor(Math.random() * 4), l = Math.floor(Math.random() * 3);
  for (let k = 0; k < j; k++) { members++; data.recordJoin(members, t); }
  for (let k = 0; k < l; k++) { members--; data.recordLeave(members, t); }
  data.snapshotMembers(members, t);
  for (let m = 0; m < 200; m++) {
    const h = Math.min(23, Math.floor(18 + Math.random() * 8 - (Math.random() < 0.3 ? 8 : 0)));
    data.recordMessage(users[Math.floor(Math.random() ** 2 * users.length)], 'c' + (m % 3), Date.parse(new Date(t).toISOString().slice(0, 10) + `T${String(Math.max(0, h)).padStart(2, '0')}:10:00Z`) );
  }
  data.recordVoiceMinute('u1', t);
}
const s = data.summary(30);
assert(s.msgs > 0 && s.growth.length === 30 && s.topUsers.length > 0, 'résumé');
assert.strictEqual(s.growth[29].members, members, 'dernier effectif');
const out = process.argv[2] || require('os').tmpdir();
const named = s.topUsers.map((u, i) => ({ name: ['Lili🎃', 'Jo', 'Sarah_MSP', 'Max', 'Chloé', 'Zoé'][i] || 'x', value: u.value }));
fs.writeFileSync(`${out}/t-croissance.png`, charts.growthChart(s.growth, '30 derniers jours · heure de Paris'));
fs.writeFileSync(`${out}/t-messages.png`, charts.rankChart('Membres les plus actifs', 'Messages', named, 'msg'));
fs.writeFileSync(`${out}/t-heures.png`, charts.hoursChart(s.hours, '30 derniers jours'));
fs.writeFileSync(`${out}/t-vide.png`, charts.growthChart([{ key: '2026-10-18', members: null, joins: 0, leaves: 0 }], 'x'));
fs.writeFileSync(`${out}/t-un-point.png`, charts.growthChart([{ key: '2026-10-18', members: 221, joins: 0, leaves: 0 }], '1 jour'));
console.log('OK ✅ stats : données et images générées');
