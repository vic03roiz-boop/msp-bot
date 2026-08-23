const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Retire manuellement un membre de la blacklist giveaways')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à retirer de la blacklist')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const roleId = process.env.BLACKLIST_ROLE_ID;

    const blacklist = storage.getBlacklist();
    const entry = blacklist.find(e => e.userId === targetUser.id);

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && roleId && member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId, 'Retrait manuel de la blacklist');
    }

    if (entry) {
      storage.saveBlacklist(blacklist.filter(e => e.userId !== targetUser.id));
    }

    return interaction.reply({ content: `✅ ${targetUser} a été retiré de la blacklist.` });
  },
};
