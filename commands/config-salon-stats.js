const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-salon-stats')
    .setDescription('Configure un salon vocal pour afficher le nombre de membres en direct')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon vocal à utiliser comme compteur')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');

    storage.saveGuildConfig(interaction.guild.id, { statsChannelId: channel.id });

    const newName = `ヾ✧˚・️☆ ${interaction.guild.memberCount} Membres`;
    await channel.setName(newName).catch(() => {});

    return interaction.reply({
      content: `✅ ${channel} affichera maintenant le nombre de membres en direct (mise à jour toutes les 15 minutes environ, Discord limite la fréquence des renommages).`,
      ephemeral: true,
    });
  },
};
