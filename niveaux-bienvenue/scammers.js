// Liste des scammers MSP : le staff enregistre des fiches (avec preuve), les membres vérifient un pseudo avant d’acheter.
//   /scammer ajouter            (staff) formulaire : pseudo MSP, serveur MSP, Discord (facultatif), raison, preuve
//   /scammer retirer numero     (staff) retirer une fiche (erreur, contestation réglée…)
//   /scammer liste              (staff) les dernières fiches
//   /scammer voir numero        (staff) le détail d’une fiche
//   /verifier pseudo|membre     (tout le monde) réponse privée : signalé ou non, y compris les pseudos très proches
// Si une personne fichée (pseudo ou ID Discord renseigné) rejoint le serveur, le staff est alerté (salon de /logs-config « modération » ou MOD_LOG_CHANNEL_ID).
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, Events } = require('discord.js');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'scammers.json');
const GUILD = () => process.env.GUILD_ID || '';
const perm = PermissionFlagsBits.ManageMessages;

let db = { next: 1, fiches: [] }; // fiche : { id, pseudo, serveur, discordId, discordTag, raison, preuve, par, ts, retiree? }
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[scammers] sauvegarde', e.message); } }

const defs = [
  new SlashCommandBuilder().setName('scammer').setDescription('(Staff) Gérer la liste des scammers').setDefaultMemberPermissions(perm)
    .addSubcommand((s) => s.setName('ajouter').setDescription('Ajouter une fiche (formulaire)'))
    .addSubcommand((s) => s.setName('retirer').setDescription('Retirer une fiche').addIntegerOption((o) => o.setName('numero').setDescription('Numéro de la fiche').setMinValue(1).setRequired(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Voir les dernières fiches'))
    .addSubcommand((s) => s.setName('voir').setDescription('Détail d’une fiche').addIntegerOption((o) => o.setName('numero').setDescription('Numéro de la fiche').setMinValue(1).setRequired(true))),
  new SlashCommandBuilder().setName('verifier').setDescription('Vérifier un pseudo MSP avant d’acheter ou d’échanger')
    .addStringOption((o) => o.setName('pseudo').setDescription('Pseudo MovieStarPlanet à vérifier').setMaxLength(40))
    .addUserOption((o) => o.setName('membre').setDescription('…ou un membre du serveur')),
];
const NAMES = defs.map((d) => d.name);

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const actives = () => db.fiches.filter((f) => !f.retiree);
const ts = (t) => `<t:${Math.floor(t / 1000)}:d>`;
const url = (s) => (/^https?:\/\/\S+$/i.test((s || '').trim()) ? s.trim() : null);

function ficheEmbed(f, titre) {
  const e = new EmbedBuilder().setColor(0xE06C75).setTitle(titre || `🚨 Pseudo signalé · fiche n°${f.id}`)
    .addFields({ name: 'Pseudo MSP', value: f.pseudo, inline: true }, { name: 'Serveur MSP', value: f.serveur || '—', inline: true }, { name: 'Signalé le', value: ts(f.ts), inline: true }, { name: 'Ce qui s’est passé', value: f.raison.slice(0, 1000) });
  if (f.preuve) e.addFields({ name: 'Preuve', value: url(f.preuve) ? `[Voir la preuve](${f.preuve.trim()})` : f.preuve.slice(0, 300) });
  return e;
}

function chercher(pseudo) {
  const n = norm(pseudo); if (!n) return { exact: [], proches: [] };
  const exact = actives().filter((f) => norm(f.pseudo) === n);
  const proches = n.length >= 5 ? actives().filter((f) => norm(f.pseudo) !== n && lev(norm(f.pseudo), n) <= 1) : [];
  return { exact, proches };
}

async function run(i) {
  const cmd = i.commandName;
  if (cmd === 'verifier') {
    const pseudo = i.options.getString('pseudo'), user = i.options.getUser('membre');
    if (!pseudo && !user) return i.reply({ content: 'Indique un **pseudo MSP** ou choisis un **membre**.', flags: EPHEMERAL });
    let exact = [], proches = [];
    if (pseudo) ({ exact, proches } = chercher(pseudo));
    if (user) {
      const byId = actives().filter((f) => f.discordId === user.id || (f.discordTag && norm(f.discordTag) === norm(user.username)));
      exact = [...new Set([...exact, ...byId])];
    }
    const cible = pseudo || user.username;
    if (exact.length) {
      const e = ficheEmbed(exact[0]).setFooter({ text: `${exact.length > 1 ? `${exact.length} fiches pour ce pseudo · ` : ''}Tu penses que c’est une erreur ? Ouvre un ticket 🎫` });
      return i.reply({ content: `🚨 **Attention : « ${cible} » est signalé.** Ne paie rien et n’envoie rien.`, embeds: [e], flags: EPHEMERAL });
    }
    if (proches.length) {
      return i.reply({ content: `⚠️ **« ${cible} » n’est pas signalé, mais son pseudo ressemble beaucoup à un pseudo signalé** (**${proches[0].pseudo}**, fiche n°${proches[0].id}). Vérifie bien l’orthographe : certains scammers imitent un pseudo.`, flags: EPHEMERAL });
    }
    return i.reply({ content: `✅ Aucun signalement pour **${cible}**.\n*Ça ne veut pas dire que la personne est fiable : reste prudent, ne paie jamais à l’avance. En cas de doute, ouvre un ticket 🎫*`, flags: EPHEMERAL });
  }

  // commandes staff
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const sub = i.options.getSubcommand();
  if (sub === 'ajouter') {
    const m = new ModalBuilder().setCustomId('scam:add').setTitle('Nouvelle fiche scammer');
    const f = (id, label, style, req, max, ph) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(req).setMaxLength(max).setPlaceholder(ph || ''));
    m.addComponents(
      f('pseudo', 'Pseudo MSP', TextInputStyle.Short, true, 40),
      f('serveur', 'Serveur MSP (FR, UK…)', TextInputStyle.Short, false, 20),
      f('discord', 'Discord : ID ou pseudo (facultatif)', TextInputStyle.Short, false, 40, 'Pour être alerté s’il rejoint le serveur'),
      f('raison', 'Ce qui s’est passé', TextInputStyle.Paragraph, true, 500),
      f('preuve', 'Preuve (lien vers une capture)', TextInputStyle.Short, false, 300));
    return i.showModal(m);
  }
  if (sub === 'retirer') {
    const f = db.fiches.find((x) => x.id === i.options.getInteger('numero') && !x.retiree);
    if (!f) return i.reply({ content: '❌ Aucune fiche active avec ce numéro.', flags: EPHEMERAL });
    f.retiree = { par: i.user.id, ts: Date.now() }; save();
    log(i.client, new EmbedBuilder().setColor(0xC4D6C3).setTitle(`↩️ Fiche n°${f.id} retirée`).setDescription(`Pseudo : **${f.pseudo}**\nPar : <@${i.user.id}>`).setTimestamp());
    return i.reply({ content: `✅ Fiche n°${f.id} (**${f.pseudo}**) retirée.`, flags: EPHEMERAL });
  }
  if (sub === 'voir') {
    const f = db.fiches.find((x) => x.id === i.options.getInteger('numero'));
    if (!f) return i.reply({ content: '❌ Fiche introuvable.', flags: EPHEMERAL });
    const e = ficheEmbed(f, `Fiche n°${f.id}${f.retiree ? ' (retirée)' : ''}`).addFields({ name: 'Ajoutée par', value: `<@${f.par}>`, inline: true }, { name: 'Discord', value: f.discordId ? `<@${f.discordId}>` : f.discordTag || '—', inline: true });
    return i.reply({ embeds: [e], flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }
  const l = actives().slice(-20).reverse().map((f) => `**#${f.id}** · ${f.pseudo} (${f.serveur || '?'}) · ${ts(f.ts)}`);
  return i.reply({ embeds: [new EmbedBuilder().setColor(0xE06C75).setTitle(`Liste des scammers · ${actives().length} fiche(s)`).setDescription(l.join('\n') || 'Aucune fiche.')], flags: EPHEMERAL });
}

async function log(client, embed) {
  try { await require('./moderation').logStaff(client, embed); } catch {}
}

function register(client) {
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.guild?.id !== GUILD() || !i.isModalSubmit() || i.customId !== 'scam:add') return;
      if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
      const g = (k) => i.fields.getTextInputValue(k).trim();
      const disc = g('discord'), mid = disc.match(/\d{15,22}/)?.[0] || null;
      const f = { id: db.next++, pseudo: g('pseudo'), serveur: g('serveur'), discordId: mid, discordTag: mid ? '' : disc, raison: g('raison'), preuve: g('preuve'), par: i.user.id, ts: Date.now() };
      db.fiches.push(f); save();
      log(client, ficheEmbed(f, `➕ Fiche scammer n°${f.id} ajoutée`).addFields({ name: 'Par', value: `<@${i.user.id}>`, inline: true }).setTimestamp());
      await i.reply({ content: `✅ Fiche n°${f.id} enregistrée pour **${f.pseudo}**.${f.preuve ? '' : '\n⚠️ Pas de preuve renseignée : ajoute-en une dès que possible.'}`, flags: EPHEMERAL });
    } catch (e) { console.error('[scammers] formulaire', e.message); }
  });
  client.on(Events.GuildMemberAdd, async (m) => {
    try {
      if (m.guild.id !== GUILD()) return;
      const f = actives().find((x) => x.discordId === m.id || (x.discordTag && norm(x.discordTag) === norm(m.user.username)));
      if (f) log(client, ficheEmbed(f, `🚨 Un scammer connu vient de rejoindre : ${m.user.username}`).addFields({ name: 'Membre', value: `<@${m.id}>`, inline: true }).setTimestamp());
    } catch {}
  });
}
module.exports = { defs, NAMES, run, register };
