const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Exclut un membre du serveur (il peut revenir avec une invitation)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à exclure')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de l\'exclusion'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison') ?? 'Non spécifiée';

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "Ce membre est introuvable sur le serveur.", ephemeral: true });
    }

    if (!member.kickable) {
      return interaction.reply({
        content: "⚠️ Je ne peux pas exclure ce membre (son rôle est peut-être plus haut que le mien, ou c'est le propriétaire du serveur).",
        ephemeral: true,
      });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({ content: "Tu ne peux pas t'exclure toi-même 😅", ephemeral: true });
    }

    await member.kick(`${reason} — par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle('👢 Membre exclu')
      .setDescription(`${targetUser} a été exclu du serveur.`)
      .addFields({ name: 'Raison', value: reason });

    return interaction.reply({ embeds: [embed] });
  },
};
