const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-logs')
    .setDescription('Désigne le salon où seront archivés les comptes-rendus des tickets fermés')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon de logs')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    storage.saveGuildConfig(interaction.guild.id, { ticketLogsChannelId: channel.id });
    return interaction.reply({ content: `✅ Les comptes-rendus de tickets seront archivés dans ${channel}.`, ephemeral: true });
  },
};
