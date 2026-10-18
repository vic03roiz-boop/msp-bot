// Annonces MSP pour le staff : /annonce-msp ouvre un formulaire (titre, texte, date facultative), montre un aperçu,
// puis publie dans un joli embed (image + ping de rôle) tout de suite ou à l'heure choisie (heure de Paris).
//   /annonce-msp [salon] [ping] [image]   ·   /annonce-liste   ·   /annonce-annuler numero
// Variables Railway facultatives : ANNONCE_CHANNEL_ID (salon par défaut), ANNONCE_ROLE_ID (rôle pingé par défaut)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, AttachmentBuilder, ChannelType, Events } = require('discord.js');
const themes = require('./themes');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'annonces.json');
const IMG_DIR = path.join(DIR, 'annonces-img');
const DECO = '⊹₊˚‧︵‿₊୨ෆ୧₊‿︵‧˚₊⊹';

const defs = [
  new SlashCommandBuilder().setName('annonce-msp').setDescription('(Staff) Publier une annonce MSP bien mise en forme')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((o) => o.setName('salon').setDescription('Salon de l’annonce (sinon le salon par défaut)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addRoleOption((o) => o.setName('ping').setDescription('Rôle à mentionner (sinon le rôle par défaut)'))
    .addAttachmentOption((o) => o.setName('image').setDescription('Image à mettre en bas de l’annonce')),
  new SlashCommandBuilder().setName('annonce-liste').setDescription('(Staff) Annonces programmées').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('annonce-annuler').setDescription('(Staff) Annuler une annonce programmée').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('numero').setDescription('Numéro vu dans /annonce-liste').setRequired(true)),
];
const NAMES = defs.map((d) => d.name);

// ---------- stockage ----------
let db = { next: 1, items: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[annonces] sauvegarde', e.message); } }

// ---------- heure de Paris ----------
function parts(ms) {
  const o = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(ms)).forEach((x) => { o[x.type] = +x.value; });
  return o;
}
const offset = (ms) => { const o = parts(ms); return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute, o.second) - Math.floor(ms / 1000) * 1000; };
function parisToUtc(y, mo, d, h, mi) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let t = wall - offset(wall);
  t = wall - offset(t);
  return t;
}
/** « 20/10 18:30 », « 20/10/2026 18h30 » ou « 18:30 » (aujourd'hui, ou demain si l'heure est passée). Vide = maintenant. */
function parseWhen(text, now = Date.now()) {
  const s = String(text || '').trim();
  if (!s) return { at: null };
  const m = s.match(/^(?:(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+)?(\d{1,2})\s*[h:]\s*(\d{2})?$/i);
  if (!m) return { error: 'Date non comprise. Exemples : `20/10 18:30`, `20/10/2026 18h00` ou `18:30`.' };
  const p = parts(now);
  const h = +m[4], mi = +(m[5] || 0);
  if (h > 23 || mi > 59) return { error: 'Heure invalide.' };
  let at;
  if (m[1]) {
    const d = +m[1], mo = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return { error: 'Date invalide.' };
    let y = m[3] ? +m[3] : p.year;
    at = parisToUtc(y, mo, d, h, mi);
    if (!m[3] && at < now - 60000) at = parisToUtc(y + 1, mo, d, h, mi);
  } else {
    at = parisToUtc(p.year, p.month, p.day, h, mi);
    if (at < now - 60000) at = parisToUtc(p.year, p.month, p.day + 1, h, mi);
  }
  if (at < now - 60000) return { error: 'Cette date est déjà passée.' };
  return { at };
}
const fmt = (ms) => new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

// ---------- message ----------
function build({ title, text, roleId, hasImage, imageName, theme }) {
  const T = themes.get(theme);
  const e = T.title[0];
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16))
    .setTitle(`${e} ${title} ${T.title[1]}`.slice(0, 256))
    .setDescription([DECO, '', text, '', DECO].join('\n').slice(0, 4000))
    .setFooter({ text: 'Annonce MSP' }).setTimestamp();
  if (hasImage) embed.setImage(`attachment://${imageName}`);
  return { content: roleId ? `<@&${roleId}>` : undefined, embeds: [embed], allowedMentions: roleId ? { roles: [roleId] } : { parse: [] } };
}
const extOf = (type) => (type === 'image/jpeg' ? 'jpg' : type === 'image/gif' ? 'gif' : type === 'image/webp' ? 'webp' : 'png');

