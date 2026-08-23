const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dire')
    .setDescription('Le bot envoie le message à ta place')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Le message que le bot doit envoyer')
        .setRequired(true))
    .addChannelOption(option =>
      option.setName('salon')
        .setDescription('Le salon où envoyer le message (par défaut : le salon actuel)')
        .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({ content: `⚠️ Je n'ai pas la permission d'envoyer de message dans ${channel}.`, ephemeral: true });
    }

    await channel.send(message);

    return interaction.reply({ content: `✅ Message envoyé dans ${channel}.`, ephemeral: true });
  },
};
