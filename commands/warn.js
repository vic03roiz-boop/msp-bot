const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Donne un avertissement à un membre (gardé dans son historique)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de l\'avertissement')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const reason = interaction.options.getString('raison');

    const warnings = storage.getWarnings();
    warnings.push({
      userId: targetUser.id,
      guildId: interaction.guild.id,
      moderatorId: interaction.user.id,
      reason,
      timestamp: Date.now(),
    });
    storage.saveWarnings(warnings);

    const count = warnings.filter(w => w.userId === targetUser.id && w.guildId === interaction.guild.id).length;

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('⚠️ Avertissement')
      .setDescription(`${targetUser} a reçu un avertissement.`)
      .addFields(
        { name: 'Raison', value: reason },
        { name: 'Total d\'avertissements', value: `${count}`, inline: true },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
