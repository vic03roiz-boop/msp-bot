// Statut du bot qui change tout seul : en ligne, en live (streaming), « lune » (inactif), personnalisé, etc.
//   /statut liste                          voir la rotation
//   /statut ajouter mode type texte        ajouter un statut  (mode : en ligne / inactif 🌙 / ne pas déranger ; type : personnalisé / live / joue à / regarde / écoute / participe à)
//   /statut retirer numero                 supprimer un statut
//   /statut pause / reprendre              figer le statut actuel / relancer la rotation
// Dans les textes : {membres} = nombre de membres, {saison} = l’emoji de la saison (🎃 🍁 🎄 ⛄).
// Variables Railway facultatives : STATUT_INTERVAL_SEC (défaut 60), STATUT_STREAM_URL (lien Twitch/YouTube affiché en « live »).
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ActivityType, EmbedBuilder, Events } = require('discord.js');
const themes = require('./themes');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'statut.json');
const MODES = { online: ['🟢', 'En ligne'], idle: ['🌙', 'Inactif (la lune)'], dnd: ['⛔', 'Ne pas déranger'] };
const TYPES = { custom: 'Personnalisé', stream: 'En live', play: 'Joue à', watch: 'Regarde', listen: 'Écoute', compete: 'Participe à' };
const ACT = { custom: ActivityType.Custom, stream: ActivityType.Streaming, play: ActivityType.Playing, watch: ActivityType.Watching, listen: ActivityType.Listening, compete: ActivityType.Competing };

const DEFAUT = [
  { mode: 'online', type: 'custom', text: '{saison} Bloomeria · tape /aide' },
  { mode: 'online', type: 'stream', text: 'Bloomeria {saison}' },
  { mode: 'idle', type: 'custom', text: '🌙 Je veille sur {membres} membres' },
  { mode: 'online', type: 'watch', text: 'les {membres} membres' },
  { mode: 'online', type: 'custom', text: '🎁 Des surprises arrivent…' },
  { mode: 'online', type: 'listen', text: 'vos idées 💡' },
];
let db = { list: DEFAUT, pause: false };
try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(d.list) && d.list.length) db = { ...db, ...d }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[statut] sauvegarde', e.message); } }

const perm = PermissionFlagsBits.ManageGuild;
const defs = [
  new SlashCommandBuilder().setName('statut').setDescription('(Staff) Régler les statuts du bot').setDefaultMemberPermissions(perm)
    .addSubcommand((s) => s.setName('liste').setDescription('Voir les statuts qui tournent'))
    .addSubcommand((s) => s.setName('ajouter').setDescription('Ajouter un statut à la rotation')
      .addStringOption((o) => o.setName('mode').setDescription('Pastille du bot').setRequired(true).addChoices(...Object.entries(MODES).map(([v, m]) => ({ name: m[1], value: v }))))
      .addStringOption((o) => o.setName('type').setDescription('Type de statut').setRequired(true).addChoices(...Object.entries(TYPES).map(([v, n]) => ({ name: n, value: v }))))
      .addStringOption((o) => o.setName('texte').setDescription('Le texte ({membres}, {saison} possibles)').setMaxLength(100).setRequired(true)))
    .addSubcommand((s) => s.setName('retirer').setDescription('Supprimer un statut').addIntegerOption((o) => o.setName('numero').setDescription('Numéro dans /statut liste').setMinValue(1).setRequired(true)))
    .addSubcommand((s) => s.setName('pause').setDescription('Figer le statut actuel'))
    .addSubcommand((s) => s.setName('reprendre').setDescription('Relancer la rotation')),
];
const NAMES = defs.map((d) => d.name);

let idx = 0, client = null;
function fill(t) {
  const g = client?.guilds?.cache?.get(process.env.GUILD_ID) || client?.guilds?.cache?.first?.();
  const T = themes.get(themes.currentName());
  return t.replace(/\{membres\}/g, String(g?.memberCount ?? '')).replace(/\{saison\}/g, T.main || '✨');
}
function apply() {
  if (!client?.user || db.pause || !db.list.length) return;
  const s = db.list[idx % db.list.length]; idx++;
  const text = fill(s.text).slice(0, 128);
  const act = s.type === 'custom' ? { type: ActivityType.Custom, name: 'Custom Status', state: text }
    : s.type === 'stream' ? { type: ActivityType.Streaming, name: text, url: process.env.STATUT_STREAM_URL || 'https://www.twitch.tv/discord' }
    : { type: ACT[s.type], name: text };
  try { client.user.setPresence({ status: s.mode, activities: [act] }); } catch (e) { console.error('[statut]', e.message); }
}

async function run(i) {
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const sub = i.options.getSubcommand(), rep = (c) => i.reply({ content: c, flags: EPHEMERAL });
  if (sub === 'liste') {
    const lines = db.list.map((s, k) => `**${k + 1}.** ${MODES[s.mode]?.[0] || '🟢'} ${TYPES[s.type] || s.type} · ${s.text}`);
    return i.reply({ embeds: [new EmbedBuilder().setColor(0xC4D6C3).setTitle('Statuts du bot').setDescription(lines.join('\n')).setFooter({ text: db.pause ? 'Rotation en pause' : `Change toutes les ${process.env.STATUT_INTERVAL_SEC || 60} s` })], flags: EPHEMERAL });
  }
  if (sub === 'ajouter') {
    if (db.list.length >= 20) return rep('❌ 20 statuts maximum.');
    db.list.push({ mode: i.options.getString('mode'), type: i.options.getString('type'), text: i.options.getString('texte') }); save();
    return rep(`✅ Statut ajouté (n°${db.list.length}).`);
  }
  if (sub === 'retirer') {
    const n = i.options.getInteger('numero');
    if (n > db.list.length) return rep('❌ Ce numéro n’existe pas.');
    if (db.list.length === 1) return rep('❌ Garde au moins un statut.');
    db.list.splice(n - 1, 1); save(); return rep('✅ Statut supprimé.');
  }
  if (sub === 'pause') { db.pause = true; save(); return rep('⏸️ Rotation en pause : le statut actuel reste affiché.'); }
  db.pause = false; save(); apply(); return rep('▶️ Rotation relancée.');
}

function register(c) {
  client = c;
  const start = () => { apply(); setInterval(apply, Math.max(20, parseInt(process.env.STATUT_INTERVAL_SEC, 10) || 60) * 1000).unref(); };
  if (c.isReady()) start(); else c.once(Events.ClientReady, start);
}
module.exports = { defs, NAMES, run, register };
