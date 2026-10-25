// Liste des arnaqueurs (scammers) : le STAFF remplit les fiches à la main, les MEMBRES vérifient un pseudo.
//
//   Membres :  /verifier-scam pseudo:<pseudo MSP ou Discord>   ou   /verifier-scam membre:@quelqu'un
//   Staff   :  /scam ajouter | modifier | retirer | liste | salon
//
// Variables Railway (toutes facultatives) :
//   SCAM_STAFF_ROLE_IDS   identifiants de rôles staff en plus de la permission « Gérer les messages » (séparés par des virgules)
//   SCAMMERS_CHANNEL_ID   salon où chaque fiche est publiée / mise à jour (sinon réglable avec /scam salon)
//
// Les fiches sont dans scammers.json (volume Railway), avec une sauvegarde par jour.
const fs = require('fs');
const path = require('path');
const { Events, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const EPHEMERAL = 64;
const GUILD_ID = () => process.env.GUILD_ID || '';
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'scammers.json');
const BACKUPS = path.join(DIR, 'scammers-backups');
try { fs.mkdirSync(BACKUPS, { recursive: true }); } catch {}

let db = { next: 1, entries: [], channelId: '' };
try { if (fs.existsSync(FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
catch (e) { console.error('[scam] fichier illisible, copie du fichier abîmé en .bad', e.message); try { fs.renameSync(FILE, `${FILE}.bad`); } catch {} }

function save() {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1)); fs.renameSync(tmp, FILE);
}
function backupIfNeeded() {
  try {
    const name = path.join(BACKUPS, `scammers-${new Date().toISOString().slice(0, 10)}.json`);
    if (!fs.existsSync(name) && fs.existsSync(FILE)) {
      fs.copyFileSync(FILE, name);
      const all = fs.readdirSync(BACKUPS).sort();
      for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(BACKUPS, old));
    }
  } catch (e) { console.error('[scam] sauvegarde', e.message); }
}
setInterval(backupIfNeeded, 6 * 60 * 60 * 1000).unref();

/** Pseudo -> forme comparable : lettres « fantaisie » normalisées, emojis/symboles/espaces retirés. */
const norm = (t) => String(t || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const clip = (t, n) => { t = String(t || ''); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const frDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });

// ---------- données ----------
/** « pseudo1, pseudo2, 123456789012345678 » -> { aliases, discordIds } */
function parseOthers(text) {
  const aliases = [], discordIds = [];
  for (const raw of String(text || '').split(/[,;\n]+/)) {
    const p = raw.trim(); if (!p) continue;
    const id = p.match(/^<?@?!?(\d{17,20})>?$/);
    if (id) { if (!discordIds.includes(id[1])) discordIds.push(id[1]); }
    else if (aliases.length < 10) aliases.push(clip(p, 60));
  }
  return { aliases, discordIds };
}
const parseStatut = (t) => (/susp|doute|probab|pas s[uû]r|non confirm/i.test(String(t || '')) ? 'suspect' : 'confirme');
const get = (id) => db.entries.find((e) => e.id === Number(id));
const namesOf = (e) => [e.pseudo, ...(e.aliases || [])].map(norm).filter(Boolean);

/** Cherche par pseudo (texte) et/ou par identifiants Discord. exact = même pseudo ; approx = ressemblance (à vérifier). */
function search({ text, discordIds = [], extraNames = [] }) {
  const queries = [text, ...extraNames].map(norm).filter(Boolean);
  const exact = new Set(), approx = new Set();
  for (const e of db.entries) {
    if (discordIds.some((d) => (e.discordIds || []).includes(d))) { exact.add(e.id); continue; }
    const names = namesOf(e);
    for (const q of queries) {
      if (names.includes(q)) { exact.add(e.id); break; }
      if (q.length >= 4 && names.some((n) => n.length >= 4 && (n.includes(q) || q.includes(n)))) approx.add(e.id);
    }
  }
  return { exact: [...exact].map(get), approx: [...approx].filter((id) => !exact.has(id)).map(get) };
}

