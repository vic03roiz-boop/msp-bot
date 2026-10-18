// Point d'entrée :
//   const statsServeur = require('./stats-serveur');
//   statsServeur.init(client);   // UNE fois, juste après `bonbons.init(...)`
// Variables Railway : GUILD_ID (déjà là) et STATS_CHANNEL_ID (salon logs réservé aux admins, pour le rapport du lundi).
const { Events, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const data = require('./data');
const report = require('./report');

const EPHEMERAL = 64;
const GUILD_ID = () => process.env.GUILD_ID || '';
const LOG_CHANNEL = () => process.env.STATS_CHANNEL_ID || '';
const EXCLUDED = () => (process.env.STATS_EXCLUDED_CHANNEL_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

const def = new SlashCommandBuilder().setName('stats').setDescription('(Admin) Statistiques du serveur en graphiques')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addIntegerOption((o) => o.setName('jours').setDescription('Période').addChoices({ name: '7 jours', value: 7 }, { name: '30 jours', value: 30 }, { name: '90 jours', value: 90 }));

async function logChannel(client) {
  const id = LOG_CHANNEL();
  if (!id) return null;
  const ch = await client.channels.fetch(id).catch(() => null);
  return ch && ch.isTextBased() ? ch : null;
}

async function run(i) {
  if (!i.memberPermissions?.has(PermissionFlagsBits.Administrator)) return i.reply({ content: 'Commande réservée aux administrateurs 🔒', flags: EPHEMERAL });
  await i.deferReply({ flags: EPHEMERAL });
  const n = i.options.getInteger('jours') || 7;
  const payload = await report.build(i.guild, n);
  const ch = await logChannel(i.client);
  if (ch) {
    await ch.send(payload);
    return i.editReply(`Rapport envoyé dans <#${ch.id}> 📊`);
  }
  return i.editReply({ ...payload, content: 'Astuce : ajoute la variable STATS_CHANNEL_ID (salon logs admin) pour recevoir le rapport du lundi automatiquement.' });
}

function init(client) {
  const cmd = { data: def, execute: run };
  const ownRegistration = !client.commands;
  if (client.commands) client.commands.set(def.name, cmd);

  client.on(Events.MessageCreate, (msg) => {
    try {
      if (!msg.guild || msg.guild.id !== GUILD_ID() || msg.author.bot || msg.webhookId) return;
      if (EXCLUDED().includes(msg.channel.id)) return;
      data.recordMessage(msg.author.id, msg.channel.id, msg.createdTimestamp);
    } catch (e) { console.error('[stats] message', e.message); }
  });
  client.on(Events.GuildMemberAdd, (m) => { if (m.guild.id === GUILD_ID() && !m.user.bot) data.recordJoin(m.guild.memberCount); });
  client.on(Events.GuildMemberRemove, (m) => { if (m.guild.id === GUILD_ID() && !m.user?.bot) data.recordLeave(m.guild.memberCount); });

  if (ownRegistration) {
    client.on(Events.InteractionCreate, (i) => {
      if (i.isChatInputCommand() && i.commandName === 'stats' && i.guild?.id === GUILD_ID()) run(i).catch((e) => console.error('[stats]', e));
    });
  }

  const start = async () => {
    const guild = client.guilds.cache.get(GUILD_ID());
    if (!guild) return console.error('[stats] GUILD_ID introuvable : vérifie la variable GUILD_ID');
    data.snapshotMembers(guild.memberCount);
    if (ownRegistration) await guild.commands.create(def.toJSON()).catch((e) => console.error('[stats] commande', e.message));
    // Vocal : +1 minute par minute passée dans un salon vocal (hors AFK) — c'est de la présence, pas des gains.
    setInterval(() => {
      try {
        for (const ch of guild.channels.cache.values()) {
          if (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice) continue;
          if (ch.id === guild.afkChannelId) continue;
          for (const m of ch.members.values()) if (!m.user.bot) data.recordVoiceMinute(m.id);
        }
      } catch (e) { console.error('[stats] vocal', e.message); }
    }, 60 * 1000).unref();
    // Compte de membres relevé toutes les heures + rapport automatique le lundi à 9 h (Paris).
    setInterval(async () => {
      try {
        data.snapshotMembers(guild.memberCount);
        const today = data.dayKeyOf();
        const meta = data.db().meta;
        if (data.weekdayOf() === 'Mon' && data.hourOf() >= 9 && meta.lastWeekly !== today) {
          const ch = await logChannel(client);
          if (!ch) return;
          meta.lastWeekly = today;
          data.saveNow();
          await ch.send({ content: '📊 **Rapport de la semaine**', ...(await report.build(guild, 7)) });
        }
      } catch (e) { console.error('[stats] rapport', e.message); }
    }, 5 * 60 * 1000).unref();
    console.log('[stats] 📊 statistiques du serveur prêtes');
  };
  if (client.isReady()) start(); else client.once(Events.ClientReady, start);
}

module.exports = { init };
