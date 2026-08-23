const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Convertit une durée comme "10m", "2h", "1j" en millisecondes
function parseDuration(str) {
  const match = str.trim().match(/^(\d+)\s*(m|min|h|heure|heures|j|jour|jours|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return value * 60 * 1000;
  if (unit.startsWith('h')) return value * 60 * 60 * 1000;
  if (unit.startsWith('j') || unit.startsWith('d')) return value * 24 * 60 * 60 * 1000;
  return null;
}

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // Discord limite les timeouts à 28 jours max

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Rend un membre muet temporairement (timeout Discord)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à rendre muet')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('duree')
        .setDescription('Durée, ex : 10m, 2h, 1j (max 28 jours)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const durationStr = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison') ?? 'Non spécifiée';

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.reply({
        content: "⚠️ Format de durée invalide. Utilise par exemple : `10m`, `2h`, ou `1j`.",
        ephemeral: true,
      });
    }

    if (durationMs > MAX_TIMEOUT_MS) {
      return interaction.reply({ content: "⚠️ La durée maximum autorisée par Discord est de 28 jours.", ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      return interaction.reply({ content: "Ce membre est introuvable sur le serveur.", ephemeral: true });
    }

    if (!member.moderatable) {
      return interaction.reply({
        content: "⚠️ Je ne peux pas rendre ce membre muet (son rôle est peut-être plus haut que le mien).",
        ephemeral: true,
      });
    }

    await member.timeout(durationMs, `${reason} — par ${interaction.user.tag}`);

    const endTimestamp = Date.now() + durationMs;
    const embed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setTitle('🔇 Membre rendu muet')
      .setDescription(`${targetUser} ne peut plus écrire ni parler pendant un moment.`)
      .addFields(
        { name: 'Raison', value: reason },
        { name: 'Fin du mute', value: `<t:${Math.floor(endTimestamp / 1000)}:F>` },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
