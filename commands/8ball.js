const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ANSWERS = [
  "C'est certain.", "Sans aucun doute.", "Oui, définitivement.", "Tu peux compter dessus.",
  "Selon moi, oui.", "Très probable.", "Les perspectives sont bonnes.", "Oui.",
  "Les signes indiquent que oui.", "Réponse floue, réessaie.", "Redemande plus tard.",
  "Mieux vaut ne pas te répondre maintenant.", "Impossible de prédire maintenant.",
  "Concentre-toi et redemande.", "N'y compte pas.", "Ma réponse est non.",
  "Mes sources disent non.", "Les perspectives ne sont pas si bonnes.", "Très douteux.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Pose une question à la boule magique')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Ta question')
        .setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🎱 Boule magique')
      .addFields(
        { name: 'Question', value: question },
        { name: 'Réponse', value: answer },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