// ---------- affichage ----------
function entryEmbed(e, { staff = false } = {}) {
  const sus = e.statut === 'suspect';
  const emb = new EmbedBuilder().setColor(sus ? 0xf39c12 : 0xe74c3c)
    .setTitle(`${sus ? '⚠️' : '🚨'} ${clip(e.pseudo, 200)}`)
    .setDescription(sus ? '**Suspecté** : des signalements existent, mais ils ne sont pas tous confirmés.' : '**Arnaqueur confirmé** par le staff.');
  if (e.aliases?.length) emb.addFields({ name: 'Autres pseudos', value: clip(e.aliases.join(', '), 1000) });
  if (e.discordIds?.length) emb.addFields({ name: 'Compte(s) Discord', value: clip(e.discordIds.map((d) => `<@${d}> (\`${d}\`)`).join('\n'), 1000) });
  emb.addFields({ name: 'Ce qui s’est passé', value: clip(e.faits || '—', 1000) });
  if (e.preuves) emb.addFields({ name: 'Preuves', value: clip(e.preuves, 1000) });
  const foot = [`Fiche #${e.id}`, `ajoutée le ${frDate(e.addedAt)}`];
  if (e.updatedAt && e.updatedAt !== e.addedAt) foot.push(`modifiée le ${frDate(e.updatedAt)}`);
  if (staff && e.addedByName) foot.push(`par ${e.addedByName}`);
  return emb.setFooter({ text: foot.join(' · ') });
}
const SAFETY = 'ℹ️ Une personne absente de la liste n’est pas forcément fiable : reste prudent·e et ne donne jamais ton compte MSP.';

