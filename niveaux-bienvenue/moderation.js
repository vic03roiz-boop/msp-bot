// Modération assistée, avec historique par membre (visible uniquement par le staff).
//   /avertir membre raison            avertissement noté + MP au membre + log staff
//   /muet membre durée [raison]       met le membre en sourdine (timeout Discord) + MP + log
//   /muet-retirer membre              lève la sourdine
//   /historique membre                tous les avertissements / sourdines du membre (réponse visible par toi seul)
//   /mod-retirer numero               annule un avertissement par erreur (il reste dans l'historique, barré)
// Variables Railway facultatives :
//   MOD_LOG_CHANNEL_ID   salon staff où chaque action est loguée
//   MOD_SEUIL_MUTE       nombre d'avertissements actifs qui déclenche une sourdine automatique (ex : 3 ; vide = désactivé)
//   MOD_AUTO_MUTE_MIN    durée de cette sourdine automatique en minutes (défaut : 60)
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Events } = require('discord.js');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'moderation.json');
const MAX_TIMEOUT = 28 * 24 * 60 * 60 * 1000;

let db = { next: 1, cases: [] }; // cases: { id, userId, type: 'avertir'|'muet'|'muet-retire'|'auto-muet', modId, reason, ts, minutes?, removed? }
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[moderation] sauvegarde', e.message); } }

const perm = PermissionFlagsBits.ModerateMembers;
const DUREES = [['10 minutes', 10], ['1 heure', 60], ['6 heures', 360], ['12 heures', 720], ['1 jour', 1440], ['3 jours', 4320], ['7 jours', 10080]];
const defs = [
  new SlashCommandBuilder().setName('avertir').setDescription('(Staff) Avertir un membre').setDefaultMemberPermissions(perm)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addStringOption((o) => o.setName('raison').setDescription('Raison de l’avertissement').setMaxLength(500).setRequired(true)),
  new SlashCommandBuilder().setName('muet').setDescription('(Staff) Mettre un membre en sourdine').setDefaultMemberPermissions(perm)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true))
    .addIntegerOption((o) => { o.setName('duree').setDescription('Durée de la sourdine').setRequired(true); DUREES.forEach(([n, v]) => o.addChoices({ name: n, value: v })); return o; })
    .addStringOption((o) => o.setName('raison').setDescription('Raison').setMaxLength(500)),
  new SlashCommandBuilder().setName('muet-retirer').setDescription('(Staff) Lever la sourdine d’un membre').setDefaultMemberPermissions(perm)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  new SlashCommandBuilder().setName('historique').setDescription('(Staff) Historique de modération d’un membre').setDefaultMemberPermissions(perm)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre').setRequired(true)),
  new SlashCommandBuilder().setName('mod-retirer').setDescription('(Staff) Annuler un avertissement (par son numéro)').setDefaultMemberPermissions(perm)
    .addIntegerOption((o) => o.setName('numero').setDescription('Numéro affiché dans /historique').setMinValue(1).setRequired(true)),
];
const NAMES = defs.map((d) => d.name);

const LABEL = { avertir: '⚠️ Avertissement', muet: '🔇 Sourdine', 'auto-muet': '🤖 Sourdine automatique', 'muet-retire': '🔊 Sourdine levée' };
const actifs = (uid) => db.cases.filter((c) => c.userId === uid && c.type === 'avertir' && !c.removed).length;
const ts = (t) => `<t:${Math.floor(t / 1000)}:d>`;
const fmtMin = (m) => (m >= 1440 ? `${m / 1440} j` : m >= 60 ? `${m / 60} h` : `${m} min`);

async function logStaff(client, embed) {
  const id = process.env.MOD_LOG_CHANNEL_ID;
  if (!id) return;
  const ch = await client.channels.fetch(id).catch(() => null);
  ch?.isTextBased() && ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}
