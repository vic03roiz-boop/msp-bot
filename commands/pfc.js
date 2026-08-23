const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CHOICES = {
  pierre: { emoji: '🪨', beats: 'ciseaux' },
  feuille: { emoji: '📄', beats: 'pierre' },
  ciseaux: { emoji: '✂️', beats: 'feuille' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pfc')
    .setDescription('Affronte le bot à pierre-feuille-ciseaux')
    .addStringOption(option =>
      option.setName('choix')
        .setDescription('Ton choix')
        .setRequired(true)
        .addChoices(
          { name: 'Pierre 🪨', value: 'pierre' },
          { name: 'Feuille 📄', value: 'feuille' },
          { name: 'Ciseaux ✂️', value: 'ciseaux' },
        )),

  async execute(interaction) {
    const playerChoice = interaction.options.getString('choix');
    const options = Object.keys(CHOICES);
    const botChoice = options[Math.floor(Math.random() * options.length)];

    let resultText;
    let color;
    if (playerChoice === botChoice) {
      resultText = '🤝 Égalité !';
      color = 0xF39C12;
    } else if (CHOICES[playerChoice].beats === botChoice) {
      resultText = '🎉 Tu as gagné !';
      color = 0x2ECC71;
    } else {
      resultText = '😢 Tu as perdu !';
      color = 0xE74C3C;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('✊✋✌️ Pierre-Feuille-Ciseaux')
      .setDescription(
        `Toi : ${CHOICES[playerChoice].emoji} ${playerChoice}\n` +
        `Moi : ${CHOICES[botChoice].emoji} ${botChoice}\n\n` +
        `**${resultText}**`
      );

    return interaction.reply({ embeds: [embed] });
  },
};
