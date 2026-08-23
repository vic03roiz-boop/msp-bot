const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit définitivement un membre du serveur')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à bannir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison du bannissement'))
    .addIntegerOption(option =>
      option.setName('supprimer_messages')
        .setDescription('Supprimer les messages des X derniers jours (0 à 7, défaut : 0)')
        .setMinValue(0)
        .setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') ?? 'Non spécifiée';
    const deleteDays = interaction.options.getInteger('supprimer_messages') ?? 0;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ content: "Tu ne peux pas te bannir toi-même 😅", ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (member && !member.bannable) {
      return interaction.reply({
        content: "⚠️ Je ne peux pas bannir ce membre (son rôle est peut-être plus haut que le mien, ou c'est le propriétaire du serveur).",
        ephemeral: true,
      });
    }

    await interaction.guild.members.ban(targetUser, {
      reason: `${reason} — par ${interaction.user.tag}`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    const embed = new EmbedBuilder()
      .setColor(0xC0392B)
      .setTitle('🔨 Membre banni')
      .setDescription(`${targetUser} a été banni du serveur.`)
      .addFields({ name: 'Raison', value: reason });

    return interaction.reply({ embeds: [embed] });
  },
};
