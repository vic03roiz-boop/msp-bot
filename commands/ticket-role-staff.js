const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-role-staff')
    .setDescription('Désigne les rôles qui ont accès à tous les tickets et peuvent les fermer')
    .addRoleOption(option =>
      option.setName('role1')
        .setDescription('Un rôle staff')
        .setRequired(true))
    .addRoleOption(option => option.setName('role2').setDescription('Un autre rôle staff (optionnel)'))
    .addRoleOption(option => option.setName('role3').setDescription('Un autre rôle staff (optionnel)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const roles = [1, 2, 3]
      .map(n => interaction.options.getRole(`role${n}`))
      .filter(Boolean);

    storage.saveGuildConfig(interaction.guild.id, { ticketStaffRoleIds: roles.map(r => r.id) });

    return interaction.reply({
      content: `✅ Les rôles ${roles.map(r => r.toString()).join(', ')} ont maintenant accès à tous les tickets et peuvent les fermer.`,
      ephemeral: true,
    });
  },
};
