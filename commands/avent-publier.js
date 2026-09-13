const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../utils/storage');

// Décembre est toujours en heure d'hiver en France (UTC+1), pas besoin de gérer le changement d'heure d'été.
function isDayUnlocked(day, year) {
  const target = new Date(`${year}-12-${String(day).padStart(2, '0')}T00:00:00+01:00`);
  return Date.now() >= target.getTime();
}

function buildAdventComponents(year) {
  const rows = [];
  for (let row = 0; row < 5; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < 5; col++) {
      const day = row * 5 + col + 1;
      if (day > 24) break;
      const unlocked = isDayUnlocked(day, year);
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`avent_open:${day}`)
          .setLabel(`${day}`)
          .setEmoji(unlocked ? '🎁' : '🔒')
          .setStyle(unlocked ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(!unlocked)
      );
    }
    if (actionRow.components.length > 0) rows.push(actionRow);
  }
  return rows;
}

function buildAdventEmbed() {
  return new EmbedBuilder()
    .setColor(0xC4D6C3)
    .setTitle('🎄 Calendrier de l\'Avent')
    .setDescription('Reviens chaque jour de décembre pour découvrir une nouvelle surprise ! Les cases se débloquent automatiquement à leur date.');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avent-publier')
    .setDescription('Publie le calendrier de l\'Avent interactif dans un salon')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où publier le calendrier')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('heure_tirage')
        .setDescription('Heure du tirage au sort quotidien en UTC (défaut : 19, soit 20h en France en décembre)')
        .setMinValue(0)
        .setMaxValue(23))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const drawHour = interaction.options.getInteger('heure_tirage') ?? 19;
    const year = new Date().getFullYear();

    const message = await channel.send({ embeds: [buildAdventEmbed()], components: buildAdventComponents(year) });

    storage.saveGuildConfig(interaction.guild.id, {
      adventChannelId: channel.id,
      adventMessageId: message.id,
      adventYear: year,
      adventDrawHourUTC: drawHour,
    });

    return interaction.reply({ content: `✅ Calendrier de l'Avent publié dans ${channel} ! Tirage au sort quotidien à ${drawHour}h UTC.`, ephemeral: true });
  },

  buildAdventComponents,
  buildAdventEmbed,
  isDayUnlocked,
};