function logEmbed(c, target, mod) {
  const e = new EmbedBuilder().setColor(c.type === 'avertir' ? 0xF2C14E : 0xB5838D).setTitle(`${LABEL[c.type]} · cas n°${c.id}`)
    .addFields({ name: 'Membre', value: `<@${target}> (${target})`, inline: true }, { name: 'Par', value: mod ? `<@${mod}>` : 'Automatique', inline: true });
  if (c.minutes) e.addFields({ name: 'Durée', value: fmtMin(c.minutes), inline: true });
  if (c.reason) e.addFields({ name: 'Raison', value: c.reason });
  return e.setTimestamp(c.ts);
}
async function dm(user, title, lines, color) {
  try { await user.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(lines.join('\n'))] }); return true; } catch { return false; }
}
/** Le modérateur peut-il agir sur ce membre ? Renvoie un message d’erreur ou null. */
function verifier(i, member, user) {
  if (!member) return 'Ce membre n’est pas (ou plus) sur le serveur.';
  if (user.bot) return 'Je ne modère pas les bots.';
  if (user.id === i.user.id) return 'Tu ne peux pas faire ça sur toi-même.';
  if (member.id === i.guild.ownerId) return 'Impossible : c’est la propriétaire du serveur.';
  if (i.user.id !== i.guild.ownerId && i.member.roles?.highest && member.roles.highest.position >= i.member.roles.highest.position) return 'Son rôle est égal ou supérieur au tien.';
  return null;
}
async function mute(i, member, minutes, reason) {
  const ms = Math.min(minutes * 60000, MAX_TIMEOUT);
  await member.timeout(ms, `${reason || 'Sourdine'} (par ${i.user.tag})`);
}

