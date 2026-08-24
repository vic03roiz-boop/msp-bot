const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-recap')
    .setDescription('Configure le récap hebdomadaire automatique du serveur')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où poster le récap chaque dimanche')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('heure')
        .setDescription('Heure d\'envoi en UTC (défaut : 18, soit 19h ou 20h en France selon la saison)')
        .setMinValue(0)
        .setMaxValue(23))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const heure = interaction.options.getInteger('heure') ?? 18;

    storage.saveGuildConfig(interaction.guild.id, { recapChannelId: channel.id, recapHourUTC: heure });

    return interaction.reply({
      content: `✅ Le récap hebdomadaire sera envoyé dans ${channel} chaque dimanche vers ${heure}h UTC.`,
      ephemeral: true,
    });
  },
};
