const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-boost')
    .setDescription('Configure le message de remerciement envoyé quand un membre booste le serveur')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où envoyer le message de remerciement')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le texte du message. Utilise {membre} pour mentionner la personne')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('titre')
        .setDescription('Titre de l\'embed (défaut : "Merci pour le boost !")'))
    .addStringOption(option =>
      option.setName('couleur')
        .setDescription('Couleur en hexadécimal, ex : #FF73FA (défaut : rose)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');
    const message = interaction.options.getString('message');
    const title = interaction.options.getString('titre') ?? 'Merci pour le boost ! 💖';
    const colorInput = interaction.options.getString('couleur');

    let color = 0xFF73FA;
    if (colorInput) {
      const parsed = parseInt(colorInput.replace('#', ''), 16);
      if (!Number.isNaN(parsed)) color = parsed;
    }

    storage.saveGuildConfig(interaction.guild.id, {
      boostChannelId: channel.id,
      boostTitle: title,
      boostMessage: message,
      boostColor: color,
    });

    const previewEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(message.replace(/\{membre\}/g, interaction.user.toString()));

    return interaction.reply({
      content: `✅ Configuration enregistrée. Voici un aperçu de ce qui sera envoyé dans ${channel} :`,
      embeds: [previewEmbed],
      ephemeral: true,
    });
  },
};
