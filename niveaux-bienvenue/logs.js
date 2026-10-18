// Journaux du serveur, façon Carl-bot : messages modifiés / supprimés, membres, rôles, salons, vocal, serveur, modération.
// Chaque catégorie peut aller dans son propre salon staff :
//   /logs-config salon categorie salon     choisir le salon d’une catégorie (ou « toutes »)
//   /logs-config desactiver categorie      couper une catégorie
//   /logs-config ignorer salon             ne pas logger les messages / le vocal d’un salon (re-taper pour réactiver)
//   /logs-config voir                      récapitulatif
// Variables Railway facultatives (au lieu de la commande) :
//   LOG_CHANNEL_ID           un seul salon pour tout
//   LOG_MESSAGES_CHANNEL_ID, LOG_MEMBRES_CHANNEL_ID, LOG_MODERATION_CHANNEL_ID, LOG_ROLES_CHANNEL_ID,
//   LOG_SALONS_CHANNEL_ID, LOG_VOCAL_CHANNEL_ID, LOG_SERVEUR_CHANNEL_ID
//   LOG_ARRIVEES=false       ne pas logger les arrivées / départs (si tu as déjà un salon d’invitations)
// Le bot doit avoir la permission « Voir les logs du serveur » pour indiquer QUI a fait l’action (qui a banni, qui a supprimé…).
// Intents à activer dans index.js : GuildModeration (bans) et GuildEmojisAndStickers (émojis). Sans eux, seuls ces deux types de logs manquent.
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder, AuditLogEvent, Events, ChannelType } = require('discord.js');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'logs.json');
const CACHE_FILE = path.join(DIR, 'logs-cache.json');
const GUILD = () => process.env.GUILD_ID || '';

const CATS = { messages: '💬 Messages', membres: '👤 Membres', moderation: '🔨 Modération', roles: '🏷️ Rôles', salons: '📁 Salons', vocal: '🔊 Vocal', serveur: '⚙️ Serveur' };
let cfg = { channels: {}, ignore: [] }; // channels: cat -> channelId | 'off'
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(cfg)); } catch (e) { console.error('[logs] sauvegarde', e.message); } }

// ---- mémoire des messages (pour retrouver le texte d’un message supprimé ou modifié, même ancien) ----
const CACHE_MAX = 8000;
let cache = new Map();
try { for (const m of JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))) cache.set(m.id, m); } catch {}
let dirty = false;
function remember(m) {
  cache.set(m.id, m); dirty = true;
  if (cache.size > CACHE_MAX) { const first = cache.keys().next().value; cache.delete(first); }
}
const toEntry = (m) => ({ id: m.id, ch: m.channelId, au: m.author?.id, tag: m.author?.username, av: m.author?.displayAvatarURL?.(), c: (m.content || '').slice(0, 1900), at: [...(m.attachments?.values?.() || [])].map((a) => a.url).slice(0, 8), ts: m.createdTimestamp });

const chanFor = (cat) => {
  const v = cfg.channels[cat];
  if (v === 'off') return null;
  return v || process.env[`LOG_${cat.toUpperCase()}_CHANNEL_ID`] || process.env.LOG_CHANNEL_ID || null;
};
async function send(client, cat, payload) {
  const id = chanFor(cat); if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  if (!ch?.isTextBased()) return;
  if (payload.setTimestamp) payload = { embeds: [payload] };
  ch.send({ ...payload, allowedMentions: { parse: [] } }).catch((e) => console.error('[logs] envoi', e.message));
}
const logChannels = () => new Set([...Object.values(cfg.channels), process.env.LOG_CHANNEL_ID, ...Object.keys(CATS).map((c) => process.env[`LOG_${c.toUpperCase()}_CHANNEL_ID`])].filter(Boolean));
const ignored = (chId) => cfg.ignore.includes(chId) || logChannels().has(chId);

