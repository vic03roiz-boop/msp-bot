const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const storage = require('../utils/storage');
const wheelGame = require('../utils/wheelGame');

const JOIN_EMOJI = '🎉';

function buildLobbyEmbed(wheel) {
  const full = wheel.participants.length >= wheel.maxParticipants;
  return new EmbedBuilder()
    .setColor(0xC4D6C3)
    .setTitle('🎡 Roue de la fortune')
    .setDescription(
      `**Lot :** ${wheel.prize}\n\n` +
      `Réagis avec ${JOIN_EMOJI} pour participer !\n\n` +
      `**Participants (${wheel.participants.length}/${wheel.maxParticipants}) :**\n` +
      (wheel.participants.length ? wheel.participants.map(id => `<@${id}>`).join(', ') : '_Personne pour le moment_')
    )
    .setFooter({ text: full ? 'Complet ! En attente que l\'hôte lance la roue...' : 'L\'hôte peut lancer la roue à tout moment.' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue-creer')
    .setDescription('Crée une roue de la fortune : les participants réagissent, un seul gagne')
    .addStringOption(option =>
      option.setName('lot')
        .setDescription('Ce que le gagnant remportera')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('max_participants')
        .setDescription('Nombre maximum de participants acceptés')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(20))
    .addChannelOption(option =>
      option.setName('salon_tickets')
        .setDescription('Salon de tickets pour le gagnant (sinon, celui configuré avec /config-drop)')
        .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    if (wheelGame.getWheel(interaction.channel.id)) {
      return interaction.reply({ content: "Il y a déjà une roue de la fortune en cours dans ce salon.", ephemeral: true });
    }

    const prize = interaction.options.getString('lot');
    const maxParticipants = interaction.options.getInteger('max_participants');
    const overrideChannel = interaction.options.getChannel('salon_tickets');
    const config = storage.getGuildConfig(interaction.guild.id);
    const ticketsChannelId = overrideChannel?.id ?? config.ticketsChannelId ?? null;

    const wheel = wheelGame.createWheel(interaction.channel.id, {
      hostId: interaction.user.id,
      prize,
      maxParticipants,
      ticketsChannelId,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('wheel_launch').setLabel('🎡 Lancer la roue !').setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.reply({ embeds: [buildLobbyEmbed(wheel)], components: [row], fetchReply: true });
    wheel.messageId = message.id;
    await message.react(JOIN_EMOJI);

    const collector = message.createReactionCollector({
      filter: (reaction, user) => reaction.emoji.name === JOIN_EMOJI && !user.bot,
      max: maxParticipants,
    });
    wheel.collector = collector;

    collector.on('collect', async (reaction, user) => {
      if (wheel.launched) return;
      if (!wheel.participants.includes(user.id)) wheel.participants.push(user.id);
      await message.edit({ embeds: [buildLobbyEmbed(wheel)] }).catch(() => {});
    });

    collector.on('end', async () => {
      if (wheel.launched) return; // déjà lancée manuellement, rien à faire
      if (wheel.participants.length < 2) {
        wheelGame.deleteWheel(interaction.channel.id);
        await message.edit({ content: "⏱️ Pas assez de participants, la roue est annulée.", embeds: [], components: [] }).catch(() => {});
      }
      // Sinon, on laisse le bouton "Lancer" actif : l'hôte peut toujours lancer avec les participants actuels
    });
  },

  buildLobbyEmbed,
  JOIN_EMOJI,
};
