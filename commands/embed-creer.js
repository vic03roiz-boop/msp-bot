const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed-creer')
    .setDescription('Fait poster un embed personnalisé par le bot')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où poster l\'embed (par défaut : le salon actuel)')
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(option => option.setName('titre').setDescription('Titre de l\'embed'))
    .addStringOption(option => option.setName('description').setDescription('Texte principal de l\'embed'))
    .addStringOption(option => option.setName('couleur').setDescription('Couleur en hexadécimal, ex : #C4D6C3 (défaut : vert pastel du serveur)'))
    .addStringOption(option => option.setName('image').setDescription('URL d\'une grande image affichée en bas de l\'embed'))
    .addStringOption(option => option.setName('miniature').setDescription('URL d\'une petite image affichée en haut à droite'))
    .addStringOption(option => option.setName('auteur').setDescription('Texte affiché tout en haut, au-dessus du titre'))
    .addStringOption(option => option.setName('footer').setDescription('Petit texte affiché tout en bas de l\'embed'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const titre = interaction.options.getString('titre');
    const description = interaction.options.getString('description');
    const couleurInput = interaction.options.getString('couleur');
    const image = interaction.options.getString('image');
    const miniature = interaction.options.getString('miniature');
    const auteur = interaction.options.getString('auteur');
    const footer = interaction.options.getString('footer');

    if (!titre && !description) {
      return interaction.reply({ content: "⚠️ Renseigne au moins un titre ou une description.", ephemeral: true });
    }

    let couleur = 0xC4D6C3;
    if (couleurInput) {
      const parsed = parseInt(couleurInput.replace('#', ''), 16);
      if (!Number.isNaN(parsed)) couleur = parsed;
    }

    const embed = new EmbedBuilder().setColor(couleur);
    if (titre) embed.setTitle(titre);
    if (description) embed.setDescription(description);
    if (auteur) embed.setAuthor({ name: auteur });
    if (footer) embed.setFooter({ text: footer });

    try {
      if (image) embed.setImage(image);
      if (miniature) embed.setThumbnail(miniature);
    } catch {
      return interaction.reply({ content: "⚠️ L'URL d'image fournie n'est pas valide.", ephemeral: true });
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ content: `⚠️ Je n'ai pas la permission d'envoyer de message dans ${channel}.`, ephemeral: true });
    }

    await channel.send({ embeds: [embed] });

    return interaction.reply({ content: `✅ Embed envoyé dans ${channel}.`, ephemeral: true });
  },
};
