const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-configurer')
    .setDescription('Publie le panneau d\'ouverture de ticket dans un salon')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où publier le panneau')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('texte')
        .setDescription('Texte du panneau (par défaut, un message standard)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const texte = interaction.options.getString('texte')
      ?? 'Besoin d\'aide, d\'un lot à récupérer, ou de signaler quelque chose ? Choisis une catégorie ci-dessous pour ouvrir un ticket privé avec le staff.';

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🎫 Support')
      .setDescription(texte);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Choisis une catégorie...')
      .addOptions(
        { label: 'Partenariat', value: 'partenariat', emoji: '🤝' },
        { label: 'Récompenses', value: 'recompenses', emoji: '🎁' },
        { label: 'Signaler un problème', value: 'probleme', emoji: '⚠️' },
        { label: 'Autre', value: 'autre', emoji: '❓' },
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: `✅ Panneau de tickets publié dans ${channel}.`, ephemeral: true });
  },
};
