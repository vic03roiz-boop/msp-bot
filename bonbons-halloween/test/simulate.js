// Simule plusieurs profils de membres sur 45 jours et vérifie les totaux.
process.env.DATA_DIR = require('os').tmpdir() + '/bonbons-test';
const assert = require('assert');
const engine = require('../engine');
const cfg = require('../config');

function run({ msgs, voice, games, days }) {
  const u = engine.createUser();
  const tot = {};
  const add = (g) => g.forEach((x) => { tot[x.category] = (tot[x.category] || 0) + x.amount; });
  const start = Date.parse(`${cfg.eventStart}T10:00:00Z`);
  const TOTAL = engine.getCtx(start).total;
  for (let d = 0; d < TOTAL; d++) {
    if (days && !days(d)) continue;
    const t0 = start + d * 864e5;
    const ctx = engine.getCtx(t0);
    assert(ctx, `jour ${d} hors événement`);
    for (let m = 0; m < msgs; m++) add(engine.onMessage(u, t0 + m * 31000, 10, ctx, `message numéro ${d}-${m}`));
    for (let v = 0; v < voice; v++) add(engine.onVoiceMinute(u, ctx));
    for (let g = 0; g < games; g++) add(engine.onGame(u, g === 1 ? 'drop' : 'jeu', ctx));
  }
  return { u, tot, sum: Object.values(tot).reduce((a, b) => a + b, 0) };
}
const cit = (n) => `${Math.floor(n / 150)} citrouille(s)`;

// 1) Membre parfait : 500 msgs, 6 h de vocal, 3 jeux, tous les jours
const perfect = run({ msgs: 500, voice: 360, games: 3 });
console.log('Membre parfait :', perfect.tot, 'total', perfect.sum);
assert.strictEqual(perfect.tot.jour, 1530, 'missions du jour = 45 x 34');
assert.strictEqual(perfect.tot.serie, 1010, 'séries');
assert.strictEqual(perfect.tot.fidelite, 370, 'fidélité');
assert.strictEqual(perfect.tot.semaine, 2020, 'semaines (6 x 300 + 220)');
assert.strictEqual(perfect.tot.succes, 5060, 'succès accessibles seul');
// hors simulation : parrainage 1200 + boost 500 + giveaways 100 + succès giveaway 80 + succès parrainage 130
const rest = 1200 + 500 + 100 + 80 + 130;
assert.strictEqual(perfect.sum + rest, 12000, 'maximum théorique = 12000 (80 citrouilles)');

// 2) Profils réalistes
const profils = [
  ['Occasionnel : 1 jour sur 3, 60 msgs, 1 jeu', { msgs: 60, voice: 0, games: 1, days: (d) => d % 3 === 0 }],
  ['Régulier : tous les jours, 100 msgs, 1 jeu', { msgs: 100, voice: 0, games: 1 }],
  ['Actif : tous les jours, 150 msgs, 40 min de vocal, 1 jeu', { msgs: 150, voice: 40, games: 1 }],
  ['Très actif : tous les jours, 300 msgs, 1 h 40 de vocal, 3 jeux', { msgs: 300, voice: 100, games: 3 }],
];
for (const [nom, p] of profils) {
  const r = run(p);
  console.log(`${nom} -> ${r.sum} bonbons (${cit(r.sum)})`);
}
assert(run(profils[0][1]).sum < 500, 'occasionnel < 500');

// 3) Anti-spam
const u = engine.createUser();
const ctx = engine.getCtx(Date.parse(`${cfg.eventStart}T10:00:00Z`));
for (let i = 0; i < 100; i++) engine.onMessage(u, 1e12 + i * 100, 10, ctx, `m${i}`);
assert.strictEqual(u.stats.msgs, 1, 'anti-spam 30 s');
assert.deepStrictEqual(engine.onMessage(u, 2e12, 3, ctx, 'abc'), [], 'messages < 5 caractères ignorés');
const v = engine.createUser();
engine.onMessage(v, 1e12, 10, ctx, 'Salut tout le monde');
engine.onMessage(v, 1e12 + 60000, 10, ctx, 'salut tout le monde ');
assert.strictEqual(v.stats.msgs, 1, 'message copié-collé ignoré');
assert.strictEqual(engine.getCtx(Date.parse('2026-10-16T10:00:00Z')), null, 'avant le 17 octobre : pas d’événement');
assert.strictEqual(engine.getCtx(Date.parse('2026-12-01T10:00:00Z')), null, 'après le 30 novembre : pas d’événement');

console.log('OK ✅ tous les contrôles passent');
