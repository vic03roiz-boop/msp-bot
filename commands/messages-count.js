const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const messageStats = require('../utils/messageStats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('messages-count')
    .setDescription('Affiche le nombre de messages envoyés par un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre concerné (par défaut : toi)'))
    .addStringOption(option =>
      option.setName('periode')
        .setDescription('Période à afficher (par défaut : toutes)')
        .addChoices(
          { name: 'Depuis son arrivée (suivi par le bot)', value: 'total' },
          { name: 'Dernier jour', value: 'jour' },
          { name: 'Dernière semaine', value: 'semaine' },
          { name: 'Dernier mois', value: 'mois' },
        )),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre') ?? interaction.user;
    const periode = interaction.options.getString('periode');

    const stats = messageStats.getUserStats(interaction.guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle(`💬 Messages de ${targetUser.username}`);

    if (periode) {
      const labels = { total: 'Depuis le début du suivi', jour: 'Dernier jour', semaine: 'Dernière semaine', mois: 'Dernier mois' };
      const value = periode === 'total' ? stats.total : stats[periode];
      embed.setDescription(`**${labels[periode]} :** ${value} message(s)`);
    } else {
      embed.addFields(
        { name: 'Depuis le début du suivi', value: `${stats.total}`, inline: true },
        { name: 'Dernier jour', value: `${stats.jour}`, inline: true },
        { name: 'Dernière semaine', value: `${stats.semaine}`, inline: true },
        { name: 'Dernier mois', value: `${stats.mois}`, inline: true },
      );
    }

    embed.setFooter({ text: "Le suivi ne compte que les messages envoyés depuis l'installation du bot." });

    return interaction.reply({ embeds: [embed] });
  },
};
