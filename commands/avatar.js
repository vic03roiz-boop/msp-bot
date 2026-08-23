const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche la photo de profil en grand d\'un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre concerné (par défaut : toi)')),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre') ?? interaction.user;
    const avatarUrl = targetUser.displayAvatarURL({ size: 1024, extension: 'png', forceStatic: false });

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle(`Avatar de ${targetUser.username}`)
      .setImage(avatarUrl);

    return interaction.reply({ embeds: [embed] });
  },
};
