// Niveaux + cartes de rang + bienvenue en image.
//   const niveaux = require('./niveaux-bienvenue');
//   niveaux.init(client);   // UNE fois, après stats-serveur
// Variables Railway (toutes facultatives sauf GUILD_ID, déjà présent) :
//   WELCOME_CHANNEL_ID        salon de bienvenue (sinon le salon système du serveur)
//   WELCOME_RULES_CHANNEL_ID, WELCOME_ROLES_CHANNEL_ID, WELCOME_ROLES_MSP_CHANNEL_ID, WELCOME_PSEUDOS_CHANNEL_ID, WELCOME_CHAT_CHANNEL_ID : salons cités dans le message (une ligne sans salon est omise)
//   INVITE_LOG_CHANNEL_ID     salon admin du journal des invitations (« X vient d'arriver, invité par Y » / « X est parti »). Vide = désactivé
//   LEAVE_CHANNEL_ID          salon du message « au revoir » quand quelqu'un quitte (sinon le salon de bienvenue)
//   BOOST_CHANNEL_ID          salon du message « merci pour le boost » (sinon le salon de bienvenue)
//   WELCOME_BANNER_URL        lien d'une image de fond (sinon assets/banniere.png, sinon dégradé de la saison)
//   WELCOME_USE_SERVER_BANNER true : reprendre la bannière du serveur comme fond (désactivé par défaut)
//   ANNONCE_CHANNEL_ID, ANNONCE_ROLE_ID  /annonce-msp : salon et rôle pingé par défaut (facultatif, sinon choisis-les dans la commande)
//   LEVELS_ANNOUNCE_CHANNEL_ID  salon où annoncer les passages de niveau. Plus besoin de le mettre ici : tape /annonces-niveaux salon dans Discord (la commande a la priorité)
//   LEVELS_THEME                facultatif : force la saison (halloween | automne | noel | hiver). Sinon elle change toute seule avec la date
//   LEVELS_MESSAGE              facultatif : ton propre message de passage de niveau ({user} et {level})
//   LEVELS_VIEW_OTHERS          true (défaut) : les membres peuvent voir le niveau des autres ; false pour l'interdire
//   LEVELS_RESET_ON_LEAVE       true : un membre qui quitte le serveur perd son XP (défaut : false)
//   LEVELS_RESET_ON_BAN         true : un membre banni perd son XP (défaut : true)
//   LEVELS_EXCLUDED_CHANNEL_IDS salons sans XP (par défaut : les mêmes que pour les bonbons)
const fs = require('fs');
const path = require('path');
const { Events, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const levels = require('./levels');
const cards = require('./cards');
const welcome = require('./welcome');
const invitelog = require('./invitelog');
const annonces = require('./annonces');
const moderation = require('./moderation');
const logs = require('./logs');
const aide = require('./aide');
const automod = require('./automod');
const avent = require('./avent');
const scammers = require('./scammers');

const EPHEMERAL = 64;
let inv = null; // journal des invitations (créé dans init)
const GUILD_ID = () => process.env.GUILD_ID || '';
function excluded() {
  const env = (process.env.LEVELS_EXCLUDED_CHANNEL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (env.length) return env;
  try { return require('../bonbons-halloween/config').excludedChannelIds; } catch { return []; }
}
const flag = (name, dflt) => { const v = (process.env[name] || '').trim().toLowerCase(); return v ? ['true', '1', 'oui', 'yes'].includes(v) : dflt; };
const themes = require('./themes');
const THEME = () => themes.currentName();
const staffOk = (i) => i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

// Réglages modifiables depuis Discord (volume Railway) : le salon des annonces de niveau
const SETTINGS_DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'niveaux-settings.json');
let settings = {};
try { if (fs.existsSync(SETTINGS_FILE)) settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { console.error('[niveaux] réglages illisibles', e.message); }
function saveSettings() { try { fs.mkdirSync(SETTINGS_DIR, { recursive: true }); const tmp = `${SETTINGS_FILE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(settings)); fs.renameSync(tmp, SETTINGS_FILE); } catch (e) { console.error('[niveaux] réglages non sauvegardés', e.message); } }
const announceId = () => settings.announceChannelId || (process.env.LEVELS_ANNOUNCE_CHANNEL_ID || '').trim();

const DEFS = [
  new SlashCommandBuilder().setName('rang').setDescription('Ta carte de niveau')
    .addUserOption((o) => o.setName('membre').setDescription('Voir la carte d’un autre membre')),
  new SlashCommandBuilder().setName('invites').setDescription('Voir ton nombre d’invitations')
    .addUserOption((o) => o.setName('membre').setDescription('Voir celui d’un autre membre')),
  new SlashCommandBuilder().setName('classement').setDescription('Le top 10 des niveaux du serveur'),
  new SlashCommandBuilder().setName('annonces-niveaux').setDescription('(Staff) Régler les annonces de passage de niveau')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('salon').setDescription('Choisir le salon où le bot annonce les passages de niveau')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon des annonces de niveau').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
    .addSubcommand((s) => s.setName('test').setDescription('Envoyer une fausse annonce de niveau pour vérifier que tout marche'))
    .addSubcommand((s) => s.setName('off').setDescription('Arrêter les annonces de niveau')),
  new SlashCommandBuilder().setName('niveaux').setDescription('(Staff) Gérer les niveaux et la bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('definir').setDescription('Fixer le niveau d’un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption((o) => o.setName('niveau').setDescription('Niveau').setMinValue(0).setMaxValue(500).setRequired(true)))
    .addSubcommand((s) => s.setName('importer').setDescription('Importer les niveaux depuis un fichier texte (une ligne : identifiant;niveau)')
      .addAttachmentOption((o) => o.setName('fichier').setDescription('Fichier .txt ou .csv').setRequired(true))
      .addStringOption((o) => o.setName('type').setDescription('Ce que contient la 2e colonne').addChoices({ name: 'Niveau (par défaut)', value: 'niveau' }, { name: 'XP total', value: 'xp' })))
    .addSubcommand((s) => s.setName('apercu-bienvenue').setDescription('Voir l’image de bienvenue avec ton profil'))
        .addSubcommand((s) => s.setName('invitations-definir').setDescription('Fixer le nombre d’invitations d’un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption((o) => o.setName('nombre').setDescription('Nombre d’invitations').setMinValue(0).setRequired(true)))
    .addSubcommand((s) => s.setName('invitations-importer').setDescription('Importer les invitations d’InviteLogger (une ligne : pseudo;nombre)')
      .addAttachmentOption((o) => o.setName('fichier').setDescription('Fichier .txt ou .csv').setRequired(true)))
    .addSubcommand((s) => s.setName('apercu-depart').setDescription('Voir le message d’au revoir avec ton profil'))
    .addSubcommand((s) => s.setName('apercu-boost').setDescription('Voir le message de remerciement pour un boost avec ton profil'))
    .addSubcommand((s) => s.setName('annonces-salon').setDescription('Choisir le salon où le bot annonce les passages de niveau')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon des annonces de niveau').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
    .addSubcommand((s) => s.setName('annonces-test').setDescription('Envoyer une fausse annonce de niveau pour vérifier que tout marche'))
    .addSubcommand((s) => s.setName('annonces-off').setDescription('Arrêter les annonces de niveau')),
];

async function avatarOf(user) { return user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }); }

async function sendRank(i, user, name) {
  const info = levels.info(user.id);
  const buf = await cards.rankCard({ name, avatarUrl: await avatarOf(user), level: info.level, into: info.into, need: info.need, rank: info.rank, total: info.total, xp: info.xp, theme: THEME() });
  return i.editReply({ files: [new AttachmentBuilder(buf, { name: 'rang.png' })] });
}

async function welcomeFor(member) {
  const g = member.guild;
  // La bannière du serveur n'est plus reprise d'office (l'avatar cachait le nom). WELCOME_USE_SERVER_BANNER=true pour la remettre.
  const useServerBanner = flag('WELCOME_USE_SERVER_BANNER', false);
  const banner = process.env.WELCOME_BANNER_URL || (useServerBanner ? g.bannerURL({ extension: 'png', size: 1024 }) : null) || null;
  const buf = await cards.welcomeCard({ name: member.displayName, avatarUrl: await avatarOf(member.user), bannerUrl: banner, memberCount: g.memberCount, serverName: g.name, theme: THEME() });
  return new AttachmentBuilder(buf, { name: 'bienvenue.png' });
}

async function boostFor(member) {
  const buf = await cards.boostCard({ name: member.displayName, avatarUrl: await avatarOf(member.user), serverName: member.guild.name, theme: THEME() });
  return new AttachmentBuilder(buf, { name: 'boost.png' });
}

async function leaveFor(user, guild) {
  const buf = await cards.leaveCard({ name: user.globalName || user.username, avatarUrl: await avatarOf(user), serverName: guild.name, theme: THEME() });
  return new AttachmentBuilder(buf, { name: 'depart.png' });
}

/** Envoie l'annonce de passage de niveau (carte image, ou texte seul si l'image échoue). */
async function sendLevelUp(ch, user, displayName, from, to) {
  let files = [];
  try {
    const buf = await cards.levelUpCard({ name: displayName, avatarUrl: await avatarOf(user), from, to, theme: THEME() });
    files = [new AttachmentBuilder(buf, { name: 'niveau.png' })];
  } catch (e) { console.error('[niveaux] carte de niveau impossible, envoi du texte seul :', e.message); }
  return ch.send({ content: themes.levelMessage(THEME(), `<@${user.id}>`, to), files, allowedMentions: { users: [user.id] } });
}

/** /annonces-niveaux salon | test | off (et les mêmes sous-commandes de /niveaux). */
async function annoncesCmd(i, sub) {
  if (sub === 'salon') {
    const ch = i.options.getChannel('salon');
    settings.announceChannelId = ch.id; saveSettings();
    const me = ch.permissionsFor?.(i.guild.members.me);
    const missing = me ? [['ViewChannel', 'voir le salon'], ['SendMessages', 'envoyer des messages'], ['AttachFiles', 'joindre des fichiers']].filter(([f]) => !me.has(PermissionFlagsBits[f])).map(([, t]) => t) : [];
    return i.reply({ content: `✅ Les passages de niveau seront annoncés dans <#${ch.id}>.${missing.length ? `\n⚠️ Il manque au bot ces droits dans ce salon : **${missing.join(', ')}**. Ajoute-les sinon rien ne s’affichera.` : ''}\nTape \`/annonces-niveaux test\` pour vérifier.`, flags: EPHEMERAL });
  }
  if (sub === 'off') {
    delete settings.announceChannelId; saveSettings();
    const env = (process.env.LEVELS_ANNOUNCE_CHANNEL_ID || '').trim();
    return i.reply({ content: env ? `Salon réglé par commande retiré, mais la variable Railway LEVELS_ANNOUNCE_CHANNEL_ID (<#${env}>) est encore remplie : vide-la aussi pour tout arrêter.` : 'Les annonces de niveau sont arrêtées.', flags: EPHEMERAL });
  }
  if (sub === 'test') {
    await i.deferReply({ flags: EPHEMERAL });
    const id = announceId();
    if (!id) return i.editReply('Aucun salon n’est réglé : tape d’abord `/annonces-niveaux salon`.');
    const ch = await i.client.channels.fetch(id).catch(() => null);
    if (!ch?.isTextBased()) return i.editReply(`Je ne trouve pas le salon <#${id}> (supprimé, ou je n’y ai pas accès). Choisis-en un autre avec \`/annonces-niveaux salon\`.`);
    try {
      const member = await i.guild.members.fetch(i.user.id).catch(() => null);
      await sendLevelUp(ch, i.user, member?.displayName || i.user.username, 4, 5);
      return i.editReply(`✅ Annonce de test envoyée dans <#${id}>. Si tu l’y vois, les vraies annonces fonctionneront aussi.`);
    } catch (e) {
      return i.editReply(`❌ Impossible d’écrire dans <#${id}> : ${e.message}\nVérifie que le bot peut **voir le salon, envoyer des messages et joindre des fichiers**.`);
    }
  }
}

async function run(i) {
  const name = i.commandName;
  if (name === 'annonces-niveaux') {
    if (!staffOk(i)) return i.reply({ content: 'Commande réservée au staff 🔒', flags: EPHEMERAL });
    return annoncesCmd(i, i.options.getSubcommand());
  }
  if (name === 'rang') {
    await i.deferReply();
    const user = i.options.getUser('membre') || i.user;
    if (user.id !== i.user.id && !flag('LEVELS_VIEW_OTHERS', true) && !staffOk(i)) return i.editReply('Tu peux seulement voir ton propre niveau 🔒');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    return sendRank(i, user, member?.displayName || user.username);
  }
  if (name === 'invites') {
    await i.deferReply();
    const user = i.options.getUser('membre') || i.user;
    const s = inv.stats(user.id);
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const aboveName = s.above ? await i.guild.members.fetch(s.above.id).then((m) => m.displayName).catch(() => 'le membre au-dessus') : '';
    const tiles = s.detail
      ? [{ icon: '✅', label: 'invités', value: s.detail.joins }, { icon: '❌', label: 'partis', value: s.detail.left }, { icon: '🚫', label: 'invalidées', value: s.detail.fake }, { icon: '✨', label: 'bonus', value: s.detail.bonus }]
      : [{ icon: '✅', label: 'arrivées suivies', value: s.invited }, { icon: '❌', label: 'parties', value: s.left }];
    const buf = await cards.invitesCard({ name: member?.displayName || user.username, avatarUrl: await avatarOf(user), count: s.count, rank: s.rank, total: s.total,
      gap: s.above ? s.above.n - s.count + 1 : 0, above: aboveName, tiles, theme: THEME() });
    return i.editReply({ files: [new AttachmentBuilder(buf, { name: 'invitations.png' })] });
  }
  if (name === 'classement') {
    await i.deferReply();
    if (!flag('LEVELS_VIEW_OTHERS', true) && !staffOk(i)) return i.editReply('Le classement est désactivé sur ce serveur 🔒');
    const list = levels.ranking().slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = list.map(([id, u], k) => `${medals[k] || `**${k + 1}.**`} <@${id}> · niveau **${levels.levelOf(u.xp).level}** · ${cards.nf(u.xp)} XP`);
    const e = new EmbedBuilder().setColor(0xff8a2b).setTitle('🏆 Classement des niveaux').setDescription(lines.join('\n') || 'Personne n’est encore classé.');
    return i.editReply({ embeds: [e], allowedMentions: { parse: [] } });
  }
  if (name === 'niveaux') {
    if (!staffOk(i)) return i.reply({ content: 'Commande réservée au staff 🔒', flags: EPHEMERAL });
    const sub = i.options.getSubcommand();
    if (sub === 'definir') {
      const u = i.options.getUser('membre'), n = i.options.getInteger('niveau');
      levels.setLevel(u.id, n); levels.saveNow();
      return i.reply({ content: `Niveau de <@${u.id}> fixé à **${n}**.`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
    }
    if (sub === 'importer') {
      await i.deferReply({ flags: EPHEMERAL });
      const att = i.options.getAttachment('fichier');
      if (att.size > 2_000_000) return i.editReply('Fichier trop gros (2 Mo maximum).');
      const text = await (await fetch(att.url)).text();
      const parsed = levels.parseImport(text, i.options.getString('type') || 'niveau');
      let res = null;
      if (parsed.names.length) {
        const all = await i.guild.members.fetch();
        res = levels.matchNames(parsed.names, [...all.values()].map((m) => ({ id: m.id, names: [m.displayName, m.user.username, m.user.globalName] })));
        parsed.ok.push(...res.matched);
      }
      levels.backupIfNeeded();
      const n = levels.applyImport(parsed);
      const list = (a) => a.slice(0, 25).map((e) => `${cards.clean(e.name, 30)} (${e.value})`).join(', ');
      let out = `✅ ${n} membre(s) importé(s).`;
      const approx = res ? res.matched.filter((m) => m.approx) : [];
      if (approx.length) out += `\n🔎 Associés par ressemblance (à vérifier avec /rang) : ${list(approx)}`;
      if (res?.ambiguous.length) out += `\n⚠️ Plusieurs membres possibles, à régler avec /niveaux definir : ${list(res.ambiguous)}`;
      if (res?.missing.length) out += `\n❓ Pseudo introuvable sur le serveur (parti ou pseudo changé) : ${list(res.missing)}`;
      if (parsed.bad.length) out += `\n⚠️ ${parsed.bad.length} ligne(s) illisible(s), par exemple : \`${parsed.bad.slice(0, 3).join('` · `')}\``;
      return i.editReply(out.slice(0, 1900));
    }
    if (sub === 'invitations-definir') {
      const u = i.options.getUser('membre'), n = i.options.getInteger('nombre');
      inv.setCount(u.id, n); inv.flush();
      return i.reply({ content: `Invitations de <@${u.id}> fixées à **${n}**.`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
    }
    if (sub === 'invitations-importer') {
      await i.deferReply({ flags: EPHEMERAL });
      const att = i.options.getAttachment('fichier');
      if (att.size > 2_000_000) return i.editReply('Fichier trop gros (2 Mo maximum).');
      // Format simple « pseudo;total » ou détaillé « pseudo;invités;partis;invalidées;bonus » (le total est calculé)
      const det = {};
      const raw = (await (await fetch(att.url)).text()).split(/\r?\n/).map((l) => {
        const p = l.split(/[;\t]/).map((x) => x.trim());
        if (p.length === 5 && p.slice(1).every((x) => /^\d+$/.test(x))) {
          const [, j, l2, f, b] = p.map(Number); det[levels.norm(p[0])] = { joins: j, left: l2, fake: f, bonus: b };
          return `${p[0]};${Math.max(0, j + b - f - l2)}`;
        }
        return l;
      }).join('\n');
      const parsed = levels.parseImport(raw);
      let res = null;
      if (parsed.names.length) {
        const all = await i.guild.members.fetch();
        res = levels.matchNames(parsed.names, [...all.values()].map((m) => ({ id: m.id, names: [m.displayName, m.user.username, m.user.globalName] })));
        parsed.ok.push(...res.matched);
        for (const m of res.matched) { const d = det[levels.norm(m.name)]; if (d) m.detail = d; }
      }
      for (const { id, value, detail } of parsed.ok) detail ? inv.setDetail(id, detail) : inv.setCount(id, value);
      inv.flush();
      const list = (a) => a.slice(0, 25).map((e) => `${cards.clean(e.name, 30)} (${e.value})`).join(', ');
      let out = `✅ ${parsed.ok.length} membre(s) importé(s).`;
      const approx = res ? res.matched.filter((m) => m.approx) : [];
      if (approx.length) out += `\n🔎 Associés par ressemblance (à vérifier avec /invites) : ${list(approx)}`;
      if (res?.ambiguous.length) out += `\n⚠️ Plusieurs membres possibles, à régler avec /niveaux invitations-definir : ${list(res.ambiguous)}`;
      if (res?.missing.length) out += `\n❓ Pseudo introuvable sur le serveur (parti ou pseudo changé) : ${list(res.missing)}`;
      return i.editReply(out.slice(0, 1900));
    }
    if (sub.startsWith('annonces-')) return annoncesCmd(i, sub.slice(9));
    if (sub === 'apercu-depart') {
      await i.deferReply({ flags: EPHEMERAL });
      return i.editReply({ ...welcome.buildLeave(THEME(), `<@${i.user.id}>`, i.guild.name), files: [await leaveFor(i.user, i.guild)], allowedMentions: { parse: [] } });
    }
    if (sub === 'apercu-boost') {
      await i.deferReply({ flags: EPHEMERAL });
      const member = await i.guild.members.fetch(i.user.id);
      return i.editReply({ ...welcome.buildBoost(THEME(), `<@${member.id}>`), files: [await boostFor(member)], allowedMentions: { parse: [] } });
    }
    if (sub === 'apercu-bienvenue') {
      await i.deferReply({ flags: EPHEMERAL });
      const member = await i.guild.members.fetch(i.user.id);
      const w = welcome.build(THEME(), `<@${member.id}>`, i.guild.name, i.guild.memberCount);
      return i.editReply({ ...w, content: `Voilà ce que verra un nouvel arrivant :\n${w.content}`, files: [await welcomeFor(member)], allowedMentions: { parse: [] } });
    }
  }
}

function init(client) {
  const ownRegistration = !client.commands;
  if (client.commands) { for (const d of DEFS) client.commands.set(d.name, { data: d, execute: run }); for (const d of annonces.defs) client.commands.set(d.name, { data: d, execute: annonces.run }); for (const d of moderation.defs) client.commands.set(d.name, { data: d, execute: moderation.run }); for (const d of logs.defs) client.commands.set(d.name, { data: d, execute: logs.run }); for (const d of aide.defs) client.commands.set(d.name, { data: d, execute: (i) => aide.run(i) }); for (const d of automod.defs) client.commands.set(d.name, { data: d, execute: automod.run }); for (const d of scammers.defs) client.commands.set(d.name, { data: d, execute: scammers.run }); }
  for (const d of avent.defs) if (client.commands) client.commands.set(d.name, { data: d, execute: avent.run });
  annonces.register(client); avent.register(client); moderation.register(client); logs.register(client); aide.register(client); automod.register(client); scammers.register(client);

  client.on(Events.MessageCreate, async (msg) => {
    try {
      if (!msg.guild || msg.guild.id !== GUILD_ID() || msg.author.bot || msg.webhookId) return;
      if (excluded().includes(msg.channel.id)) return;
      const r = levels.onMessage(msg.author.id, (msg.content || '').trim().length, msg.createdTimestamp);
      const announce = announceId();
      if (r && r.to > r.from && announce) {
        const ch = await client.channels.fetch(announce).catch(() => null);
        if (!ch?.isTextBased()) return console.error(`[niveaux] salon d'annonces ${announce} introuvable : refais /annonces-niveaux salon`);
        await sendLevelUp(ch, msg.author, msg.member?.displayName || msg.author.username, r.from, r.to)
          .catch((e) => console.error(`[niveaux] annonce impossible dans ${announce} :`, e.message));
      }
    } catch (e) { console.error('[niveaux] message', e.message); }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.guild.id !== GUILD_ID() || member.user.bot) return;
      const ch = await client.channels.fetch(process.env.WELCOME_CHANNEL_ID || member.guild.systemChannelId || '0').catch(() => null);
      if (!ch?.isTextBased()) return;
      await ch.send({ ...welcome.build(THEME(), `<@${member.id}>`, member.guild.name, member.guild.memberCount), files: [await welcomeFor(member)], allowedMentions: { users: [member.id] } });
    } catch (e) { console.error('[bienvenue]', e.message); }
  });

  // Boost du serveur : message de remerciement (détecte le passage « pas de boost » → « boost »)
  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    try {
      if (newM.guild.id !== GUILD_ID() || newM.user.bot || oldM.premiumSince || !newM.premiumSince) return;
      const id = process.env.BOOST_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID || newM.guild.systemChannelId || '0';
      const ch = await client.channels.fetch(id).catch(() => null);
      if (!ch?.isTextBased()) return;
      await ch.send({ ...welcome.buildBoost(THEME(), `<@${newM.id}>`), files: [await boostFor(newM)], allowedMentions: { users: [newM.id] } });
    } catch (e) { console.error('[boost]', e.message); }
  });

  // Départ : message d'au revoir + (si activé) remise à zéro de l'XP
  client.on(Events.GuildMemberRemove, async (m) => {
    try {
      if (m.guild.id !== GUILD_ID() || m.user?.bot) return;
      if (flag('LEVELS_RESET_ON_LEAVE', false)) levels.forget(m.id);
      const id = process.env.LEAVE_CHANNEL_ID || process.env.WELCOME_CHANNEL_ID || m.guild.systemChannelId || '0';
      const ch = await client.channels.fetch(id).catch(() => null);
      if (!ch?.isTextBased()) return;
      await ch.send({ ...welcome.buildLeave(THEME(), `<@${m.id}>`, m.guild.name), files: [await leaveFor(m.user, m.guild)], allowedMentions: { parse: [] } });
    } catch (e) { console.error('[depart]', e.message); }
  });
  client.on(Events.GuildBanAdd, (b) => { if (b.guild.id === GUILD_ID() && flag('LEVELS_RESET_ON_BAN', true)) levels.forget(b.user.id); });

  if (ownRegistration) {
    client.on(Events.InteractionCreate, (i) => {
      if (i.isChatInputCommand() && avent.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) avent.run(i).catch((e) => console.error('[avent]', e));
      if (i.isChatInputCommand() && annonces.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) annonces.run(i).catch((e) => console.error('[annonces]', e));
      if (i.isChatInputCommand() && moderation.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) moderation.run(i).catch((e) => console.error('[moderation]', e));
      if (i.isChatInputCommand() && logs.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) logs.run(i).catch((e) => console.error('[logs]', e));
      if (i.isChatInputCommand() && automod.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) automod.run(i).catch((e) => console.error('[automod]', e));
      if (i.isChatInputCommand() && scammers.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) scammers.run(i).catch((e) => console.error('[scam]', e));
      if (i.isChatInputCommand() && aide.NAMES.includes(i.commandName) && i.guild?.id === GUILD_ID()) aide.run(i, () => [...DEFS, ...annonces.defs, ...avent.defs, ...moderation.defs, ...logs.defs, ...aide.defs, ...automod.defs, ...scammers.defs]).catch((e) => console.error('[aide]', e));
      if (i.isChatInputCommand() && ['rang', 'classement', 'niveaux', 'invites', 'annonces-niveaux'].includes(i.commandName) && i.guild?.id === GUILD_ID()) run(i).catch((e) => console.error('[niveaux]', e));
    });
  }
  inv = invitelog.register(client);
  const start = async () => {
    const guild = client.guilds.cache.get(GUILD_ID());
    if (!guild) return console.error('[niveaux] GUILD_ID introuvable : vérifie la variable GUILD_ID');
    await inv.init(guild);
    if (ownRegistration) for (const d of [...DEFS, ...annonces.defs, ...avent.defs, ...moderation.defs, ...logs.defs, ...aide.defs, ...automod.defs, ...scammers.defs]) await guild.commands.create(d.toJSON()).catch(() => {});
    levels.backupIfNeeded();
    console.log('[niveaux] 🏆 niveaux et bienvenue prêts');
    console.log(announceId() ? `[niveaux] annonces de niveau dans le salon ${announceId()}` : '[niveaux] ⚠️ aucun salon d’annonces de niveau : tape /annonces-niveaux salon dans Discord');
  };
  if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}

module.exports = { init };
