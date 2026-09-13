const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-roles-bundle')
    .setDescription('Configure des rôles ajoutés automatiquement dès qu\'un membre reçoit le rôle déclencheur')
    .addRoleOption(option =>
      option.setName('role_declencheur')
        .setDescription('Le rôle qui déclenche l\'ajout automatique (ex : Membre)')
        .setRequired(true))
    .addRoleOption(option => option.setName('role1').setDescription('Rôle à ajouter automatiquement').setRequired(true))
    .addRoleOption(option => option.setName('role2').setDescription('Rôle à ajouter automatiquement'))
    .addRoleOption(option => option.setName('role3').setDescription('Rôle à ajouter automatiquement'))
    .addRoleOption(option => option.setName('role4').setDescription('Rôle à ajouter automatiquement'))
    .addRoleOption(option => option.setName('role5').setDescription('Rôle à ajouter automatiquement'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const trigger = interaction.options.getRole('role_declencheur');
    const bonusRoles = [1, 2, 3, 4, 5]
      .map(n => interaction.options.getRole(`role${n}`))
      .filter(Boolean);

    storage.saveGuildConfig(interaction.guild.id, {
      autoRoleTriggerId: trigger.id,
      autoRoleBonusIds: bonusRoles.map(r => r.id),
    });

    return interaction.reply({
      content: `✅ Dès qu'un membre reçoit le rôle ${trigger}, il recevra aussi automatiquement : ${bonusRoles.map(r => r.toString()).join(', ')}.`,
      ephemeral: true,
    });
  },
};