/** Cherche dans le journal d’audit QUI a fait une action récente (null si pas de permission ou rien de récent). */
async function audit(guild, type, targetId, ms = 10000) {
  try {
    const res = await guild.fetchAuditLogs({ type, limit: 8 });
    return res.entries.find((e) => Date.now() - e.createdTimestamp < ms && (!targetId || e.targetId === targetId)) || null;
  } catch { return null; }
}
const COL = { vert: 0x7BC47F, rouge: 0xE06C75, jaune: 0xE5C07B, bleu: 0x61AFEF, violet: 0xC678DD, gris: 0x9AA0A6 };
const cut = (s, n = 1000) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '*(vide)*');
const dt = (t) => `<t:${Math.floor(t / 1000)}:f> (<t:${Math.floor(t / 1000)}:R>)`;
const by = (e) => (e?.executor ? `<@${e.executor.id}>` : null);
function emb(color, title, user, desc) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (user) e.setAuthor({ name: user.username || user.tag || String(user.id), iconURL: user.displayAvatarURL?.() || user.av });
  if (desc) e.setDescription(desc);
  return e;
}
const pName = (b) => new (require('discord.js').PermissionsBitField)(b).toArray();

// ---- commande de configuration ----
const catChoices = Object.entries(CATS).map(([v, n]) => ({ name: n.replace(/^\S+\s/, ''), value: v }));
const defs = [
  new SlashCommandBuilder().setName('logs-config').setDescription('(Staff) Configurer les journaux du serveur').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('salon').setDescription('Choisir le salon d’une catégorie de logs')
      .addStringOption((o) => o.setName('categorie').setDescription('Quels logs').setRequired(true).addChoices(...catChoices, { name: 'Toutes les catégories', value: 'toutes' }))
      .addChannelOption((o) => o.setName('salon').setDescription('Salon staff').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('desactiver').setDescription('Couper une catégorie de logs')
      .addStringOption((o) => o.setName('categorie').setDescription('Quels logs').setRequired(true).addChoices(...catChoices, { name: 'Toutes les catégories', value: 'toutes' })))
    .addSubcommand((s) => s.setName('ignorer').setDescription('Ne pas logger les messages / le vocal d’un salon (re-taper pour réactiver)')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon à ignorer').setRequired(true)))
    .addSubcommand((s) => s.setName('voir').setDescription('Voir la configuration actuelle')),
];
const NAMES = defs.map((d) => d.name);

async function run(i) {
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const sub = i.options.getSubcommand();
  if (sub === 'salon') {
    const cat = i.options.getString('categorie'), ch = i.options.getChannel('salon');
    for (const c of cat === 'toutes' ? Object.keys(CATS) : [cat]) cfg.channels[c] = ch.id;
    save();
    return i.reply({ content: `✅ ${cat === 'toutes' ? 'Tous les logs' : `Logs « ${CATS[cat]} »`} → <#${ch.id}>`, flags: EPHEMERAL });
  }
  if (sub === 'desactiver') {
    const cat = i.options.getString('categorie');
    for (const c of cat === 'toutes' ? Object.keys(CATS) : [cat]) cfg.channels[c] = 'off';
    save();
    return i.reply({ content: `🔕 ${cat === 'toutes' ? 'Tous les logs sont coupés' : `Logs « ${CATS[cat]} » coupés`}.`, flags: EPHEMERAL });
  }
  if (sub === 'ignorer') {
    const ch = i.options.getChannel('salon'), k = cfg.ignore.indexOf(ch.id);
    if (k >= 0) cfg.ignore.splice(k, 1); else cfg.ignore.push(ch.id);
    save();
    return i.reply({ content: k >= 0 ? `👁️ <#${ch.id}> est de nouveau surveillé.` : `🙈 <#${ch.id}> est ignoré (messages et vocal).`, flags: EPHEMERAL });
  }
  const lignes = Object.entries(CATS).map(([c, n]) => { const id = chanFor(c); return `${n} → ${id ? `<#${id}>` : '*désactivé*'}`; });
  const ign = cfg.ignore.length ? `\n\n**Salons ignorés :** ${cfg.ignore.map((x) => `<#${x}>`).join(' ')}` : '';
  return i.reply({ embeds: [new EmbedBuilder().setColor(COL.bleu).setTitle('Journaux du serveur').setDescription(lignes.join('\n') + ign)], flags: EPHEMERAL });
}

// ---- écoute des évènements ----
function register(client) {
  const ok = (guild) => guild && guild.id === GUILD();
  const L = (cat, payload) => send(client, cat, payload);

  // sauvegarde périodique de la mémoire des messages
  setInterval(() => { if (!dirty) return; dirty = false; try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify([...cache.values()])); } catch {} }, 2 * 60 * 1000).unref();

  // ===== MESSAGES =====
  client.on(Events.MessageCreate, (m) => { if (ok(m.guild) && !m.author?.bot) remember(toEntry(m)); });

  client.on(Events.MessageUpdate, async (oldM, newM) => {
    try {
      if (!ok(newM.guild) || ignored(newM.channelId)) return;
      if (newM.partial) newM = await newM.fetch().catch(() => newM);
      if (newM.author?.bot) return;
      const prev = cache.get(newM.id), before = prev ? prev.c : (oldM.partial ? null : oldM.content), after = newM.content || '';
      if (before !== null && before === after) { if (prev) { remember({ ...prev, c: after.slice(0, 1900) }); } return; }
      const e = emb(COL.jaune, 'Message modifié', newM.author, `**Message modifié dans <#${newM.channelId}>** · [Aller au message](${newM.url})`)
        .addFields({ name: 'Avant', value: before === null ? '*(inconnu : message envoyé avant que je le surveille)*' : cut(before) }, { name: 'Après', value: cut(after) })
        .setFooter({ text: `Auteur : ${newM.author?.id} · Message : ${newM.id}` });
      L('messages', e);
      remember({ ...(prev || toEntry(newM)), c: after.slice(0, 1900) });
    } catch (err) { console.error('[logs] edit', err.message); }
  });

  client.on(Events.MessageDelete, async (m) => {
    try {
      if (!ok(m.guild) || ignored(m.channelId)) return;
      const prev = cache.get(m.id);
      const author = m.author || (prev ? { id: prev.au, username: prev.tag, displayAvatarURL: () => prev.av } : null);
      if (author?.bot) return;
      const content = m.content ?? prev?.c, files = prev?.at?.length ? prev.at : [...(m.attachments?.values?.() || [])].map((a) => a.url);
      const e = emb(COL.rouge, 'Message supprimé', author, `**Message supprimé dans <#${m.channelId}>**`)
        .addFields({ name: 'Contenu', value: content === undefined || content === null ? '*(inconnu : message envoyé avant que je le surveille)*' : cut(content) });
      if (files.length) e.addFields({ name: 'Pièces jointes', value: cut(files.join('\n')) });
      const ent = await audit(m.guild, AuditLogEvent.MessageDelete, author?.id, 6000);
      if (ent && by(ent)) e.addFields({ name: 'Supprimé par', value: by(ent), inline: true });
      e.setFooter({ text: `Auteur : ${author?.id || '?'} · Message : ${m.id}` });
      L('messages', e);
      cache.delete(m.id); dirty = true;
    } catch (err) { console.error('[logs] delete', err.message); }
  });

  client.on(Events.MessageBulkDelete, async (msgs, channel) => {
    try {
      if (!ok(channel.guild) || ignored(channel.id)) return;
      const lines = [...msgs.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).map((m) => {
        const p = cache.get(m.id), who = m.author?.username || p?.tag || '?', txt = m.content ?? p?.c ?? '(inconnu)';
        return `[${new Date(m.createdTimestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}] ${who} : ${txt}`;
      });
      const ent = await audit(channel.guild, AuditLogEvent.MessageBulkDelete, null, 8000);
      const e = emb(COL.rouge, 'Suppression en masse', null, `**${msgs.size} messages supprimés dans <#${channel.id}>**${by(ent) ? `\nPar ${by(ent)}` : ''}`);
      L('messages', { embeds: [e], files: [new AttachmentBuilder(Buffer.from(lines.join('\n') || 'Aucun contenu connu.', 'utf8'), { name: `messages-supprimes-${channel.name}.txt` })] });
      for (const id of msgs.keys()) cache.delete(id); dirty = true;
    } catch (err) { console.error('[logs] bulk', err.message); }
  });

  // ===== MEMBRES =====
  client.on(Events.GuildMemberAdd, (m) => {
    if (!ok(m.guild) || process.env.LOG_ARRIVEES === 'false') return;
    L('membres', emb(COL.vert, 'Un membre a rejoint', m.user, `${m.user} · **${m.guild.memberCount}e membre**`)
      .addFields({ name: 'Compte créé', value: dt(m.user.createdTimestamp) }).setThumbnail(m.user.displayAvatarURL()).setFooter({ text: `ID : ${m.id}` }));
  });
  client.on(Events.GuildMemberRemove, async (m) => {
    if (!ok(m.guild)) return;
    const kick = await audit(m.guild, AuditLogEvent.MemberKick, m.id, 8000);
    const roles = m.roles?.cache?.filter((r) => r.id !== m.guild.id).map((r) => `<@&${r.id}>`).join(' ') || '*aucun*';
    if (kick) {
      L('moderation', emb(COL.rouge, 'Membre expulsé', m.user, `${m.user}`).addFields({ name: 'Par', value: by(kick) || '?', inline: true }, { name: 'Raison', value: cut(kick.reason || 'Aucune raison'), inline: true }).setFooter({ text: `ID : ${m.id}` }));
    }
    if (process.env.LOG_ARRIVEES === 'false') return;
    L('membres', emb(COL.rouge, kick ? 'Membre parti (expulsé)' : 'Un membre est parti', m.user, `${m.user}`)
      .addFields({ name: 'Avait rejoint', value: m.joinedTimestamp ? dt(m.joinedTimestamp) : '*inconnu*' }, { name: 'Rôles', value: cut(roles) }).setThumbnail(m.user.displayAvatarURL()).setFooter({ text: `ID : ${m.id}` }));
  });
  client.on(Events.GuildBanAdd, async (b) => {
    if (!ok(b.guild)) return;
    const ent = await audit(b.guild, AuditLogEvent.MemberBanAdd, b.user.id, 10000);
    L('moderation', emb(COL.rouge, 'Membre banni', b.user, `${b.user}`).addFields({ name: 'Par', value: by(ent) || '?', inline: true }, { name: 'Raison', value: cut(ent?.reason || b.reason || 'Aucune raison'), inline: true }).setFooter({ text: `ID : ${b.user.id}` }));
  });
  client.on(Events.GuildBanRemove, async (b) => {
    if (!ok(b.guild)) return;
    const ent = await audit(b.guild, AuditLogEvent.MemberBanRemove, b.user.id, 10000);
    L('moderation', emb(COL.vert, 'Membre débanni', b.user, `${b.user}`).addFields({ name: 'Par', value: by(ent) || '?', inline: true }).setFooter({ text: `ID : ${b.user.id}` }));
  });
  client.on(Events.GuildMemberUpdate, async (o, n) => {
    try {
      if (!ok(n.guild)) return;
      if (o.partial) return;
      // pseudo
      if (o.nickname !== n.nickname) {
        const ent = await audit(n.guild, AuditLogEvent.MemberUpdate, n.id, 8000);
        L('membres', emb(COL.bleu, 'Pseudo modifié', n.user, `${n.user}`).addFields({ name: 'Avant', value: o.nickname || '*aucun*', inline: true }, { name: 'Après', value: n.nickname || '*aucun*', inline: true }, ...(by(ent) && ent.executor.id !== n.id ? [{ name: 'Par', value: by(ent), inline: true }] : [])).setFooter({ text: `ID : ${n.id}` }));
      }
      // rôles
      const added = n.roles.cache.filter((r) => !o.roles.cache.has(r.id)), removed = o.roles.cache.filter((r) => !n.roles.cache.has(r.id));
      if (added.size || removed.size) {
        const ent = await audit(n.guild, AuditLogEvent.MemberRoleUpdate, n.id, 8000);
        const e = emb(added.size && !removed.size ? COL.vert : removed.size && !added.size ? COL.rouge : COL.jaune, 'Rôles du membre modifiés', n.user, `${n.user}`);
        if (added.size) e.addFields({ name: '➕ Ajoutés', value: added.map((r) => `<@&${r.id}>`).join(' ') });
        if (removed.size) e.addFields({ name: '➖ Retirés', value: removed.map((r) => `<@&${r.id}>`).join(' ') });
        if (by(ent)) e.addFields({ name: 'Par', value: by(ent), inline: true });
        L('membres', e.setFooter({ text: `ID : ${n.id}` }));
      }
      // sourdine (timeout)
      const t0 = o.communicationDisabledUntilTimestamp, t1 = n.communicationDisabledUntilTimestamp;
      if (t0 !== t1) {
        const ent = await audit(n.guild, AuditLogEvent.MemberUpdate, n.id, 8000);
        const on = t1 && t1 > Date.now();
        L('moderation', emb(on ? COL.violet : COL.vert, on ? 'Membre en sourdine' : 'Sourdine levée', n.user, `${n.user}`).addFields(...(on ? [{ name: 'Jusqu’à', value: dt(t1) }] : []), ...(by(ent) ? [{ name: 'Par', value: by(ent), inline: true }] : []), ...(ent?.reason ? [{ name: 'Raison', value: cut(ent.reason) }] : [])).setFooter({ text: `ID : ${n.id}` }));
      }
      // avatar de serveur
      if (o.avatar !== n.avatar) L('membres', emb(COL.bleu, 'Avatar de serveur modifié', n.user, `${n.user}`).setThumbnail(n.displayAvatarURL()).setFooter({ text: `ID : ${n.id}` }));
    } catch (err) { console.error('[logs] member', err.message); }
  });
  client.on(Events.UserUpdate, async (o, n) => {
    try {
      const g = client.guilds.cache.get(GUILD()); if (!g || !(await g.members.fetch(n.id).catch(() => null))) return;
      if (o.username !== n.username) L('membres', emb(COL.bleu, 'Nom d’utilisateur modifié', n, `${n}`).addFields({ name: 'Avant', value: o.username || '?', inline: true }, { name: 'Après', value: n.username, inline: true }).setFooter({ text: `ID : ${n.id}` }));
      if (o.avatar !== n.avatar) L('membres', emb(COL.bleu, 'Avatar modifié', n, `${n}`).setThumbnail(n.displayAvatarURL()).setFooter({ text: `ID : ${n.id}` }));
    } catch {}
  });

  // ===== RÔLES =====
  client.on(Events.GuildRoleCreate, async (r) => {
    if (!ok(r.guild)) return; const ent = await audit(r.guild, AuditLogEvent.RoleCreate, r.id, 8000);
    L('roles', emb(COL.vert, 'Rôle créé', null, `<@&${r.id}> · **${r.name}**${by(ent) ? `\nPar ${by(ent)}` : ''}`).setFooter({ text: `ID : ${r.id}` }));
  });
  client.on(Events.GuildRoleDelete, async (r) => {
    if (!ok(r.guild)) return; const ent = await audit(r.guild, AuditLogEvent.RoleDelete, r.id, 8000);
    L('roles', emb(COL.rouge, 'Rôle supprimé', null, `**${r.name}**${by(ent) ? `\nPar ${by(ent)}` : ''}`).setFooter({ text: `ID : ${r.id}` }));
  });
  client.on(Events.GuildRoleUpdate, async (o, n) => {
    if (!ok(n.guild)) return;
    const f = [];
    if (o.name !== n.name) f.push({ name: 'Nom', value: `${o.name} → ${n.name}` });
    if (o.color !== n.color) f.push({ name: 'Couleur', value: `#${o.color.toString(16).padStart(6, '0')} → #${n.color.toString(16).padStart(6, '0')}` });
    if (o.hoist !== n.hoist) f.push({ name: 'Affiché séparément', value: `${o.hoist ? 'oui' : 'non'} → ${n.hoist ? 'oui' : 'non'}` });
    if (o.mentionable !== n.mentionable) f.push({ name: 'Mentionnable', value: `${o.mentionable ? 'oui' : 'non'} → ${n.mentionable ? 'oui' : 'non'}` });
    if (o.permissions.bitfield !== n.permissions.bitfield) {
      const add = pName(n.permissions.bitfield & ~o.permissions.bitfield), rem = pName(o.permissions.bitfield & ~n.permissions.bitfield);
      if (add.length) f.push({ name: '➕ Permissions ajoutées', value: cut(add.join(', ')) });
      if (rem.length) f.push({ name: '➖ Permissions retirées', value: cut(rem.join(', ')) });
    }
    if (!f.length) return;
    const ent = await audit(n.guild, AuditLogEvent.RoleUpdate, n.id, 8000);
    L('roles', emb(COL.jaune, 'Rôle modifié', null, `<@&${n.id}>${by(ent) ? ` · par ${by(ent)}` : ''}`).addFields(f).setFooter({ text: `ID : ${n.id}` }));
  });

  // ===== SALONS =====
  const chType = (c) => ({ [ChannelType.GuildText]: 'Texte', [ChannelType.GuildVoice]: 'Vocal', [ChannelType.GuildCategory]: 'Catégorie', [ChannelType.GuildAnnouncement]: 'Annonces', [ChannelType.GuildForum]: 'Forum', [ChannelType.GuildStageVoice]: 'Conférence' }[c.type] || 'Salon');
  client.on(Events.ChannelCreate, async (c) => {
    if (!ok(c.guild)) return; const ent = await audit(c.guild, AuditLogEvent.ChannelCreate, c.id, 8000);
    L('salons', emb(COL.vert, 'Salon créé', null, `<#${c.id}> · **${c.name}** (${chType(c)})${by(ent) ? `\nPar ${by(ent)}` : ''}`).setFooter({ text: `ID : ${c.id}` }));
  });
  client.on(Events.ChannelDelete, async (c) => {
    if (!ok(c.guild)) return; const ent = await audit(c.guild, AuditLogEvent.ChannelDelete, c.id, 8000);
    L('salons', emb(COL.rouge, 'Salon supprimé', null, `**${c.name}** (${chType(c)})${by(ent) ? `\nPar ${by(ent)}` : ''}`).setFooter({ text: `ID : ${c.id}` }));
  });
  client.on(Events.ChannelUpdate, async (o, n) => {
    if (!ok(n.guild)) return;
    const f = [];
    if (o.name !== n.name) f.push({ name: 'Nom', value: `${o.name} → ${n.name}` });
    if (o.topic !== n.topic && (o.topic || n.topic)) f.push({ name: 'Description', value: `${cut(o.topic || '*aucune*', 400)} → ${cut(n.topic || '*aucune*', 400)}` });
    if (o.nsfw !== n.nsfw) f.push({ name: 'NSFW', value: `${o.nsfw ? 'oui' : 'non'} → ${n.nsfw ? 'oui' : 'non'}` });
    if (o.rateLimitPerUser !== n.rateLimitPerUser) f.push({ name: 'Mode lent', value: `${o.rateLimitPerUser || 0}s → ${n.rateLimitPerUser || 0}s` });
    if (o.parentId !== n.parentId) f.push({ name: 'Catégorie', value: `${o.parent?.name || '*aucune*'} → ${n.parent?.name || '*aucune*'}` });
    const oo = o.permissionOverwrites?.cache, nn = n.permissionOverwrites?.cache;
    if (oo && nn) {
      const ch = [];
      for (const [id, ow] of nn) { const p = oo.get(id); if (!p || p.allow.bitfield !== ow.allow.bitfield || p.deny.bitfield !== ow.deny.bitfield) ch.push(ow.type === 0 ? `<@&${id}>` : `<@${id}>`); }
      for (const [id, ow] of oo) if (!nn.has(id)) ch.push(ow.type === 0 ? `<@&${id}>` : `<@${id}>`);
      if (ch.length) f.push({ name: 'Permissions modifiées pour', value: cut([...new Set(ch)].join(' ')) });
    }
    if (!f.length) return;
    const ent = await audit(n.guild, AuditLogEvent.ChannelUpdate, n.id, 8000) || await audit(n.guild, AuditLogEvent.ChannelOverwriteUpdate, n.id, 8000);
    L('salons', emb(COL.jaune, 'Salon modifié', null, `<#${n.id}>${by(ent) ? ` · par ${by(ent)}` : ''}`).addFields(f).setFooter({ text: `ID : ${n.id}` }));
  });
  client.on(Events.ThreadCreate, (t) => { if (ok(t.guild)) L('salons', emb(COL.vert, 'Fil créé', null, `<#${t.id}> · **${t.name}** dans <#${t.parentId}>`).setFooter({ text: `ID : ${t.id}` })); });
  client.on(Events.ThreadDelete, (t) => { if (ok(t.guild)) L('salons', emb(COL.rouge, 'Fil supprimé', null, `**${t.name}** dans <#${t.parentId}>`).setFooter({ text: `ID : ${t.id}` })); });

  // ===== VOCAL =====
  client.on(Events.VoiceStateUpdate, (o, n) => {
    if (!ok(n.guild)) return;
    const u = n.member?.user; if (!u || u.bot) return;
    if (o.channelId !== n.channelId) {
      if ((o.channelId && ignored(o.channelId)) && (n.channelId && ignored(n.channelId))) return;
      if (!o.channelId) { if (ignored(n.channelId)) return; L('vocal', emb(COL.vert, 'Connexion au vocal', u, `${u} a rejoint <#${n.channelId}>`).setFooter({ text: `ID : ${u.id}` })); }
      else if (!n.channelId) { if (ignored(o.channelId)) return; L('vocal', emb(COL.rouge, 'Déconnexion du vocal', u, `${u} a quitté <#${o.channelId}>`).setFooter({ text: `ID : ${u.id}` })); }
      else L('vocal', emb(COL.bleu, 'Changement de salon vocal', u, `${u} : <#${o.channelId}> → <#${n.channelId}>`).setFooter({ text: `ID : ${u.id}` }));
    }
    if (o.serverMute !== n.serverMute) L('vocal', emb(COL.violet, n.serverMute ? 'Rendu muet par le serveur' : 'Muet serveur levé', u, `${u}`).setFooter({ text: `ID : ${u.id}` }));
    if (o.serverDeaf !== n.serverDeaf) L('vocal', emb(COL.violet, n.serverDeaf ? 'Rendu sourd par le serveur' : 'Sourd serveur levé', u, `${u}`).setFooter({ text: `ID : ${u.id}` }));
  });

  // ===== SERVEUR =====
  client.on(Events.GuildUpdate, async (o, n) => {
    if (!ok(n)) return;
    const f = [];
    if (o.name !== n.name) f.push({ name: 'Nom', value: `${o.name} → ${n.name}` });
    if (o.icon !== n.icon) f.push({ name: 'Icône', value: 'modifiée' });
    if (o.banner !== n.banner) f.push({ name: 'Bannière', value: 'modifiée' });
    if (o.description !== n.description) f.push({ name: 'Description', value: `${cut(o.description || '*aucune*', 400)} → ${cut(n.description || '*aucune*', 400)}` });
    if (o.verificationLevel !== n.verificationLevel) f.push({ name: 'Niveau de vérification', value: `${o.verificationLevel} → ${n.verificationLevel}` });
    if (o.afkChannelId !== n.afkChannelId) f.push({ name: 'Salon AFK', value: `${o.afkChannelId ? `<#${o.afkChannelId}>` : '*aucun*'} → ${n.afkChannelId ? `<#${n.afkChannelId}>` : '*aucun*'}` });
    if (o.systemChannelId !== n.systemChannelId) f.push({ name: 'Salon système', value: `${o.systemChannelId ? `<#${o.systemChannelId}>` : '*aucun*'} → ${n.systemChannelId ? `<#${n.systemChannelId}>` : '*aucun*'}` });
    if (!f.length) return;
    const ent = await audit(n, AuditLogEvent.GuildUpdate, null, 8000);
    L('serveur', emb(COL.jaune, 'Serveur modifié', null, by(ent) ? `Par ${by(ent)}` : null).addFields(f));
  });
  client.on(Events.GuildEmojiCreate, async (e) => { if (!ok(e.guild)) return; const ent = await audit(e.guild, AuditLogEvent.EmojiCreate, e.id, 8000); L('serveur', emb(COL.vert, 'Émoji ajouté', null, `${e} · **:${e.name}:**${by(ent) ? `\nPar ${by(ent)}` : ''}`).setThumbnail(e.imageURL()).setFooter({ text: `ID : ${e.id}` })); });
  client.on(Events.GuildEmojiDelete, async (e) => { if (!ok(e.guild)) return; const ent = await audit(e.guild, AuditLogEvent.EmojiDelete, e.id, 8000); L('serveur', emb(COL.rouge, 'Émoji supprimé', null, `**:${e.name}:**${by(ent) ? `\nPar ${by(ent)}` : ''}`).setThumbnail(e.imageURL()).setFooter({ text: `ID : ${e.id}` })); });
  client.on(Events.GuildEmojiUpdate, (o, n) => { if (ok(n.guild) && o.name !== n.name) L('serveur', emb(COL.jaune, 'Émoji renommé', null, `${n} · **:${o.name}:** → **:${n.name}:**`).setFooter({ text: `ID : ${n.id}` })); });
  client.on(Events.InviteCreate, (inv) => { if (ok(inv.guild)) L('serveur', emb(COL.vert, 'Invitation créée', inv.inviter, `**${inv.code}** → <#${inv.channelId}>${inv.maxUses ? ` · ${inv.maxUses} utilisations max` : ''}${inv.expiresTimestamp ? ` · expire ${dt(inv.expiresTimestamp)}` : ' · n’expire jamais'}`)); });
  client.on(Events.InviteDelete, (inv) => { if (ok(inv.guild)) L('serveur', emb(COL.rouge, 'Invitation supprimée', null, `**${inv.code}** (<#${inv.channelId}>)`)); });
}

module.exports = { defs, NAMES, run, register };
