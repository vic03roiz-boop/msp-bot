const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Met un membre sur liste noire des giveaways pendant une durée donnée')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à blacklister')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('jours')
        .setDescription('Durée de la blacklist en jours (défaut : 7)')
        .setMinValue(1)
        .setMaxValue(90))
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison de la blacklist'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const days = interaction.options.getInteger('jours') ?? 7;
    const reason = interaction.options.getString('raison') ?? 'Non spécifiée';
    const roleId = process.env.BLACKLIST_ROLE_ID;

    if (!roleId) {
      return interaction.reply({ content: "⚠️ Aucun rôle blacklist n'est configuré (BLACKLIST_ROLE_ID manquant dans le .env).", ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "Ce membre est introuvable sur le serveur.", ephemeral: true });
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({ content: "⚠️ Le rôle blacklist configuré n'existe pas sur ce serveur.", ephemeral: true });
    }

    // Vérifie que le bot peut bien attribuer ce rôle (hiérarchie de rôles)
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: "⚠️ Le rôle du bot doit être placé au-dessus du rôle blacklist dans la hiérarchie des rôles pour pouvoir l'attribuer.", ephemeral: true });
    }

    await member.roles.add(role, `Blacklist GW - ${reason}`);

    const endTimestamp = Date.now() + days * 24 * 60 * 60 * 1000;

    const blacklist = storage.getBlacklist();
    // On retire une éventuelle ancienne entrée pour ce membre puis on ajoute la nouvelle
    const filtered = blacklist.filter(entry => entry.userId !== member.id);
    filtered.push({
      userId: member.id,
      guildId: interaction.guild.id,
      reason,
      endTimestamp,
    });
    storage.saveBlacklist(filtered);

    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🚫 Membre blacklisté')
      .setDescription(`${member} a été blacklisté des giveaways.`)
      .addFields(
        { name: 'Raison', value: reason },
        { name: 'Durée', value: `${days} jour(s)` },
        { name: 'Fin de la blacklist', value: `<t:${Math.floor(endTimestamp / 1000)}:F>` },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
