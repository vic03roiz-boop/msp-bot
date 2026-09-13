const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

const CHECK_EMOJI = '✅';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-reglement')
    .setDescription('Publie le règlement avec une réaction qui donne accès au serveur')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon règlement')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('texte')
        .setDescription('Le texte du règlement')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role_membre')
        .setDescription('Le rôle donné en réagissant (donne accès au reste du serveur)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const texte = interaction.options.getString('texte');
    const role = interaction.options.getRole('role_membre');

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('📜 Règlement du serveur')
      .setDescription(texte)
      .setFooter({ text: `Réagis avec ${CHECK_EMOJI} pour accepter le règlement et accéder au serveur.` });

    await interaction.deferReply({ ephemeral: true });

    const message = await channel.send({ embeds: [embed] });
    await message.react(CHECK_EMOJI);

    storage.saveGuildConfig(interaction.guild.id, {
      reglementChannelId: channel.id,
      reglementMessageId: message.id,
      reglementRoleId: role.id,
      reglementEmoji: CHECK_EMOJI,
    });

    return interaction.editReply({ content: `✅ Règlement publié dans ${channel}. Réagir avec ${CHECK_EMOJI} donnera le rôle ${role}.` });
  },
};
