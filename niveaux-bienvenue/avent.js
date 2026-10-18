// Calendrier de l'Avent : une image de calendrier + 24 boutons. Chaque membre ouvre les cases jusqu'au jour J (1er → 24 décembre) et découvre la surprise écrite par le staff.
//   /avent-publier salon      poste le calendrier (il se met à jour tout seul chaque jour à minuit, heure de Paris)
//   /avent-case jour          écrire / modifier la surprise d'un jour (formulaire)
//   /avent-import fichier     importer les 24 surprises d'un coup (une ligne par jour : « 5;texte », \n = retour à la ligne)
//   /avent-liste              voir les jours remplis et combien de membres ont ouvert chaque case
// Variables Railway facultatives :
//   AVENT_LOG_CHANNEL_ID      salon staff : « X a ouvert la case 5 » (utile pour remettre les lots)
//   AVENT_SEULEMENT_JOUR      true : on ne peut ouvrir que la case du jour (défaut : les cases passées restent ouvrables)
//   AVENT_FOND_URL            lien d'une image de fond (ou dépose assets/avent-fond.png dans le dossier) : le bot pose les cases par-dessus
//   AVENT_TEST_DAY            pour tester avant décembre (ex : 5) — à retirer ensuite
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, AttachmentBuilder, ChannelType, Events } = require('discord.js');
const themes = require('./themes');
const cards = require('./cards');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'avent.json');
const DECO = '⊹₊˚‧︵‿₊୨ෆ୧₊‿︵‧˚₊⊹';
const GUILD = () => process.env.GUILD_ID || '';

let db = { cases: {}, opened: {}, message: null }; // cases: jour -> texte · opened: jour -> { userId: ts } · message: { channelId, messageId, day }
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[avent] sauvegarde', e.message); } }

const perm = PermissionFlagsBits.ManageGuild;
const defs = [
  new SlashCommandBuilder().setName('avent-publier').setDescription('(Staff) Poster le calendrier de l’Avent').setDefaultMemberPermissions(perm)
    .addChannelOption((o) => o.setName('salon').setDescription('Salon du calendrier').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)),
  new SlashCommandBuilder().setName('avent-case').setDescription('(Staff) Écrire la surprise d’un jour').setDefaultMemberPermissions(perm)
    .addIntegerOption((o) => o.setName('jour').setDescription('Jour (1 à 24)').setMinValue(1).setMaxValue(24).setRequired(true)),
  new SlashCommandBuilder().setName('avent-import').setDescription('(Staff) Importer les surprises (une ligne : jour;texte)').setDefaultMemberPermissions(perm)
    .addAttachmentOption((o) => o.setName('fichier').setDescription('Fichier .txt').setRequired(true)),
  new SlashCommandBuilder().setName('avent-liste').setDescription('(Staff) Jours remplis et ouvertures').setDefaultMemberPermissions(perm),
];
const NAMES = defs.map((d) => d.name);

/** Jour du calendrier : 0 avant décembre, 1-24 en décembre, 25 ensuite (calendrier terminé, tout est ouvrable). */
function dayNow(ms = Date.now()) {
  const t = parseInt(process.env.AVENT_TEST_DAY || '', 10);
  if (t >= 0) return Math.min(t, 25);
  const [, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)).split('-').map(Number);
  if (m === 12) return Math.min(d, 25);
  if (m === 1 && d <= 6) return 25;
  return 0;
}
const onlyToday = () => String(process.env.AVENT_SEULEMENT_JOUR || '').toLowerCase() === 'true';

function rows(today) {
  const out = [];
  for (let d = 1; d <= 24; d++) {
    if ((d - 1) % 5 === 0) out.push(new ActionRowBuilder());
    out[out.length - 1].addComponents(new ButtonBuilder().setCustomId(`av:${d}`).setLabel(String(d)).setDisabled(d > today)
      .setStyle(d === today ? ButtonStyle.Success : d < today ? ButtonStyle.Secondary : ButtonStyle.Danger));
  }
  return out;
}
/** Fond personnalisé : assets/avent-fond.png (ou .jpg / .webp), sinon lien AVENT_FOND_URL, sinon le décor dessiné par le bot. */
function customBackground() {
  for (const f of ['avent-fond.png', 'avent-fond.jpg', 'avent-fond.jpeg', 'avent-fond.webp']) { try { return fs.readFileSync(path.join(__dirname, 'assets', f)); } catch {} }
  return process.env.AVENT_FOND_URL || null;
}
function payload(today, guildName) {
  const T = themes.get('noel');
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setImage('attachment://avent.png')
    .setDescription([DECO, '', '🎄 **Une surprise t’attend chaque jour jusqu’à Noël !**', 'Clique sur le bouton du jour pour ouvrir ta case 🎁', '', DECO].join('\n'));
  return cards.adventCard({ today, serverName: guildName, background: customBackground() }).then((buf) => ({ embeds: [embed], files: [new AttachmentBuilder(buf, { name: 'avent.png' })], attachments: [], components: rows(today) }));
}