// ---------- commandes ----------
const defs = [
  new SlashCommandBuilder().setName('verifier-scam').setDescription('Vérifier si un pseudo est dans la liste des arnaqueurs')
    .addStringOption((o) => o.setName('pseudo').setDescription('Pseudo MSP ou Discord à vérifier').setMaxLength(60))
    .addUserOption((o) => o.setName('membre').setDescription('Ou choisis un membre du serveur')),
  new SlashCommandBuilder().setName('scam').setDescription('(Staff) Gérer la liste des arnaqueurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) => s.setName('ajouter').setDescription('Ajouter une fiche (un formulaire s’ouvre)'))
    .addSubcommand((s) => s.setName('modifier').setDescription('Modifier une fiche')
      .addStringOption((o) => o.setName('fiche').setDescription('Pseudo ou numéro de la fiche').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('retirer').setDescription('Supprimer une fiche')
      .addStringOption((o) => o.setName('fiche').setDescription('Pseudo ou numéro de la fiche').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('liste').setDescription('Voir toutes les fiches'))
    .addSubcommand((s) => s.setName('salon').setDescription('Choisir le salon où les fiches sont publiées (sans salon : désactiver)')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon d’alertes').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))),
];
const NAMES = defs.map((d) => d.name);

function isStaff(i) {
  if (i.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  const roles = (process.env.SCAM_STAFF_ROLE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return roles.length > 0 && roles.some((r) => i.member?.roles?.cache?.has?.(r));
}

function formModal(customId, title, e) {
  const input = (id, label, style, required, max, value, placeholder) => {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
    if (value) t.setValue(clip(value, max));
    if (placeholder) t.setPlaceholder(placeholder);
    return new ActionRowBuilder().addComponents(t);
  };
  const others = e ? [...(e.aliases || []), ...(e.discordIds || [])].join(', ') : '';
  return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(
    input('pseudo', 'Pseudo MSP de l’arnaqueur', TextInputStyle.Short, true, 60, e?.pseudo),
    input('autres', 'Autres pseudos / ID Discord', TextInputStyle.Short, false, 300, others, 'Séparés par des virgules (facultatif)'),
    input('faits', 'Ce qui s’est passé', TextInputStyle.Paragraph, true, 1000, e?.faits, 'Ex : a pris les articles puis a bloqué'),
    input('preuves', 'Preuves (liens, captures)', TextInputStyle.Paragraph, false, 500, e?.preuves, 'Lien vers un message ou une image (facultatif)'),
    input('statut', 'Statut : confirmé ou suspecté', TextInputStyle.Short, true, 20, e ? (e.statut === 'suspect' ? 'suspecté' : 'confirmé') : 'confirmé'),
  );
}

async function alertChannel(client) {
  const id = db.channelId || process.env.SCAMMERS_CHANNEL_ID;
  if (!id) return null;
  const ch = await client.channels.fetch(id).catch(() => null);
  return ch?.isTextBased() ? ch : null;
}
async function publish(client, e) { // crée ou met à jour le message de la fiche dans le salon d'alertes
  try {
    const ch = await alertChannel(client); if (!ch) return;
    const payload = { embeds: [entryEmbed(e)], allowedMentions: { parse: [] } };
    if (e.msgId) { const m = await ch.messages.fetch(e.msgId).catch(() => null); if (m) { await m.edit(payload); return; } }
    const m = await ch.send(payload); e.msgId = m.id; e.msgChannelId = ch.id; save();
  } catch (err) { console.error('[scam] publication', err.message); }
}
async function unpublish(client, e) {
  try {
    if (!e.msgId) return;
    const ch = await client.channels.fetch(e.msgChannelId || db.channelId || process.env.SCAMMERS_CHANNEL_ID).catch(() => null);
    const m = ch?.isTextBased() ? await ch.messages.fetch(e.msgId).catch(() => null) : null;
    if (m) await m.delete().catch(() => {});
  } catch {}
}

async function run(i) {
  if (i.commandName === 'verifier-scam') {
    const text = i.options.getString('pseudo');
    const user = i.options.getUser('membre');
    if (!text && !user) return i.reply({ content: 'Indique un **pseudo** ou choisis un **membre** à vérifier 🔎', flags: EPHEMERAL });
    const extra = [];
    if (user) { const m = await i.guild.members.fetch(user.id).catch(() => null); extra.push(user.username, user.globalName, m?.displayName); }
    const { exact, approx } = search({ text, discordIds: user ? [user.id] : [], extraNames: extra });
    const label = text || `<@${user.id}>`;
    if (!exact.length && !approx.length) {
      return i.reply({ content: `✅ **${clip(text || user.username, 60)}** n’est dans aucune fiche pour le moment.\n${SAFETY}`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
    }
    const out = { flags: EPHEMERAL, allowedMentions: { parse: [] }, embeds: [] };
    if (exact.length) {
      out.content = `🚨 **Attention** : ${label} correspond à ${exact.length > 1 ? `${exact.length} fiches` : 'une fiche'} du staff.`;
      out.embeds.push(...exact.slice(0, 3).map((e) => entryEmbed(e)));
    } else out.content = `⚠️ Aucune fiche exacte pour ${label}, mais des pseudos **qui y ressemblent** existent. Vérifie bien avant de faire confiance :`;
    if (approx.length) out.content += `\n🔎 Pseudos ressemblants : ${approx.slice(0, 5).map((e) => `**${clip(e.pseudo, 40)}** (#${e.id})`).join(', ')}`;
    if (!exact.length) out.embeds.push(...approx.slice(0, 2).map((e) => entryEmbed(e)));
    return i.reply(out);
  }
  if (i.commandName !== 'scam') return;
  if (!isStaff(i)) return i.reply({ content: 'Commande réservée au staff 🔒', flags: EPHEMERAL });
  const sub = i.options.getSubcommand();
  if (sub === 'ajouter') return i.showModal(formModal('scam:add', 'Nouvelle fiche arnaqueur'));
  if (sub === 'modifier') {
    const e = get(i.options.getString('fiche'));
    if (!e) return i.reply({ content: 'Fiche introuvable : choisis-la dans la liste qui s’affiche en tapant.', flags: EPHEMERAL });
    return i.showModal(formModal(`scam:edit:${e.id}`, `Modifier la fiche #${e.id}`, e));
  }
  if (sub === 'retirer') {
    const e = get(i.options.getString('fiche'));
    if (!e) return i.reply({ content: 'Fiche introuvable : choisis-la dans la liste qui s’affiche en tapant.', flags: EPHEMERAL });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`scam:del:${e.id}`).setLabel('Oui, supprimer').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('scam:cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary));
    return i.reply({ content: `Supprimer la fiche **#${e.id} · ${clip(e.pseudo, 60)}** ? C’est définitif.`, components: [row], flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }
  if (sub === 'liste') {
    if (!db.entries.length) return i.reply({ content: 'La liste est vide pour le moment.', flags: EPHEMERAL });
    const lines = [...db.entries].reverse().map((e) => `**#${e.id}** · ${e.statut === 'suspect' ? '⚠️' : '🚨'} ${clip(e.pseudo, 40)} · ${frDate(e.addedAt)}${e.addedByName ? ` · ${clip(e.addedByName, 20)}` : ''}`);
    let text = '', shown = 0;
    for (const l of lines) { if (text.length + l.length > 3800) break; text += `${l}\n`; shown++; }
    if (shown < lines.length) text += `…et ${lines.length - shown} autres (utilise /verifier-scam ou /scam modifier pour les retrouver).`;
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle(`Liste des arnaqueurs (${db.entries.length})`).setDescription(text)], flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }
  if (sub === 'salon') {
    const ch = i.options.getChannel('salon');
    db.channelId = ch ? ch.id : ''; save();
    if (!ch) return i.reply({ content: 'Publication dans un salon désactivée (la commande /verifier-scam continue de fonctionner).', flags: EPHEMERAL });
    const me = ch.permissionsFor?.(i.guild.members.me);
    const ok = !me || (me.has(PermissionFlagsBits.ViewChannel) && me.has(PermissionFlagsBits.SendMessages) && me.has(PermissionFlagsBits.EmbedLinks));
    return i.reply({ content: `Les nouvelles fiches seront publiées dans <#${ch.id}>.${ok ? '' : '\n⚠️ Je n’ai pas tous les droits dans ce salon (voir, écrire, intégrer des liens) : ajoute-les sinon rien ne s’affichera.'}`, flags: EPHEMERAL });
  }
}

async function onModal(i) {
  const staffOk = isStaff(i);
  if (!staffOk) return i.reply({ content: 'Réservé au staff 🔒', flags: EPHEMERAL });
  const f = (k) => i.fields.getTextInputValue(k).trim();
  const { aliases, discordIds } = parseOthers(f('autres'));
  const base = { pseudo: clip(f('pseudo'), 60), aliases, discordIds, faits: f('faits'), preuves: f('preuves'), statut: parseStatut(f('statut')) };
  if (!norm(base.pseudo)) return i.reply({ content: 'Le pseudo est vide ou illisible.', flags: EPHEMERAL });
  const now = Date.now();
  if (i.customId === 'scam:add') {
    const dup = search({ text: base.pseudo, discordIds }).exact[0];
    const e = { id: db.next++, ...base, addedBy: i.user.id, addedByName: i.member?.displayName || i.user.username, addedAt: now, updatedAt: now };
    db.entries.push(e); save();
    await i.reply({ content: `✅ Fiche **#${e.id}** ajoutée pour **${clip(e.pseudo, 60)}**.${dup ? `\n⚠️ Attention : une fiche existait déjà pour ce pseudo (#${dup.id}). Tu peux supprimer l’une des deux avec /scam retirer.` : ''}`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
    return publish(i.client, e);
  }
  const m = i.customId.match(/^scam:edit:(\d+)$/); const e = m && get(m[1]);
  if (!e) return i.reply({ content: 'Cette fiche n’existe plus.', flags: EPHEMERAL });
  Object.assign(e, base, { updatedAt: now }); save();
  await i.reply({ content: `✅ Fiche **#${e.id}** mise à jour.`, flags: EPHEMERAL });
  return publish(i.client, e);
}

async function onButton(i) {
  if (!isStaff(i)) return i.reply({ content: 'Réservé au staff 🔒', flags: EPHEMERAL });
  if (i.customId === 'scam:cancel') return i.update({ content: 'Suppression annulée.', components: [] });
  const m = i.customId.match(/^scam:del:(\d+)$/); const e = m && get(m[1]);
  if (!e) return i.update({ content: 'Cette fiche n’existe plus.', components: [] });
  db.entries = db.entries.filter((x) => x.id !== e.id); save();
  await unpublish(i.client, e);
  return i.update({ content: `🗑️ Fiche **#${e.id} · ${clip(e.pseudo, 60)}** supprimée.`, components: [], allowedMentions: { parse: [] } });
}

function onAutocomplete(i) {
  const q = norm(i.options.getFocused());
  const hits = db.entries.filter((e) => !q || namesOf(e).some((n) => n.includes(q)) || String(e.id) === q).slice(-25).reverse();
  return i.respond(hits.map((e) => ({ name: clip(`#${e.id} · ${e.pseudo}`, 100), value: String(e.id) })));
}

function register(client) {
  backupIfNeeded();
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.guild?.id !== GUILD_ID()) return;
      if (i.isAutocomplete() && i.commandName === 'scam' && isStaff(i)) return await onAutocomplete(i);
      if (i.isModalSubmit() && i.customId.startsWith('scam:')) return await onModal(i);
      if (i.isButton() && i.customId.startsWith('scam:')) return await onButton(i);
    } catch (e) {
      console.error('[scam]', e);
      try { if (i.isRepliable?.() && !i.replied && !i.deferred) await i.reply({ content: 'Oups, une erreur est survenue 😕', flags: EPHEMERAL }); } catch {}
    }
  });
}

module.exports = { defs, NAMES, run, register, _test: { search, parseOthers, parseStatut, norm, db: () => db } };
