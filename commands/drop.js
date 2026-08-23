const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

const DROP_EMOJI = '🎉';
const COLLECT_DURATION_MS = 24 * 60 * 60 * 1000; // la réaction reste valable 24h

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Propose un lot au premier membre qui réagit')
    .addStringOption(option =>
      option.setName('lot')
        .setDescription('Ce que tu veux faire gagner')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('salon_tickets')
        .setDescription('Salon de tickets pour ce drop (sinon, celui configuré avec /config-drop)')
        .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const prize = interaction.options.getString('lot');
    const overrideChannel = interaction.options.getChannel('salon_tickets');

    const config = storage.getGuildConfig(interaction.guild.id);
    const ticketsChannelId = overrideChannel?.id ?? config.ticketsChannelId;

    if (!ticketsChannelId) {
      return interaction.reply({
        content: "⚠️ Aucun salon de tickets n'est configuré. Utilise `/config-drop` pour en définir un une bonne fois pour toutes, ou précise l'option `salon_tickets` ici.",
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🎁 DROP !')
      .setDescription(`**${prize}**\n\nOffert par ${interaction.user}`)
      .setFooter({ text: `Réagis avec ${DROP_EMOJI} pour tenter de le remporter — le/la plus rapide gagne !` });

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react(DROP_EMOJI);

    const collector = message.createReactionCollector({
      filter: (reaction, user) => reaction.emoji.name === DROP_EMOJI && !user.bot,
      max: 1,
      time: COLLECT_DURATION_MS,
    });

    collector.on('collect', async (reaction, user) => {
      const wonEmbed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🎁 Drop remporté !')
        .setDescription(`**${prize}**\n\n🏆 Gagné par ${user}`);
      await message.edit({ embeds: [wonEmbed] }).catch(() => {});

      await interaction.channel.send(
        `🎉 Félicitations ${user} ! Tu remportes **${prize}** !\n` +
        `Rends-toi dans <#${ticketsChannelId}> et ouvre un ticket pour récupérer ton lot.`
      );
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const expiredEmbed = new EmbedBuilder()
          .setColor(0x95A5A6)
          .setTitle('🎁 Drop expiré')
          .setDescription(`**${prize}**\n\nPersonne n'a réagi à temps, ce drop n'a pas trouvé preneur.`);
        await message.edit({ embeds: [expiredEmbed] }).catch(() => {});
      }
    });
  },
};
