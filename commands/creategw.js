const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../utils/storage');

// Convertit une durée comme "30m", "2h", "3d" en millisecondes
function parseDuration(str) {
  const match = str.trim().match(/^(\d+)\s*(m|min|h|heure|heures|j|jour|jours|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return value * 60 * 1000;
  if (unit.startsWith('h')) return value * 60 * 60 * 1000;
  if (unit.startsWith('j') || unit.startsWith('d')) return value * 24 * 60 * 60 * 1000;
  return null;
}

function buildGiveawayEmbed({ prize, endTimestamp, winnersCount, participantsCount, ended = false, winners = [], boosterBonus = false, conditions = null }) {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x95A5A6 : 0x2ECC71)
    .setTitle(ended ? '🎉 Giveaway terminé !' : '🎉 GIVEAWAY 🎉')
    .setDescription(`**Prix :** ${prize}`)
    .addFields(
      { name: 'Nombre de gagnants', value: `${winnersCount}`, inline: true },
      { name: 'Participants', value: `${participantsCount}`, inline: true },
    );

  if (boosterBonus) {
    embed.addFields({ name: '🚀 Avantage Booster', value: 'Les boosters du serveur ont 2x plus de chances de gagner !' });
  }

  if (conditions) {
    embed.addFields({ name: '📋 Conditions', value: conditions });
  }

  if (ended) {
    embed.addFields({
      name: 'Gagnant(s)',
      value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Aucun participant valide 😢',
    });
  } else {
    embed.addFields({ name: 'Fin', value: `<t:${Math.floor(endTimestamp / 1000)}:R>` });
    embed.setFooter({ text: 'Clique sur le bouton ci-dessous pour participer !' });
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creer-gw')
    .setDescription('Crée un giveaway avec un bouton de participation')
    .addStringOption(option =>
      option.setName('prix')
        .setDescription('Le lot à gagner')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duree')
        .setDescription('Durée du giveaway, ex : 30m, 2h, 3j')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('gagnants')
        .setDescription('Nombre de gagnants (défaut : 1)')
        .setMinValue(1)
        .setMaxValue(20))
    .addBooleanOption(option =>
      option.setName('avantage_booster')
        .setDescription('Les boosters du serveur ont-ils 2x plus de chances de gagner ? (défaut : non)'))
    .addStringOption(option =>
      option.setName('conditions')
        .setDescription('Conditions ou règles du giveaway, affichées dans le message'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    const prize = interaction.options.getString('prix');
    const durationStr = interaction.options.getString('duree');
    const winnersCount = interaction.options.getInteger('gagnants') ?? 1;
    const boosterBonus = interaction.options.getBoolean('avantage_booster') ?? false;
    const conditions = interaction.options.getString('conditions');

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        content: "⚠️ Format de durée invalide. Utilise par exemple : `30m`, `2h`, ou `3j`.",
        ephemeral: true,
      });
    }

    const endTimestamp = Date.now() + durationMs;

    const embed = buildGiveawayEmbed({ prize, endTimestamp, winnersCount, participantsCount: 0, boosterBonus, conditions });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gw_participate')
        .setLabel('🎉 Participer')
        .setStyle(ButtonStyle.Success)
    );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const giveaways = storage.getGiveaways();
    giveaways.push({
      messageId: message.id,
      channelId: interaction.channel.id,
      guildId: interaction.guild.id,
      prize,
      winnersCount,
      endTimestamp,
      participants: [],
      ended: false,
      boosterBonus,
      conditions,
    });
    storage.saveGiveaways(giveaways);
  },

  // Exportés pour être réutilisés par index.js (bouton + tirage automatique)
  buildGiveawayEmbed,
};
