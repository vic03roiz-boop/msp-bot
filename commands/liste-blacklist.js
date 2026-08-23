const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('liste-blacklist')
    .setDescription('Affiche la liste des membres actuellement blacklistés des giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const blacklist = storage.getBlacklist().filter(entry => entry.guildId === interaction.guild.id);

    if (blacklist.length === 0) {
      return interaction.reply({ content: "✅ Aucun membre n'est actuellement blacklisté des giveaways.", ephemeral: true });
    }

    // Trie par date de fin la plus proche en premier
    blacklist.sort((a, b) => a.endTimestamp - b.endTimestamp);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🚫 Membres blacklistés des giveaways')
      .setDescription(
        blacklist
          .map(entry => `<@${entry.userId}> — fin <t:${Math.floor(entry.endTimestamp / 1000)}:R> (raison : ${entry.reason})`)
          .join('\n')
      )
      .setFooter({ text: `${blacklist.length} membre(s) blacklisté(s)` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