async function publish(client, it) {
  const ch = await client.channels.fetch(it.channelId).catch(() => null);
  if (!ch?.isTextBased()) throw new Error('salon introuvable');
  const msg = build({ ...it, hasImage: !!it.image, imageName: it.image, theme: it.theme || themes.currentName() });
  if (it.image) { const f = path.join(IMG_DIR, it.image); if (fs.existsSync(f)) msg.files = [new AttachmentBuilder(f, { name: it.image })]; else msg.embeds[0].setImage(null); }
  await ch.send(msg);
  if (it.image) fs.rm(path.join(IMG_DIR, it.image), () => {});
}

// ---------- commandes ----------
const drafts = new Map(); // token -> brouillon (30 min)
const GUILD = () => process.env.GUILD_ID || '';

async function run(i) {
  if (!i.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return i.reply({ content: 'Commande réservée au staff 🔒', flags: EPHEMERAL });
  if (i.commandName === 'annonce-liste') {
    const l = [...db.items].sort((a, b) => a.at - b.at);
    return i.reply({ flags: EPHEMERAL, content: l.length ? l.map((x) => `**#${x.id}** · ${fmt(x.at)} · <#${x.channelId}> · ${x.title}`).join('\n').slice(0, 1900) : 'Aucune annonce programmée.' });
  }
  if (i.commandName === 'annonce-annuler') {
    const id = i.options.getInteger('numero'), k = db.items.findIndex((x) => x.id === id);
    if (k < 0) return i.reply({ content: 'Numéro introuvable (voir /annonce-liste).', flags: EPHEMERAL });
    const [it] = db.items.splice(k, 1); if (it.image) fs.rm(path.join(IMG_DIR, it.image), () => {}); save();
    return i.reply({ content: `🗑️ Annonce #${id} annulée.`, flags: EPHEMERAL });
  }
  // /annonce-msp
  const channelId = i.options.getChannel('salon')?.id || process.env.ANNONCE_CHANNEL_ID || '';
  if (!channelId) return i.reply({ content: 'Choisis un salon avec l’option `salon` (ou ajoute la variable ANNONCE_CHANNEL_ID).', flags: EPHEMERAL });
  const roleId = i.options.getRole('ping')?.id || process.env.ANNONCE_ROLE_ID || '';
  const att = i.options.getAttachment('image');
  let image = null;
  if (att) {
    if (!att.contentType?.startsWith('image/') || att.size > 8_000_000) return i.reply({ content: 'L’image doit être un fichier image de moins de 8 Mo.', flags: EPHEMERAL });
    image = { buf: Buffer.from(await (await fetch(att.url)).arrayBuffer()), ext: extOf(att.contentType) };
  }
  const token = crypto.randomBytes(5).toString('hex');
  drafts.set(token, { userId: i.user.id, channelId, roleId, image, born: Date.now() });
  const row = (id, label, style, value) => new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(id !== 'quand').setMaxLength(id === 'texte' ? 3800 : 100).setPlaceholder(value || ''));
  await i.showModal(new ModalBuilder().setCustomId(`annonce:${token}`).setTitle('Nouvelle annonce MSP').addComponents(
    row('titre', 'Titre', TextInputStyle.Short, 'Ex : Nouvelle mise à jour !'),
    row('texte', 'Texte de l’annonce', TextInputStyle.Paragraph),
    row('quand', 'Quand ? (vide = maintenant)', TextInputStyle.Short, 'Ex : 20/10 18:30'),
  ));
}

