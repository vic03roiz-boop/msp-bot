// Test de la réclamation avec un faux Discord (pas de vrai serveur).
process.env.DATA_DIR = require('os').tmpdir() + '/bonbons-test2';
require('fs').rmSync(process.env.DATA_DIR, { recursive: true, force: true });
process.env.STAFF_ROLE_ID = 'staff1';
const assert = require('assert');
const store = require('../store');
const claims = require('../claims');
const sent = [];
const channel = { id: 'c1', send: async (m) => sent.push(m), delete: async () => {} };
const guild = { id: 'g', client: { user: { id: 'bot' } }, channels: { create: async () => channel, fetch: async () => channel } };
const member = { id: 'u1', user: { username: 'Vivi' } };
(async () => {
  const u = store.user('u1');
  u.balance = 500;
  let r = await claims.createTicket(guild, member, 'p:11');
  assert(!r.error, r.error);
  assert.strictEqual(u.balance, 0, '500 au palier 500 -> 0');
  assert(u.claimedPaliers.includes(11));
  assert((await claims.createTicket(guild, member, 'p:1')).error, 'un seul ticket ouvert');
  const staff = { roles: { cache: { has: () => true } }, permissions: { has: () => true } };
  const replies = [];
  const i = (id) => ({ customId: id, user: { id: 'st' }, member: staff, guild, channel, message: {}, reply: async (x) => replies.push(x), update: async () => {} });
  await claims.handleComponent(i('tk_take:1'));
  await claims.handleComponent(i('tk_cancel:1'));
  assert.strictEqual(u.balance, 500, 'remboursement');
  assert(!u.claimedPaliers.includes(11), 'palier de nouveau réclamable');
  r = await claims.createTicket(guild, member, 'p:11');
  await claims.handleComponent(i('tk_done:2'));
  assert.strictEqual(store.db.tickets[2].status, 'done');
  assert((await claims.createTicket(guild, member, 'p:11')).error, 'palier une seule fois');
  // plafond autographes
  u.balance = 1000; u.autographes = 90;
  assert((await claims.createTicket(guild, member, 'a:20')).error, 'plafond 100 autographes');
  r = await claims.createTicket(guild, member, 'a:10');
  assert(!r.error && u.balance === 950, 'autographes 5:1');
  // stock épuisé
  store.db.stock.p4 = 0; u.balance = 1000;
  await claims.handleComponent(i('tk_done:3'));
  assert((await claims.createTicket(guild, member, 'p:4')).error, 'stock épuisé');
  console.log('OK ✅ réclamation / ticket / remboursement / plafond / stock');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
