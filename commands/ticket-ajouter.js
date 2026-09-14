const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-ajouter')
    .setDescription('Ajoute un membre au ticket en cours (à utiliser dans le salon du ticket)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à ajouter')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const config = storage.getGuildConfig(interaction.guild.id);
    const isTicket = config.openTickets && Object.prototype.hasOwnProperty.call(config.openTickets, interaction.channel.id);

    if (!isTicket) {
      return interaction.reply({ content: "Cette commande ne peut être utilisée que dans un salon de ticket.", ephemeral: true });
    }

    const membre = interaction.options.getUser('membre');
    await interaction.channel.permissionOverwrites.edit(membre.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    return interaction.reply({ content: `✅ ${membre} a été ajouté(e) au ticket.` });
  },
};