async function onComponent(i, client) {
  const [kind, token] = String(i.customId).split(':');
  if (kind === 'annonce') { // formulaire envoyé -> aperçu
    const d = drafts.get(token);
    if (!d || d.userId !== i.user.id) return i.reply({ content: 'Formulaire expiré, relance /annonce-msp.', flags: EPHEMERAL });
    const w = parseWhen(i.fields.getTextInputValue('quand'));
    if (w.error) { drafts.delete(token); return i.reply({ content: `⚠️ ${w.error} Relance /annonce-msp.`, flags: EPHEMERAL }); }
    Object.assign(d, { title: i.fields.getTextInputValue('titre').trim(), text: i.fields.getTextInputValue('texte').trim(), at: w.at });
    const name = d.image ? `annonce.${d.image.ext}` : null;
    const msg = build({ ...d, hasImage: !!d.image, imageName: name, theme: themes.currentName() });
    const files = d.image ? [new AttachmentBuilder(d.image.buf, { name })] : [];
    const when = d.at ? `programmée le **${fmt(d.at)}**` : 'publiée **tout de suite**';
    return i.reply({ flags: EPHEMERAL, content: `Aperçu : sera ${when} dans <#${d.channelId}>${d.roleId ? ` avec ping <@&${d.roleId}>` : ''}.`, embeds: msg.embeds, files, allowedMentions: { parse: [] },
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`annonce-ok:${token}`).setLabel(d.at ? 'Programmer' : 'Publier').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`annonce-no:${token}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary))] });
  }
  const d = drafts.get(token);
  if (!d || d.userId !== i.user.id) return i.update({ content: 'Brouillon expiré, relance /annonce-msp.', embeds: [], files: [], components: [] });
  drafts.delete(token);
  if (kind === 'annonce-no') return i.update({ content: '❌ Annonce annulée.', embeds: [], files: [], components: [] });
  await i.deferUpdate();
  const it = { id: db.next++, at: d.at || Date.now(), channelId: d.channelId, roleId: d.roleId, title: d.title, text: d.text, theme: null, image: null };
  if (d.image) { it.image = `annonce-${it.id}.${d.image.ext}`; fs.mkdirSync(IMG_DIR, { recursive: true }); fs.writeFileSync(path.join(IMG_DIR, it.image), d.image.buf); }
  if (d.at) { db.items.push(it); save(); return i.editReply({ content: `⏰ Annonce #${it.id} programmée le **${fmt(d.at)}**.`, embeds: [], files: [], components: [] }); }
  try { it.theme = themes.currentName(); await publish(client, it); db.next = Math.max(db.next, it.id); save(); return i.editReply({ content: '✅ Annonce publiée !', embeds: [], files: [], components: [] }); }
  catch (e) { return i.editReply({ content: `⚠️ Impossible de publier : ${e.message} (le bot a-t-il accès au salon ?)`, embeds: [], files: [], components: [] }); }
}

function register(client) {
  client.on(Events.InteractionCreate, (i) => {
    if (i.guild?.id !== GUILD()) return;
    if ((i.isModalSubmit() && i.customId.startsWith('annonce:')) || (i.isButton() && /^annonce-(ok|no):/.test(i.customId))) onComponent(i, client).catch((e) => console.error('[annonces]', e.message));
  });
  const tick = async () => {
    for (const [k, d] of drafts) if (Date.now() - d.born > 30 * 60 * 1000) drafts.delete(k);
    const due = db.items.filter((x) => x.at <= Date.now());
    if (!due.length) return;
    db.items = db.items.filter((x) => !due.includes(x)); save();
    for (const it of due) await publish(client, { ...it, theme: themes.currentName() }).catch((e) => console.error(`[annonces] #${it.id}`, e.message));
  };
  const start = () => { tick(); setInterval(tick, 30 * 1000).unref(); };
  if (client.isReady()) start(); else client.once(Events.ClientReady, start);
  return { tick };
}

module.exports = { defs, NAMES, run, register, parseWhen, parisToUtc, build, fmt };
