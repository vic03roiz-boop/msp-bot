// Vérifie le branchement dans un faux client qui a client.commands (comme ton bot).
process.env.DATA_DIR = require('os').tmpdir() + '/bonbons-test3';
const { Collection, Events } = require('discord.js');
const EventEmitter = require('events');
const assert = require('assert');
const c = new EventEmitter();
c.commands = new Collection();
c.isReady = () => false;
c.once = c.once.bind(c);
c.guilds = { cache: new Map() };
const bonbons = require('..');
bonbons.init(c, { getGuildConfig: () => ({ ticketCategoryId: 'cat1', ticketStaffRoleIds: ['r1'] }) });
for (const n of ['solde', 'recompenses', 'boutique', 'autographes', 'stock', 'bonbons']) assert(c.commands.get(n), n);
const j = [...c.commands.values()].map((x) => x.data.toJSON());
assert.strictEqual(j.length, 6);
assert(require('../runtime').ticketCategoryId() === 'cat1' && require('../runtime').staffRoleIds()[0] === 'r1');
console.log('OK ✅ 6 commandes ajoutées à client.commands, réglages des tickets repris de ton bot');
process.exit(0);
