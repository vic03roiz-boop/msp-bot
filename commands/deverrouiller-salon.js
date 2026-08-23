const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deverrouiller-salon')
    .setDescription('Autorise à nouveau les membres à écrire dans un salon verrouillé')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon à déverrouiller (par défaut : le salon actuel)')
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null, // retire la restriction, revient au réglage par défaut du salon
    });

    return interaction.reply({ content: `🔓 Le salon ${channel} est de nouveau déverrouillé.` });
  },
};
