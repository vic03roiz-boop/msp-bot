const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const messageStats = require('../utils/messageStats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plus-actifs')
    .setDescription('Classement des membres les plus actifs')
    .addStringOption(option =>
      option.setName('periode')
        .setDescription('Période du classement (par défaut : dernière semaine)')
        .addChoices(
          { name: 'Depuis le début du suivi', value: 'total' },
          { name: 'Dernier jour', value: 'jour' },
          { name: 'Dernière semaine', value: 'semaine' },
          { name: 'Dernier mois', value: 'mois' },
        )),

  async execute(interaction) {
    const periode = interaction.options.getString('periode') ?? 'semaine';
    const labels = { total: 'depuis le début du suivi', jour: 'du dernier jour', semaine: 'de la dernière semaine', mois: 'du dernier mois' };

    const leaderboard = messageStats.getLeaderboard(interaction.guild.id, periode, 10);

    if (leaderboard.length === 0) {
      return interaction.reply({ content: "Pas encore assez de données pour établir un classement.", ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle(`💬 Membres les plus actifs — ${labels[periode]}`)
      .setDescription(
        leaderboard
          .map((entry, i) => `${medals[i] ?? `**${i + 1}.**`} <@${entry.userId}> — ${entry.count} message(s)`)
          .join('\n')
      );

    return interaction.reply({ embeds: [embed] });
  },
};
