const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime les X derniers messages du salon')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const amount = interaction.options.getInteger('nombre');

    await interaction.deferReply({ ephemeral: true });

    // Discord ne permet de supprimer en masse que les messages de moins de 14 jours ;
    // les plus vieux sont automatiquement ignorés par bulkDelete (filterOld = true)
    const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);

    if (!deleted) {
      return interaction.editReply({ content: "⚠️ Je n'ai pas pu supprimer ces messages (peut-être trop vieux, plus de 14 jours)." });
    }

    return interaction.editReply({ content: `🧹 ${deleted.size} message(s) supprimé(s).` });
  },
};
