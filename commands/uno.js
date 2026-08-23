const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const uno = require('../utils/unoGame');

function buildLobbyEmbed(game) {
  return new EmbedBuilder()
    .setColor(0xC4D6C3)
    .setTitle('🎴 Partie de UNO')
    .setDescription(`Rejoins la partie avant que l'hôte ne la lance !\n\n**Joueurs (${game.players.length}) :**\n${game.players.map(id => `<@${id}>`).join('\n')}`)
    .setFooter({ text: '2 joueurs minimum pour démarrer' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uno-creer')
    .setDescription('Lance une partie de UNO dans ce salon'),

  async execute(interaction) {
    const existing = uno.getGame(interaction.channel.id);
    if (existing) {
      return interaction.reply({ content: "Il y a déjà une partie de UNO en cours (ou en attente) dans ce salon.", ephemeral: true });
    }

    const game = uno.createGame(interaction.channel.id, interaction.user.id);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('uno_join').setLabel('🙋 Rejoindre').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('uno_start').setLabel('▶️ Démarrer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('uno_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Danger),
    );

    return interaction.reply({ embeds: [buildLobbyEmbed(game)], components: [row] });
  },

  buildLobbyEmbed,
};
