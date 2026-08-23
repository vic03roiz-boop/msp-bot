const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('Crée un sondage avec réactions')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('La question du sondage')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('option1')
        .setDescription('Première option de réponse')
        .setRequired(true))
    .addStringOption(option => option.setName('option2').setDescription('Deuxième option de réponse'))
    .addStringOption(option => option.setName('option3').setDescription('Troisième option de réponse'))
    .addStringOption(option => option.setName('option4').setDescription('Quatrième option de réponse'))
    .addStringOption(option => option.setName('option5').setDescription('Cinquième option de réponse')),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [1, 2, 3, 4, 5]
      .map(n => interaction.options.getString(`option${n}`))
      .filter(Boolean);

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('📊 Sondage')
      .setDescription(
        `**${question}**\n\n` +
        options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`).join('\n')
      )
      .setFooter({ text: `Sondage lancé par ${interaction.user.username}` });

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await message.react(NUMBER_EMOJIS[i]);
    }
  },
};
