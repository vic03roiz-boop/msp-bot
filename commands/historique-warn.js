const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('historique-warn')
    .setDescription('Affiche l\'historique des avertissements d\'un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre concerné')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const warnings = storage.getWarnings().filter(
      w => w.userId === targetUser.id && w.guildId === interaction.guild.id
    );

    if (warnings.length === 0) {
      return interaction.reply({ content: `${targetUser} n'a aucun avertissement.`, ephemeral: true });
    }

    warnings.sort((a, b) => b.timestamp - a.timestamp); // du plus récent au plus ancien

    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle(`⚠️ Historique des avertissements — ${targetUser.tag}`)
      .setDescription(
        warnings
          .map((w, i) => `**${i + 1}.** <t:${Math.floor(w.timestamp / 1000)}:d> — ${w.reason} (par <@${w.moderatorId}>)`)
          .join('\n')
      )
      .setFooter({ text: `${warnings.length} avertissement(s) au total` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
