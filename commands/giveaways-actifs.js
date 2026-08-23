const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaways-actifs')
    .setDescription('Affiche la liste des giveaways actuellement en cours'),

  async execute(interaction) {
    const active = storage.getGiveaways().filter(
      g => g.guildId === interaction.guild.id && !g.ended
    );

    if (active.length === 0) {
      return interaction.reply({ content: "Il n'y a aucun giveaway en cours pour le moment.", ephemeral: true });
    }

    active.sort((a, b) => a.endTimestamp - b.endTimestamp);

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🎉 Giveaways en cours')
      .setDescription(
        active
          .map(g =>
            `**${g.prize}** dans <#${g.channelId}>\n` +
            `└ ${g.participants.length} participant(s) — fin <t:${Math.floor(g.endTimestamp / 1000)}:R>`
          )
          .join('\n\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
