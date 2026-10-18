process.env.DATA_DIR = require('os').tmpdir() + '/inv-test-' + Date.now();
const assert = require('assert');
const { detectInviter } = require('../invitelog');
const M = (o) => new Map(Object.entries(o));
// 1) un lien dont le compteur monte
assert.strictEqual(detectInviter(M({ a: { uses: 2, max: 0, inviterId: 'U1' }, b: { uses: 5, max: 0, inviterId: 'U2' } }), M({ a: { uses: 3, max: 0, inviterId: 'U1' }, b: { uses: 5, max: 0, inviterId: 'U2' } })), 'U1');
// 2) nouveau lien déjà utilisé une fois
assert.strictEqual(detectInviter(M({ a: { uses: 2, max: 0, inviterId: 'U1' } }), M({ a: { uses: 2, max: 0, inviterId: 'U1' }, c: { uses: 1, max: 0, inviterId: 'U3' } })), 'U3');
// 3) lien à usage unique qui disparaît
assert.strictEqual(detectInviter(M({ s: { uses: 0, max: 1, inviterId: 'U4' } }), M({})), 'U4');
// 4) lien personnalisé / rien ne bouge : inconnu
assert.strictEqual(detectInviter(M({ a: { uses: 2, max: 0, inviterId: 'U1' } }), M({ a: { uses: 2, max: 0, inviterId: 'U1' } })), null);
// 5) ambigu : deux liens différents bougent en même temps
assert.strictEqual(detectInviter(M({ a: { uses: 1, max: 0, inviterId: 'U1' }, b: { uses: 1, max: 0, inviterId: 'U2' } }), M({ a: { uses: 2, max: 0, inviterId: 'U1' }, b: { uses: 2, max: 0, inviterId: 'U2' } })), null);
// 6) deux liens du même parrain : on le connaît quand même
assert.strictEqual(detectInviter(M({ a: { uses: 1, max: 0, inviterId: 'U1' }, b: { uses: 1, max: 0, inviterId: 'U1' } }), M({ a: { uses: 2, max: 0, inviterId: 'U1' }, b: { uses: 2, max: 0, inviterId: 'U1' } })), 'U1');
console.log('OK ✅ journal des invitations : attribution du parrain');
