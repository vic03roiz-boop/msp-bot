const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const uno = require('../utils/unoGame');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('uno-annuler')
    .setDescription('Force l\'arrêt de la partie de UNO en cours dans ce salon (modération)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const game = uno.getGame(interaction.channel.id);
    if (!game) {
      return interaction.reply({ content: "Il n'y a pas de partie de UNO en cours dans ce salon.", ephemeral: true });
    }
    uno.deleteGame(interaction.channel.id);
    return interaction.reply({ content: '❌ La partie de UNO en cours a été annulée.' });
  },
};
