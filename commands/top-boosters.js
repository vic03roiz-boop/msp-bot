const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top-boosters')
    .setDescription('Affiche le classement des boosters du serveur, du plus ancien au plus récent'),

  async execute(interaction) {
    await interaction.deferReply();

    const members = await interaction.guild.members.fetch();
    const boosters = members
      .filter(m => m.premiumSince)
      .sort((a, b) => a.premiumSince - b.premiumSince); // le plus ancien booster en premier

    if (boosters.size === 0) {
      return interaction.editReply({ content: "Aucun membre ne booste actuellement le serveur." });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF73FA)
      .setTitle('🚀 Classement des boosters')
      .setDescription(
        [...boosters.values()]
          .map((m, i) => `**${i + 1}.** ${m} — booste depuis <t:${Math.floor(m.premiumSince.getTime() / 1000)}:D>`)
          .join('\n')
      )
      .setFooter({ text: `${boosters.size} booster(s) au total` });

    return interaction.editReply({ embeds: [embed] });
  },
};
