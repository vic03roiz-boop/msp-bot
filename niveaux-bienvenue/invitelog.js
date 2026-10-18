// Journal des invitations (style InviteLogger) : qui a invité qui à l'arrivée, qui est parti et par qui il avait été invité.
// Messages envoyés dans INVITE_LOG_CHANNEL_ID (salon réservé aux admins). Sans cette variable, rien n'est publié.
const fs = require('fs');
const path = require('path');
const { Events, escapeMarkdown } = require('discord.js');
const themes = require('./themes');

const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'invites-log.json');
fs.mkdirSync(DIR, { recursive: true });
let db = { members: {}, counts: {}, baselined: {} }; // members: id -> { inviter, joinedAt } · counts: nombre d'invitations par parrain
try { if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch (e) { console.error('[invites] fichier illisible', e.message); }
let timer = null;
const saveNow = () => { clearTimeout(timer); timer = null; fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(db)); fs.renameSync(`${FILE}.tmp`, FILE); };
const save = () => { if (!timer) timer = setTimeout(saveNow, 3000); };
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { saveNow(); } catch {} });

/**
 * Quelle invitation vient d'être utilisée ? before / after : Map code -> { uses, max, inviterId }.
 * Renvoie l'identifiant du parrain, ou null si on ne sait pas (lien personnalisé, plusieurs candidates...).
 */
function detectInviter(before, after) {
  const found = [];
  for (const [code, a] of after) { const b = before.get(code); if (b && a.uses > b.uses) found.push(a.inviterId); else if (!b && a.uses > 0) found.push(a.inviterId); }
  // invitation à usage limité : elle disparaît quand le dernier usage est consommé
  for (const [code, b] of before) if (!after.has(code) && b.max > 0 && b.uses + 1 >= b.max) found.push(b.inviterId);
  const uniq = [...new Set(found.filter(Boolean))];
  return found.length === 1 || uniq.length === 1 ? (uniq[0] || null) : null;
}

const snapshot = (list) => new Map([...list.values()].map((i) => [i.code, { uses: i.uses ?? 0, max: i.maxUses ?? 0, inviterId: i.inviter?.id || null }]));
const bold = (t) => `**${escapeMarkdown(String(t))}**`;

function register(client) {
  const GUILD = () => process.env.GUILD_ID || '';
  const LOG = () => (process.env.INVITE_LOG_CHANNEL_ID || '').trim();
  let cache = new Map();

  const refresh = async (guild) => {
    const list = await guild.invites.fetch().catch(() => null);
    if (!list) return null;
    const before = cache;
    cache = snapshot(list);
    // première fois qu'on voit un parrain : son compteur part du total de ses liens actuels
    const perInviter = {};
    for (const v of cache.values()) if (v.inviterId) perInviter[v.inviterId] = (perInviter[v.inviterId] || 0) + v.uses;
    for (const [id, n] of Object.entries(perInviter)) if (!db.baselined[id]) { db.baselined[id] = true; db.counts[id] = (db.counts[id] || 0) + n; }
    save();
    return { before, after: cache };
  };
  const send = async (payload) => {
    const id = LOG();
    if (!id) return;
    const ch = await client.channels.fetch(id).catch(() => null);
    if (ch?.isTextBased()) await ch.send({ ...payload, allowedMentions: { parse: [] } });
  };
  const nameOf = async (guild, id) => {
    const m = guild.members.cache.get(id) || (await guild.members.fetch(id).catch(() => null));
    return m ? m.displayName : (await client.users.fetch(id).catch(() => null))?.username || 'un membre inconnu';
  };

  client.on(Events.InviteCreate, (inv) => { cache.set(inv.code, { uses: inv.uses ?? 0, max: inv.maxUses ?? 0, inviterId: inv.inviter?.id || null }); });
  client.on(Events.InviteDelete, (inv) => { setTimeout(() => cache.delete(inv.code), 5000); }); // petit délai : une arrivée peut être en cours de traitement

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.guild.id !== GUILD() || member.user.bot) return;
      const snap = await refresh(member.guild);
      const inviter = snap ? detectInviter(snap.before, snap.after) : null;
      const e = themes.get(themes.currentName()).title[0];
      if (inviter && inviter !== member.id) {
        db.counts[inviter] = (db.counts[inviter] || 0) + 1;
        db.members[member.id] = { inviter, joinedAt: Date.now() };
        save();
        const n = db.counts[inviter];
        await send({ content: `${e} <@${member.id}> vient d’arriver ! Elle/Il a été invité(e) par ${bold(await nameOf(member.guild, inviter))} qui a désormais ${bold(`${n} invitation${n > 1 ? 's' : ''}`)} !` });
      } else {
        db.members[member.id] = { inviter: null, joinedAt: Date.now() };
        save();
        await send({ content: `${e} <@${member.id}> vient d’arriver ! On ne sait pas qui l’a invité(e).` });
      }
    } catch (err) { console.error('[invites] arrivée', err.message); }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      if (member.guild.id !== GUILD() || member.user?.bot) return;
      const rec = db.members[member.id];
      const who = bold(member.displayName || member.user?.username || 'Un membre');
      const text = rec?.inviter
        ? `${who} vient de partir… Elle/Il avait été invité(e) par ${bold(await nameOf(member.guild, rec.inviter))}.`
        : `${who} vient de partir… On ne sait pas qui l’avait invité(e).`;
      await send({ content: `👋 ${text}` });
    } catch (err) { console.error('[invites] départ', err.message); }
  });

  return { init: async (guild) => { await refresh(guild); } };
}

module.exports = { register, detectInviter, snapshot };
