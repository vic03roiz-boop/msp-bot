// Simule un membre parfait pendant 46 jours et vérifie les totaux annoncés dans le plan.
process.env.DATA_DIR = require('os').tmpdir() + '/bonbons-test';
const assert = require('assert');
const engine = require('../engine');
const cfg = require('../config');

function run({ msgs, voice, jeu, days }) {
  const u = engine.createUser();
  const tot = {};
  const add = (g) => g.forEach((x) => { tot[x.category] = (tot[x.category] || 0) + x.amount; });
  const start = Date.parse(`${cfg.eventStart}T10:00:00Z`);
  for (let d = 0; d < 46; d++) {
    if (days && !days(d)) continue;
    const t0 = start + d * 864e5;
    const ctx = engine.getCtx(t0);
    assert(ctx, `jour ${d} hors événement`);
    for (let m = 0; m < msgs; m++) add(engine.onMessage(u, t0 + m * 31000, 10, ctx));
    for (let v = 0; v < voice; v++) add(engine.onVoiceMinute(u, ctx));
    if (jeu) add(engine.onGame(u, d % 2 ? 'drop' : 'jeu', ctx));
  }
  return { u, tot, sum: Object.values(tot).reduce((a, b) => a + b, 0) };
}

// Membre parfait : 150 msgs, 70 min de vocal, 1 jeu par jour, tous les jours
const perfect = run({ msgs: 150, voice: 70, jeu: true });
console.log('Membre parfait :', perfect.tot, 'total', perfect.sum);
assert.strictEqual(perfect.tot.jour, 4600, 'missions du jour = 4600');
assert.strictEqual(perfect.tot.serie, 1500, 'séries = 1500');
assert.strictEqual(perfect.tot.fidelite, 1000, 'fidélité = 1000');
assert.strictEqual(perfect.tot.semaine, 1700, 'semaines = 1700');
assert.strictEqual(perfect.tot.succes, 800, 'succès sans parrainage/giveaway = 800');
// + 2 succès (premier giveaway, premier parrainage) = 200, + parrainage 1200 + boost 500 + giveaways 500 => 12000
const rest = 200 + 1200 + 500 + 500;
assert.strictEqual(perfect.sum + rest, 12000, 'maximum théorique = 12000');

// Occasionnel : 15 jours sur 46, 30 messages, un peu de vocal
const casual = run({ msgs: 30, voice: 25, jeu: false, days: (d) => d % 3 === 0 });
console.log('Occasionnel (1 jour sur 3) :', casual.sum, 'bonbons');
assert(casual.sum > 100 && casual.sum < 1500);

// Anti-spam : 100 messages sans écart de 30 s = 1 seul compté
const u = engine.createUser();
const ctx = engine.getCtx(Date.parse(`${cfg.eventStart}T10:00:00Z`));
for (let i = 0; i < 100; i++) engine.onMessage(u, 1e12 + i * 100, 10, ctx);
assert.strictEqual(u.stats.msgs, 1, 'anti-spam 30 s');
assert.deepStrictEqual(engine.onMessage(u, 10 ** 12, 3, ctx), [], 'messages < 5 caractères ignorés');
assert.strictEqual(engine.getCtx(Date.parse('2026-10-15T10:00:00Z')), null, 'avant le 16 octobre : pas d’événement');
assert.strictEqual(engine.getCtx(Date.parse('2026-12-01T10:00:00Z')), null, 'après le 30 novembre : pas d’événement');

console.log('OK ✅ tous les contrôles passent');
