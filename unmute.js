const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retire le mute (timeout) d\'un membre avant la fin prévue')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à démute')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      return interaction.reply({ content: "Ce membre est introuvable sur le serveur.", ephemeral: true });
    }

    if (!member.communicationDisabledUntil) {
      return interaction.reply({ content: "Ce membre n'est pas actuellement muet.", ephemeral: true });
    }

    await member.timeout(null, `Retrait manuel — par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🔊 Mute retiré')
      .setDescription(`${targetUser} peut à nouveau écrire et parler normalement.`);

    return interaction.reply({ embeds: [embed] });
  },
};
