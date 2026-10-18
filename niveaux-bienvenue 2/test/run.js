process.env.DATA_DIR = require('os').tmpdir() + '/niv-test-' + Date.now();
const assert = require('assert'), fs = require('fs');
const L = require('../levels'), cards = require('../cards');
assert.strictEqual(L.levelOf(0).level, 0);
assert.strictEqual(L.levelOf(100).level, 1);
assert.strictEqual(L.levelOf(L.totalForLevel(25)).level, 25);
assert.strictEqual(L.levelOf(L.totalForLevel(25) - 1).level, 24);
// messages : cooldown 60 s, 5 caractères minimum
const id = '123456789012345678';
let t = 1e12;
assert(L.onMessage(id, 10, t, () => 0));
assert.strictEqual(L.onMessage(id, 10, t + 30000, () => 0), null, 'cooldown');
assert.strictEqual(L.onMessage(id, 3, t + 90000, () => 0), null, '< 5 caractères');
assert.strictEqual(L.onMessage(id, 10, t + 61000, () => 0).gained, 15);
// import
const p = L.parseImport('id;niveau\n123456789012345679;12\n<@123456789012345680>, 7\nn’importe quoi\n');
assert.strictEqual(p.ok.length, 2); assert.strictEqual(p.bad.length, 1);
L.applyImport(p);
assert.strictEqual(L.info('123456789012345679').level, 12);
assert.strictEqual(L.info('123456789012345679').rank, 1);
const info = L.info('123456789012345680');
(async () => {
  const out = process.argv[2] || require('os').tmpdir();
  fs.writeFileSync(`${out}/n-rang.png`, await cards.rankCard({ name: 'Lili🎃 MSP', avatarUrl: null, ...info, level: 12, into: 640, need: L.need(12), rank: 2, total: 48, xp: 8123 }));
  fs.writeFileSync(`${out}/n-bienvenue.png`, await cards.welcomeCard({ name: 'Sarah_MSP', avatarUrl: null, bannerUrl: null, memberCount: 221, serverName: 'MovieStarPlanet FR 🎃' }));
  console.log('OK ✅ niveaux : formule, cooldown, import, images');
})();
(async () => {
  const out = process.argv[2] || require('os').tmpdir();
  for (const th of ['halloween', 'automne', 'noel', 'hiver']) {
    fs.writeFileSync(`${out}/n-niveau-${th}.png`, await cards.levelUpCard({ name: 'Sarah_MSP', avatarUrl: null, from: 11, to: 12, theme: th }));
  }
  const L2 = require('../levels'); L2.setLevel('999999999999999999', 5); L2.forget('999999999999999999');
  assert.strictEqual(L2.info('999999999999999999').xp, 0, 'forget');
  console.log('OK ✅ cartes de passage de niveau + oubli');
})();

(async () => {
  const out = process.argv[2] || require('os').tmpdir();
  const th = require('../themes');
  assert.strictEqual(th.seasonAt(Date.parse('2026-10-20T10:00:00Z')), 'halloween');
  assert.strictEqual(th.seasonAt(Date.parse('2026-11-15T10:00:00Z')), 'automne');
  assert.strictEqual(th.seasonAt(Date.parse('2026-12-25T10:00:00Z')), 'noel');
  assert.strictEqual(th.seasonAt(Date.parse('2027-01-05T10:00:00Z')), 'noel');
  assert.strictEqual(th.seasonAt(Date.parse('2027-01-20T10:00:00Z')), 'hiver');
  for (const n of ['halloween', 'noel']) {
    fs.writeFileSync(`${out}/n-rang-${n}.png`, await cards.rankCard({ name: 'Lili MSP', avatarUrl: null, level: 12, into: 640, need: 1420, rank: 2, total: 48, xp: 8123, theme: n }));
    fs.writeFileSync(`${out}/n-bienvenue-${n}.png`, await cards.welcomeCard({ name: 'Sarah_MSP', avatarUrl: null, bannerUrl: null, memberCount: 221, serverName: 'MovieStarPlanet FR', theme: n }));
  }
  console.log(th.levelMessage('halloween', '@Sarah', 12));
  console.log('OK ✅ saisons');
})();
