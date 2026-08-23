const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const hangman = require('../utils/hangmanGame');

function buildStateEmbed(game) {
  return new EmbedBuilder()
    .setColor(0xC4D6C3)
    .setTitle('🎪 Le Pendu')
    .setDescription(
      `${hangman.hangmanDrawing(game)}\n` +
      `**Mot :** \`${hangman.maskedWord(game)}\`\n` +
      `**Erreurs :** ${game.wrongCount}/${hangman.MAX_WRONG}\n` +
      `**Lettres essayées :** ${[...game.guessedLetters].join(', ') || 'aucune'}`
    )
    .setFooter({ text: 'Utilise /pendu-deviner lettre:X pour proposer une lettre' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pendu-creer')
    .setDescription('Démarre une partie de Pendu dans ce salon'),

  async execute(interaction) {
    const existing = hangman.getGame(interaction.channel.id);
    if (existing && !existing.finished) {
      return interaction.reply({ content: "Il y a déjà une partie de Pendu en cours dans ce salon.", ephemeral: true });
    }

    const game = hangman.createGame(interaction.channel.id);
    return interaction.reply({ embeds: [buildStateEmbed(game)] });
  },

  buildStateEmbed,
};
