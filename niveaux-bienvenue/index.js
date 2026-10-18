// Niveaux + cartes de rang + bienvenue en image.
//   const niveaux = require('./niveaux-bienvenue');
//   niveaux.init(client);   // UNE fois, après stats-serveur
// Variables Railway (toutes facultatives sauf GUILD_ID, déjà présent) :
//   WELCOME_CHANNEL_ID        salon de bienvenue (sinon le salon système du serveur)
//   WELCOME_BANNER_URL        lien d'une image de fond (sinon bannière du serveur, sinon assets/banniere.png, sinon dégradé)
//   LEVELS_ANNOUNCE_CHANNEL_ID  salon où annoncer les passages de niveau (laisse vide tant que DraftBot les annonce encore)
//   LEVELS_THEME                facultatif : force la saison (halloween | automne | noel | hiver). Sinon elle change toute seule avec la date
//   LEVELS_MESSAGE              facultatif : ton propre message de passage de niveau ({user} et {level})
//   LEVELS_VIEW_OTHERS          true (défaut) : les membres peuvent voir le niveau des autres ; false pour l'interdire
//   LEVELS_RESET_ON_LEAVE       true : un membre qui quitte le serveur perd son XP (défaut : false)
//   LEVELS_RESET_ON_BAN         true : un membre banni perd son XP (défaut : true)
//   LEVELS_EXCLUDED_CHANNEL_IDS salons sans XP (par défaut : les mêmes que pour les bonbons)
const { Events, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const levels = require('./levels');
const cards = require('./cards');

const EPHEMERAL = 64;
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

const DEFS = [
  new SlashCommandBuilder().setName('rang').setDescription('Ta carte de niveau')
    .addUserOption((o) => o.setName('membre').setDescription('Voir la carte d’un autre membre')),
  new SlashCommandBuilder().setName('classement').setDescription('Le top 10 des niveaux du serveur'),
  new SlashCommandBuilder().setName('niveaux').setDescription('(Staff) Gérer les niveaux et la bienvenue')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => s.setName('definir').setDescription('Fixer le niveau d’un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption((o) => o.setName('niveau').setDescription('Niveau').setMinValue(0).setMaxValue(500).setRequired(true)))
    .addSubcommand((s) => s.setName('importer').setDescription('Importer les niveaux depuis un fichier texte (une ligne : identifiant;niveau)')
      .addAttachmentOption((o) => o.setName('fichier').setDescription('Fichier .txt ou .csv').setRequired(true))
      .addStringOption((o) => o.setName('type').setDescription('Ce que contient la 2e colonne').addChoices({ name: 'Niveau (par défaut)', value: 'niveau' }, { name: 'XP total', value: 'xp' })))
    .addSubcommand((s) => s.setName('apercu-bienvenue').setDescription('Voir l’image de bienvenue avec ton profil')),
];

async function avatarOf(user) { return user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }); }

async function sendRank(i, user, name) {
  const info = levels.info(user.id);
  const buf = await cards.rankCard({ name, avatarUrl: await avatarOf(user), level: info.level, into: info.into, need: info.need, rank: info.rank, total: info.total, xp: info.xp, theme: THEME() });
  return i.editReply({ files: [new AttachmentBuilder(buf, { name: 'rang.png' })] });
}

async function welcomeFor(member) {
  const g = member.guild;
  const banner = process.env.WELCOME_BANNER_URL || g.bannerURL({ extension: 'png', size: 1024 }) || g.splashURL({ extension: 'png', size: 1024 }) || null;
  const buf = await cards.welcomeCard({ name: member.displayName, avatarUrl: await avatarOf(member.user), bannerUrl: banner, memberCount: g.memberCount, serverName: g.name, theme: THEME() });
  return new AttachmentBuilder(buf, { name: 'bienvenue.png' });
}

async function run(i) {
  const name = i.commandName;
  if (name === 'rang') {
    await i.deferReply();
    const user = i.options.getUser('membre') || i.user;
    if (user.id !== i.user.id && !flag('LEVELS_VIEW_OTHERS', true) && !staffOk(i)) return i.editReply('Tu peux seulement voir ton propre niveau 🔒');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    return sendRank(i, user, member?.displayName || user.username);
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
    if (sub === 'apercu-bienvenue') {
      await i.deferReply({ flags: EPHEMERAL });
      const member = await i.guild.members.fetch(i.user.id);
      return i.editReply({ content: 'Voilà ce que verra un nouvel arrivant :', files: [await welcomeFor(member)] });
    }
  }
}

function init(client) {
  const ownRegistration = !client.commands;
  if (client.commands) for (const d of DEFS) client.commands.set(d.name, { data: d, execute: run });

  client.on(Events.MessageCreate, async (msg) => {
    try {
      if (!msg.guild || msg.guild.id !== GUILD_ID() || msg.author.bot || msg.webhookId) return;
      if (excluded().includes(msg.channel.id)) return;
      const r = levels.onMessage(msg.author.id, (msg.content || '').trim().length, msg.createdTimestamp);
      const announce = process.env.LEVELS_ANNOUNCE_CHANNEL_ID;
      if (r && r.to > r.from && announce) {
        const ch = await client.channels.fetch(announce).catch(() => null);
        if (ch?.isTextBased()) {
          const buf = await cards.levelUpCard({ name: msg.member?.displayName || msg.author.username, avatarUrl: await avatarOf(msg.author), from: r.from, to: r.to, theme: THEME() });
          ch.send({ content: themes.levelMessage(THEME(), `<@${msg.author.id}>`, r.to), files: [new AttachmentBuilder(buf, { name: 'niveau.png' })], allowedMentions: { users: [msg.author.id] } }).catch(() => {});
        }
      }
    } catch (e) { console.error('[niveaux] message', e.message); }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.guild.id !== GUILD_ID() || member.user.bot) return;
      const ch = await client.channels.fetch(process.env.WELCOME_CHANNEL_ID || member.guild.systemChannelId || '0').catch(() => null);
      if (!ch?.isTextBased()) return;
      await ch.send({ content: `Bienvenue <@${member.id}> ! 🎃`, files: [await welcomeFor(member)], allowedMentions: { users: [member.id] } });
    } catch (e) { console.error('[bienvenue]', e.message); }
  });

  client.on(Events.GuildMemberRemove, (m) => { if (m.guild.id === GUILD_ID() && flag('LEVELS_RESET_ON_LEAVE', false)) levels.forget(m.id); });
  client.on(Events.GuildBanAdd, (b) => { if (b.guild.id === GUILD_ID() && flag('LEVELS_RESET_ON_BAN', true)) levels.forget(b.user.id); });

  if (ownRegistration) {
    client.on(Events.InteractionCreate, (i) => {
      if (i.isChatInputCommand() && ['rang', 'classement', 'niveaux'].includes(i.commandName) && i.guild?.id === GUILD_ID()) run(i).catch((e) => console.error('[niveaux]', e));
    });
  }
  const start = async () => {
    const guild = client.guilds.cache.get(GUILD_ID());
    if (!guild) return console.error('[niveaux] GUILD_ID introuvable : vérifie la variable GUILD_ID');
    if (ownRegistration) for (const d of DEFS) await guild.commands.create(d.toJSON()).catch(() => {});
    levels.backupIfNeeded();
    console.log('[niveaux] 🏆 niveaux et bienvenue prêts');
  };
  if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}

module.exports = { init };
