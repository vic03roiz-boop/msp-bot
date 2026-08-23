const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge-membre')
    .setDescription('Supprime les derniers messages d\'un membre précis dans ce salon')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre dont il faut supprimer les messages')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de messages à supprimer (défaut : 20, max : 100)')
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('nombre') ?? 20;

    await interaction.deferReply({ ephemeral: true });

    // On scanne les 100 derniers messages du salon et on ne garde que ceux du membre visé
    const recentMessages = await interaction.channel.messages.fetch({ limit: 100 });
    const toDelete = recentMessages.filter(m => m.author.id === targetUser.id).first(amount);

    if (toDelete.length === 0) {
      return interaction.editReply({ content: `Aucun message récent de ${targetUser} trouvé dans ce salon.` });
    }

    const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);

    if (!deleted) {
      return interaction.editReply({ content: "⚠️ Je n'ai pas pu supprimer ces messages (peut-être trop vieux, plus de 14 jours)." });
    }

    return interaction.editReply({ content: `🧹 ${deleted.size} message(s) de ${targetUser} supprimé(s).` });
  },
};
