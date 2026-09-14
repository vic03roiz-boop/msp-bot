const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-categorie')
    .setDescription('Désigne la catégorie Discord dans laquelle créer les salons de ticket')
    .addChannelOption(option =>
      option.setName('categorie')
        .setDescription('La catégorie à utiliser')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const categorie = interaction.options.getChannel('categorie');
    storage.saveGuildConfig(interaction.guild.id, { ticketCategoryId: categorie.id });
    return interaction.reply({ content: `✅ Les nouveaux tickets seront créés dans la catégorie **${categorie.name}**.`, ephemeral: true });
  },
};
