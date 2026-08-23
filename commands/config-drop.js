const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-drop')
    .setDescription('Configure le salon de tickets à utiliser pour les drops')
    .addChannelOption(option =>
      option.setName('salon_tickets')
        .setDescription('Le salon où les membres doivent ouvrir un ticket pour récupérer leur lot')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon_tickets');

    storage.saveGuildConfig(interaction.guild.id, { ticketsChannelId: channel.id });

    return interaction.reply({ content: `✅ Le salon de tickets pour les drops est maintenant ${channel}.`, ephemeral: true });
  },
};