async function run(i) {
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const cmd = i.commandName, client = i.client;

  if (cmd === 'avertir') {
    const user = i.options.getUser('membre'), reason = i.options.getString('raison');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const err = verifier(i, member, user); if (err) return i.reply({ content: `❌ ${err}`, flags: EPHEMERAL });
    const c = { id: db.next++, userId: user.id, type: 'avertir', modId: i.user.id, reason, ts: Date.now() }; db.cases.push(c); save();
    const n = actifs(user.id), seuil = parseInt(process.env.MOD_SEUIL_MUTE, 10) || 0;
    const mp = await dm(user, `Avertissement sur ${i.guild.name}`, [`**Raison :** ${reason}`, '', `Tu as **${n}** avertissement${n > 1 ? 's' : ''}. Merci de respecter le règlement du serveur.`], 0xF2C14E);
    await logStaff(client, logEmbed(c, user.id, i.user.id));
    let extra = '';
    if (seuil && n >= seuil && n % seuil === 0) {
      const min = parseInt(process.env.MOD_AUTO_MUTE_MIN, 10) || 60;
      try {
        await mute(i, member, min, `${n} avertissements`);
        const a = { id: db.next++, userId: user.id, type: 'auto-muet', modId: null, reason: `${n} avertissements atteints`, minutes: min, ts: Date.now() }; db.cases.push(a); save();
        await logStaff(client, logEmbed(a, user.id, null));
        extra = `\n🤖 Seuil de ${seuil} atteint : sourdine automatique de ${fmtMin(min)}.`;
      } catch { extra = '\n⚠️ Seuil atteint mais je n’ai pas pu le mettre en sourdine (permissions ou hiérarchie des rôles).'; }
    }
    return i.reply({ content: `⚠️ <@${user.id}> averti (cas n°${c.id}, ${n} actif${n > 1 ? 's' : ''}). ${mp ? 'MP envoyé.' : 'MP impossible (messages privés fermés).'}${extra}`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }

  if (cmd === 'muet') {
    const user = i.options.getUser('membre'), minutes = i.options.getInteger('duree'), reason = i.options.getString('raison') || '';
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const err = verifier(i, member, user); if (err) return i.reply({ content: `❌ ${err}`, flags: EPHEMERAL });
    try { await mute(i, member, minutes, reason); } catch { return i.reply({ content: '❌ Je ne peux pas le mettre en sourdine (mon rôle doit être au-dessus du sien, avec la permission « Exclure temporairement des membres »).', flags: EPHEMERAL }); }
    const c = { id: db.next++, userId: user.id, type: 'muet', modId: i.user.id, reason, minutes, ts: Date.now() }; db.cases.push(c); save();
    const mp = await dm(user, `Sourdine sur ${i.guild.name}`, [`Tu es en sourdine pendant **${fmtMin(minutes)}**.`, reason ? `**Raison :** ${reason}` : ''].filter(Boolean), 0xB5838D);
    await logStaff(client, logEmbed(c, user.id, i.user.id));
    return i.reply({ content: `🔇 <@${user.id}> en sourdine pour ${fmtMin(minutes)} (cas n°${c.id}). ${mp ? 'MP envoyé.' : 'MP impossible.'}`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }

  if (cmd === 'muet-retirer') {
    const user = i.options.getUser('membre');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (!member) return i.reply({ content: '❌ Membre introuvable.', flags: EPHEMERAL });
    if (!member.isCommunicationDisabled()) return i.reply({ content: 'Ce membre n’est pas en sourdine.', flags: EPHEMERAL });
    try { await member.timeout(null, `Sourdine levée par ${i.user.tag}`); } catch { return i.reply({ content: '❌ Impossible de lever la sourdine (permissions).', flags: EPHEMERAL }); }
    const c = { id: db.next++, userId: user.id, type: 'muet-retire', modId: i.user.id, reason: '', ts: Date.now() }; db.cases.push(c); save();
    await logStaff(client, logEmbed(c, user.id, i.user.id));
    return i.reply({ content: `🔊 Sourdine de <@${user.id}> levée.`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }

  if (cmd === 'historique') {
    const user = i.options.getUser('membre');
    const list = db.cases.filter((c) => c.userId === user.id).sort((a, b) => b.ts - a.ts);
    const n = actifs(user.id), tot = list.filter((c) => c.type === 'avertir').length, mutes = list.filter((c) => c.type === 'muet' || c.type === 'auto-muet').length;
    const lignes = list.slice(0, 15).map((c) => {
      const t = `${LABEL[c.type]}${c.minutes ? ` (${fmtMin(c.minutes)})` : ''}`;
      const head = `**#${c.id}** · ${t} · ${ts(c.ts)} · ${c.modId ? `<@${c.modId}>` : 'auto'}`;
      const body = c.reason ? `\n> ${c.removed ? `~~${c.reason}~~ *(annulé)*` : c.reason}` : '';
      return head + body;
    });
    let desc = lignes.join('\n\n') || 'Aucun antécédent. Dossier vierge ✨';
    if (desc.length > 3900) desc = desc.slice(0, 3900) + '…';
    const e = new EmbedBuilder().setColor(n ? 0xF2C14E : 0xC4D6C3).setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setTitle('Historique de modération').setDescription(desc)
      .setFooter({ text: `${n} avertissement(s) actif(s) · ${tot} au total · ${mutes} sourdine(s)${list.length > 15 ? ` · 15 derniers sur ${list.length}` : ''}` });
    return i.reply({ embeds: [e], flags: EPHEMERAL });
  }

  if (cmd === 'mod-retirer') {
    const id = i.options.getInteger('numero'), c = db.cases.find((x) => x.id === id);
    if (!c || c.type !== 'avertir') return i.reply({ content: '❌ Aucun avertissement avec ce numéro.', flags: EPHEMERAL });
    if (c.removed) return i.reply({ content: 'Cet avertissement est déjà annulé.', flags: EPHEMERAL });
    c.removed = { by: i.user.id, ts: Date.now() }; save();
    await logStaff(client, new EmbedBuilder().setColor(0xC4D6C3).setTitle(`↩️ Avertissement n°${id} annulé`).setDescription(`Membre : <@${c.userId}>\nPar : <@${i.user.id}>`).setTimestamp());
    return i.reply({ content: `↩️ Avertissement n°${id} annulé (il reste visible barré dans l’historique). Il en reste ${actifs(c.userId)} actif(s) pour <@${c.userId}>.`, flags: EPHEMERAL, allowedMentions: { parse: [] } });
  }
}

function register() { /* rien à écouter : tout passe par les commandes */ }
module.exports = { defs, NAMES, run, register };