async function run(i) {
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Commande réservée au staff 🔒', flags: EPHEMERAL });
  const n = i.commandName;
  if (n === 'avent-case') {
    const jour = i.options.getInteger('jour');
    return i.showModal(new ModalBuilder().setCustomId(`avent-case:${jour}`).setTitle(`Surprise du ${jour} décembre`).addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texte').setLabel('Texte de la surprise').setStyle(TextInputStyle.Paragraph).setMaxLength(1800).setRequired(true).setValue(String(db.cases[jour] || '').slice(0, 1800) || ' '))));
  }
  await i.deferReply({ flags: EPHEMERAL });
  if (n === 'avent-liste') {
    const l = [];
    for (let d = 1; d <= 24; d++) l.push(`${db.cases[d] ? '✅' : '▫️'} **${d}** · ${Object.keys(db.opened[d] || {}).length} ouverture(s)${db.cases[d] ? ' · ' + String(db.cases[d]).split('\n')[0].slice(0, 40) : ''}`);
    return i.editReply(l.join('\n').slice(0, 1900));
  }
  if (n === 'avent-import') {
    const att = i.options.getAttachment('fichier');
    if (att.size > 500_000) return i.editReply('Fichier trop gros.');
    let ok = 0; const bad = [];
    for (const raw of (await (await fetch(att.url)).text()).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const m = line.match(/^(\d{1,2})\s*[;\t]\s*(.+)$/);
      if (m && +m[1] >= 1 && +m[1] <= 24) { db.cases[+m[1]] = m[2].replace(/\\n/g, '\n').slice(0, 1800); ok++; } else if (!/^jour/i.test(line)) bad.push(line.slice(0, 40));
    }
    save();
    return i.editReply(`✅ ${ok} surprise(s) importée(s).${bad.length ? `\n⚠️ Lignes illisibles : ${bad.slice(0, 3).map((x) => `\`${x}\``).join(' · ')}` : ''}`);
  }
  // avent-publier
  const ch = i.options.getChannel('salon');
  const today = dayNow();
  try {
    const msg = await ch.send(await payload(today, i.guild.name));
    db.message = { channelId: ch.id, messageId: msg.id, day: today }; save();
  } catch (e) { return i.editReply(`⚠️ Impossible de publier : ${e.message}`); }
  const missing = []; for (let d = 1; d <= 24; d++) if (!db.cases[d]) missing.push(d);
  return i.editReply(`✅ Calendrier publié dans <#${ch.id}>.${missing.length ? `\n🎁 Jours sans surprise : ${missing.join(', ')} (voir /avent-case ou /avent-import).` : ''}`);
}

async function onInteraction(i, client) {
  if (i.isModalSubmit()) {
    const jour = +i.customId.split(':')[1];
    db.cases[jour] = i.fields.getTextInputValue('texte').trim(); save();
    return i.reply({ content: `✅ Surprise du ${jour} décembre enregistrée.`, flags: EPHEMERAL });
  }
  const d = +i.customId.slice(3), today = dayNow();
  if (d > today) return i.reply({ content: `⏳ Cette case ouvre le ${d} décembre, reviens ce jour-là !`, flags: EPHEMERAL });
  if (d < today && onlyToday() && today <= 24) return i.reply({ content: 'Cette case est passée : seule la case du jour peut s’ouvrir 🎄', flags: EPHEMERAL });
  const text = db.cases[d];
  if (!text) return i.reply({ content: '🎁 La surprise de cette case est encore en préparation, reviens un peu plus tard !', flags: EPHEMERAL });
  const T = themes.get('noel');
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setTitle(`🎁 Case n°${d}`).setDescription([DECO, '', text, '', DECO].join('\n'));
  await i.reply({ embeds: [embed], flags: EPHEMERAL, allowedMentions: { parse: [] } });
  db.opened[d] = db.opened[d] || {};
  if (!db.opened[d][i.user.id]) { // première ouverture : on note et on prévient le staff
    db.opened[d][i.user.id] = Date.now(); save();
    const log = process.env.AVENT_LOG_CHANNEL_ID;
    if (log) { const ch = await client.channels.fetch(log).catch(() => null); ch?.isTextBased() && ch.send({ content: `🎁 <@${i.user.id}> a ouvert la case **${d}**.`, allowedMentions: { parse: [] } }).catch(() => {}); }
  }
}

function register(client) {
  client.on(Events.InteractionCreate, (i) => {
    if (i.guild?.id !== GUILD()) return;
    if ((i.isButton() && /^av:\d+$/.test(i.customId)) || (i.isModalSubmit() && i.customId.startsWith('avent-case:'))) onInteraction(i, client).catch((e) => console.error('[avent]', e.message));
  });
  // Mise à jour du calendrier au changement de jour
  const tick = async () => {
    try {
      const m = db.message, today = dayNow();
      if (!m || m.day === today) return;
      const ch = await client.channels.fetch(m.channelId).catch(() => null);
      const msg = await ch?.messages?.fetch(m.messageId).catch(() => null);
      if (!msg) { db.message = null; save(); return; }
      await msg.edit(await payload(today, ch.guild.name));
      m.day = today; save();
    } catch (e) { console.error('[avent] mise à jour', e.message); }
  };
  const start = () => { tick(); setInterval(tick, 5 * 60 * 1000).unref(); };
  if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}
module.exports = { defs, NAMES, run, register, dayNow, rows, payload };
