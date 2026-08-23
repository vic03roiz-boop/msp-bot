const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verrouiller-salon')
    .setDescription('Empêche les membres d\'écrire dans un salon')
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon à verrouiller (par défaut : le salon actuel)')
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    });

    return interaction.reply({ content: `🔒 Le salon ${channel} est maintenant verrouillé, personne ne peut plus y écrire (sauf les modérateurs).` });
  },
};
