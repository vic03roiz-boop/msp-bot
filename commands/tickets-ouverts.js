// /tickets-ouverts : liste les tickets en cours et repère les "fantômes"
// (ticket enregistré dans le bot mais dont le salon a été supprimé sans cliquer sur "Fermer").
// Ce sont eux qui bloquent un membre avec "Tu as déjà un ticket ouvert".
const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const storage = require('../utils/storage');

async function analyser(guild) {
  const config = storage.getGuildConfig(guild.id);
  const open = config.openTickets || {};
  const rows = [];
  for (const [chanId, t] of Object.entries(open)) {
    let channel = guild.channels.cache.get(chanId);
    if (!channel) channel = await guild.channels.fetch(chanId).catch(() => null);
    rows.push({ chanId, ownerId: t.ownerId, category: t.category || '—', openedAt: t.openedAt, ok: !!channel });
  }
  rows.sort((a, b) => (a.openedAt || 0) - (b.openedAt || 0));
  return rows;
}

function construire(rows) {
  const fantomes = rows.filter(r => !r.ok);
  const lignes = rows.map(r => {
    const date = r.openedAt ? `<t:${Math.floor(r.openedAt / 1000)}:d>` : '?';
    return r.ok
      ? `✅ <#${r.chanId}> · <@${r.ownerId}> · ${r.category} · ${date}`
      : `👻 *salon supprimé* · <@${r.ownerId}> · ${r.category} · ${date}`;
  });
  let desc = lignes.length ? lignes.join('\n') : 'Aucun ticket en cours.';
  if (desc.length > 3800) desc = desc.slice(0, 3800) + '\n…';

  const embed = new EmbedBuilder()
    .setColor(fantomes.length ? 0xE8B4B8 : 0xC4D6C3)
    .setTitle('🎫 Tickets en cours')
    .setDescription(desc)
    .setFooter({ text: fantomes.length
      ? `${fantomes.length} ticket(s) fantôme(s) : le salon n'existe plus, ça bloque le membre.`
      : 'Tout est propre.' });

  const components = [];
  if (fantomes.length) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tko_clean').setLabel(`🧹 Débloquer (${fantomes.length})`).setStyle(ButtonStyle.Danger)
    ));
  }
  return { embeds: [embed], components };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tickets-ouverts')
    .setDescription('Staff : voir les tickets en cours et débloquer ceux dont le salon a été supprimé')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'Réservé au staff.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const rows = await analyser(interaction.guild);
    const msg = await interaction.editReply(construire(rows));

    const collector = msg.createMessageComponentCollector({ time: 5 * 60 * 1000 });
    collector.on('collect', async (i) => {
      if (i.customId !== 'tko_clean' || i.user.id !== interaction.user.id) return;
      try {
        const frais = await analyser(interaction.guild);
        const config = storage.getGuildConfig(interaction.guild.id);
        const openTickets = { ...(config.openTickets || {}) };
        let n = 0;
        for (const r of frais) {
          if (!r.ok) { delete openTickets[r.chanId]; n++; }
        }
        storage.saveGuildConfig(interaction.guild.id, { openTickets });
        const apres = await analyser(interaction.guild);
        const view = construire(apres);
        view.content = `🧹 ${n} ticket(s) fantôme(s) supprimé(s) : les membres concernés peuvent de nouveau ouvrir un ticket.`;
        await i.update(view);
      } catch (err) {
        console.error('[tickets-ouverts]', err);
        await i.reply({ content: 'Une erreur est survenue.', ephemeral: true }).catch(() => {});
      }
    });
  },
};
