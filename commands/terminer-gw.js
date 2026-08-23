const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('terminer-gw')
    .setDescription('Termine un giveaway en cours avant l\'heure prévue et tire les gagnants immédiatement')
    .addStringOption(option =>
      option.setName('id_message')
        .setDescription('L\'ID du message du giveaway (clic droit sur le message > Copier l\'identifiant)')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    const messageId = interaction.options.getString('id_message').trim();

    const giveaways = storage.getGiveaways();
    const giveaway = giveaways.find(g => g.messageId === messageId);

    if (!giveaway) {
      return interaction.reply({ content: "Aucun giveaway trouvé avec cet ID de message.", ephemeral: true });
    }
    if (giveaway.ended) {
      return interaction.reply({ content: "Ce giveaway est déjà terminé.", ephemeral: true });
    }

    // On force la date de fin à maintenant : la boucle de vérification du bot
    // (qui tourne toutes les 30 secondes) va s'en charger et tirer les gagnants normalement.
    giveaway.endTimestamp = Date.now();
    storage.saveGiveaways(giveaways);

    return interaction.reply({ content: "⏱️ Le giveaway va se terminer et tirer les gagnants dans les prochaines secondes." });
  },
};
