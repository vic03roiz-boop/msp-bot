const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avent-configurer')
    .setDescription('Configure la surprise (et une question du jour en option) d\'un jour du calendrier de l\'Avent')
    .addIntegerOption(option =>
      option.setName('jour')
        .setDescription('Le jour de décembre concerné (1 à 24)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(24))
    .addStringOption(option =>
      option.setName('lot')
        .setDescription('Le lot à révéler quand on clique sur la case ce jour-là')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Une question/devinette à poster publiquement pour lancer la discussion ce jour-là (optionnel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const jour = interaction.options.getInteger('jour');
    const lot = interaction.options.getString('lot');
    const question = interaction.options.getString('question');

    const config = storage.getGuildConfig(interaction.guild.id);
    const adventContent = { ...(config.adventContent || {}), [jour]: { prize: lot, question } };
    storage.saveGuildConfig(interaction.guild.id, { adventContent });

    return interaction.reply({
      content: `✅ Jour **${jour} décembre** configuré (lot défini${question ? ', avec une question du jour' : ''}).`,
      ephemeral: true,
    });
  },
};
