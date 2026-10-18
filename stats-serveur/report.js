// Construit le rapport (embed + images) à partir des données. Sans dépendre d'un client Discord réel.
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const data = require('./data');
const charts = require('./charts');

const PERIODS = { 7: '7 derniers jours', 30: '30 derniers jours', 90: '90 derniers jours' };

async function build(guild, n = 7) {
  const s = data.summary(n);
  const nameOf = async (id) => {
    const m = guild.members.cache.get(id) || (await guild.members.fetch(id).catch(() => null));
    return m ? m.displayName : 'ancien membre';
  };
  const users = await Promise.all(s.topUsers.map(async (u) => ({ name: await nameOf(u.id), value: u.value })));
  const voice = await Promise.all(s.topVoice.map(async (u) => ({ name: await nameOf(u.id), value: Math.round((u.value / 60) * 10) / 10 })));
  const label = `${PERIODS[n] || `${n} derniers jours`} · heure de Paris`;
  const files = [
    new AttachmentBuilder(charts.growthChart(s.growth, label), { name: 'croissance.png' }),
    new AttachmentBuilder(charts.rankChart('Membres les plus actifs', `Messages envoyés · ${label}`, users, 'msg'), { name: 'messages.png' }),
    new AttachmentBuilder(charts.rankChart('Les plus présents en vocal', `Heures en vocal · ${label}`, voice, 'h', '#b36bff'), { name: 'vocal.png' }),
    new AttachmentBuilder(charts.hoursChart(s.hours, label), { name: 'heures.png' }),
  ];
  const net = s.joins - s.leaves;
  const chans = s.topChannels.map((c) => `<#${c.id}> · ${charts.nf(c.value)}`).join('\n') || '—';
  const embed = new EmbedBuilder().setColor(0xff8a2b).setTitle(`📊 Statistiques · ${PERIODS[n] || `${n} jours`}`)
    .addFields(
      { name: 'Membres', value: s.lastMembers !== null ? `**${charts.nf(s.lastMembers)}** (${net >= 0 ? '+' : ''}${net} · ${s.joins} arrivées, ${s.leaves} départs)` : 'en cours de collecte', inline: true },
      { name: 'Messages', value: `**${charts.nf(s.msgs)}**\n≈ ${charts.nf(s.msgs / Math.max(1, s.daysWithData))} / jour`, inline: true },
      { name: 'Salons les plus actifs', value: chans },
    )
    .setFooter({ text: s.daysWithData < n ? `Les statistiques se construisent depuis l’installation du bot (${s.daysWithData} jour(s) de données).` : 'Données collectées par le bot' })
    .setTimestamp();
  return { embeds: [embed], files };
}

module.exports = { build, PERIODS };
