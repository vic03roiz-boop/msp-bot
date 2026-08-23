const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const hangman = require('../utils/hangmanGame');
const { buildStateEmbed } = require('./pendu-creer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pendu-deviner')
    .setDescription('Propose une lettre pour la partie de Pendu en cours')
    .addStringOption(option =>
      option.setName('lettre')
        .setDescription('Une seule lettre')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1)),

  async execute(interaction) {
    const game = hangman.getGame(interaction.channel.id);
    if (!game || game.finished) {
      return interaction.reply({ content: "Il n'y a pas de partie de Pendu en cours. Lance-en une avec `/pendu-creer` !", ephemeral: true });
    }

    const letterInput = interaction.options.getString('lettre');
    if (!/^[a-zA-Z]$/.test(letterInput)) {
      return interaction.reply({ content: "⚠️ Merci de proposer une seule lettre (A à Z).", ephemeral: true });
    }

    const result = hangman.guessLetter(game, letterInput);

    if (result.alreadyGuessed) {
      return interaction.reply({ content: `La lettre **${letterInput.toUpperCase()}** a déjà été proposée.`, ephemeral: true });
    }

    if (result.won) {
      hangman.deleteGame(interaction.channel.id);
      const embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎉 Gagné !')
        .setDescription(`${interaction.user} a trouvé le mot : **${game.word}** !`);
      return interaction.reply({ embeds: [embed] });
    }

    if (result.lost) {
      hangman.deleteGame(interaction.channel.id);
      const embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('💀 Perdu !')
        .setDescription(`${hangman.hangmanDrawing(game)}\nLe mot était : **${game.word}**`);
      return interaction.reply({ embeds: [embed] });
    }

    const embed = buildStateEmbed(game);
    if (!result.correct) {
      return interaction.reply({ content: `❌ Il n'y a pas de **${letterInput.toUpperCase()}**.`, embeds: [embed] });
    }
    return interaction.reply({ content: `✅ Bien joué !`, embeds: [embed] });
  },
};
