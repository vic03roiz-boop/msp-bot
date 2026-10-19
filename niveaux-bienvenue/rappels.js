// Rappel permanent en bas d’un salon (ex : règlement du salon « ventes »).
// À chaque nouveau message dans le salon, le bot supprime son ancien rappel et le reposte tout en bas : il est donc toujours visible.
//   /rappel-salon activer salon      choisir le salon, puis écrire (ou modifier) le texte dans un formulaire
//   /rappel-salon desactiver salon   retirer le rappel de ce salon
//   /rappel-salon voir               salons concernés
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType, Events } = require('discord.js');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'rappels.json');
const GUILD = () => process.env.GUILD_ID || '';
const DELAI = 4000; // on attend 4 s sans nouveau message avant de reposter (évite de spammer le salon)

const TEXTE_VENTES = [
  '**Le serveur n’est pas responsable des ventes, échanges ou arnaques entre membres.** Chaque transaction se fait à tes risques.',
  '',
  '• Méfie-toi des offres trop belles pour être vraies.',
  '• Ne paie jamais à l’avance un membre que tu ne connais pas.',
  '• Ne communique jamais ton mot de passe MovieStarPlanet, même « pour vérifier ».',
  '• Pas de remboursement ni de recours possible de la part du staff en cas de scam.',
  '• En cas de doute ou d’arnaque, ouvre un ticket 🎫',
].join('\n');

let db = { channels: {} }; // channels: id -> { text, last }
try { db = { ...db, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); } catch (e) { console.error('[rappels] sauvegarde', e.message); } }

const perm = PermissionFlagsBits.ManageGuild;
const defs = [
  new SlashCommandBuilder().setName('rappel-salon').setDescription('(Staff) Rappel permanent en bas d’un salon').setDefaultMemberPermissions(perm)
    .addSubcommand((s) => s.setName('activer').setDescription('Mettre (ou modifier) le rappel d’un salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('desactiver').setDescription('Retirer le rappel d’un salon')
      .addChannelOption((o) => o.setName('salon').setDescription('Le salon').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('voir').setDescription('Voir les salons avec un rappel')),
];
const NAMES = defs.map((d) => d.name);

const embedFor = (text) => new EmbedBuilder().setColor(0xF2C14E).setTitle('⚠️ Règlement du salon').setDescription(text).setFooter({ text: 'Rappel automatique · lis-le avant d’acheter ou de vendre' });

async function poster(client, chId) {
  const cfg = db.channels[chId]; if (!cfg) return;
  const ch = await client.channels.fetch(chId).catch(() => null);
  if (!ch?.isTextBased()) return;
  if (cfg.last) { const old = await ch.messages.fetch(cfg.last).catch(() => null); await old?.delete().catch(() => {}); }
  const m = await ch.send({ embeds: [embedFor(cfg.text)], allowedMentions: { parse: [] } }).catch((e) => { console.error('[rappels] envoi', e.message); return null; });
  cfg.last = m?.id || null; save();
}

async function run(i, client) {
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const sub = i.options.getSubcommand();
  if (sub === 'activer') {
    const ch = i.options.getChannel('salon');
    const modal = new ModalBuilder().setCustomId(`rappel:${ch.id}`).setTitle('Rappel du salon');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('texte').setLabel('Texte du rappel').setStyle(TextInputStyle.Paragraph).setMaxLength(1800).setRequired(true).setValue(db.channels[ch.id]?.text || TEXTE_VENTES)));
    return i.showModal(modal);
  }
  if (sub === 'desactiver') {
    const ch = i.options.getChannel('salon'), c = db.channels[ch.id];
    if (!c) return i.reply({ content: 'Pas de rappel dans ce salon.', flags: EPHEMERAL });
    if (c.last) { const m = await ch.messages.fetch(c.last).catch(() => null); await m?.delete().catch(() => {}); }
    delete db.channels[ch.id]; save();
    return i.reply({ content: `✅ Rappel retiré de <#${ch.id}>.`, flags: EPHEMERAL });
  }
  const ids = Object.keys(db.channels);
  return i.reply({ content: ids.length ? ids.map((x) => `• <#${x}>`).join('\n') : 'Aucun rappel configuré. Utilise `/rappel-salon activer`.', flags: EPHEMERAL });
}

function register(client) {
  const timers = new Map();
  client.on(Events.MessageCreate, (m) => {
    if (!m.guild || m.guild.id !== GUILD() || !db.channels[m.channelId]) return;
    if (m.author?.id === client.user?.id) return;
    clearTimeout(timers.get(m.channelId));
    timers.set(m.channelId, setTimeout(() => poster(client, m.channelId).catch((e) => console.error('[rappels]', e.message)), DELAI));
  });
  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.guild?.id !== GUILD() || !i.isModalSubmit() || !i.customId.startsWith('rappel:')) return;
      if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
      const chId = i.customId.split(':')[1], text = i.fields.getTextInputValue('texte').trim();
      const prev = db.channels[chId]; db.channels[chId] = { text, last: prev?.last || null }; save();
      await i.reply({ content: `✅ Rappel activé dans <#${chId}>. Il se reposte tout seul en bas du salon à chaque nouveau message.`, flags: EPHEMERAL });
      await poster(client, chId);
    } catch (e) { console.error('[rappels] formulaire', e.message); }
  });
}
module.exports = { defs, NAMES, run, register };
