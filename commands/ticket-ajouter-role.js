const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-ajouter-role')
    .setDescription('Donne accès au ticket en cours à tous les membres d\'un rôle (à utiliser dans le salon du ticket)')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Le rôle à ajouter au ticket')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = storage.getGuildConfig(interaction.guild.id);
    const isTicket = config.openTickets && Object.prototype.hasOwnProperty.call(config.openTickets, interaction.channel.id);

    if (!isTicket) {
      return interaction.reply({ content: "Cette commande ne peut être utilisée que dans un salon de ticket.", ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    // On ajoute une autorisation pour le rôle entier plutôt que membre par membre :
    // tous ceux qui ont ce rôle (maintenant et plus tard) auront accès au ticket automatiquement.
    await interaction.channel.permissionOverwrites.edit(role.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    return interaction.reply({ content: `✅ Tous les membres du rôle ${role} ont maintenant accès à ce ticket.` });
  },
};
