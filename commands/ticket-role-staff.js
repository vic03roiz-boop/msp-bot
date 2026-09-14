const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-role-staff')
    .setDescription('Désigne le rôle qui a accès à tous les tickets et peut les fermer')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Le rôle staff')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    storage.saveGuildConfig(interaction.guild.id, { ticketStaffRoleId: role.id });
    return interaction.reply({ content: `✅ Le rôle ${role} a maintenant accès à tous les tickets.`, ephemeral: true });
  },
};
