const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../utils/storage');

// Construit un pot de tirage pondéré (les boosters comptent deux fois si l'option est activée)
// puis tire `count` gagnants uniques parmi les personnes éligibles.
async function drawWinners(guild, candidateIds, count, boosterBonus) {
  let pool = [...candidateIds];
  if (boosterBonus) {
    for (const userId of candidateIds) {
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member && member.premiumSince) {
        pool.push(userId); // entrée supplémentaire = 2x plus de chances
      }
    }
  }

  const shuffled = pool.sort(() => Math.random() - 0.5);
  const winners = [];
  for (const userId of shuffled) {
    if (winners.length >= count) break;
    if (!winners.includes(userId)) winners.push(userId);
  }
  return winners;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Retire un ou plusieurs gagnants au sort pour un giveaway déjà terminé')
    .addStringOption(option =>
      option.setName('id_message')
        .setDescription('L\'ID du message du giveaway (clic droit sur le message > Copier l\'identifiant)')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de gagnants à retirer au sort (par défaut : tous les gagnants)')
        .setMinValue(1))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction) {
    const messageId = interaction.options.getString('id_message').trim();

    const giveaways = storage.getGiveaways();
    const giveaway = giveaways.find(g => g.messageId === messageId);

    if (!giveaway) {
      return interaction.reply({ content: "Aucun giveaway trouvé avec cet ID de message.", ephemeral: true });
    }
    if (!giveaway.ended) {
      return interaction.reply({ content: "Ce giveaway n'est pas encore terminé, impossible de faire un reroll.", ephemeral: true });
    }
    if (!giveaway.winners || giveaway.winners.length === 0) {
      return interaction.reply({ content: "Ce giveaway n'a eu aucun gagnant, il n'y a rien à reroll.", ephemeral: true });
    }

    const requested = interaction.options.getInteger('nombre');
    const howMany = Math.min(requested ?? giveaway.winners.length, giveaway.winners.length);

    await interaction.deferReply();

    // On choisit au hasard lesquels des gagnants actuels seront remplacés
    const shuffledCurrentWinners = [...giveaway.winners].sort(() => Math.random() - 0.5);
    const winnersToRemove = shuffledCurrentWinners.slice(0, howMany);
    const winnersToKeep = giveaway.winners.filter(id => !winnersToRemove.includes(id));

    // Le nouveau pot exclut : les blacklistés actuels, les gagnants qu'on garde, et ceux qu'on vient de retirer
    const blacklist = storage.getBlacklist().map(e => e.userId);
    const eligible = giveaway.participants.filter(
      id => !blacklist.includes(id) && !winnersToKeep.includes(id) && !winnersToRemove.includes(id)
    );

    const newWinners = await drawWinners(interaction.guild, eligible, howMany, giveaway.boosterBonus);

    if (newWinners.length < howMany) {
      // Pas assez de participants restants : on complète en repiochant parmi les anciens gagnants retirés
      const backupPool = winnersToRemove.filter(id => !newWinners.includes(id));
      newWinners.push(...backupPool.slice(0, howMany - newWinners.length));
    }

    giveaway.winners = [...winnersToKeep, ...newWinners];

    const updatedGiveaways = storage.getGiveaways();
    const toUpdate = updatedGiveaways.find(g => g.messageId === messageId);
    if (toUpdate) {
      toUpdate.winners = giveaway.winners;
      storage.saveGiveaways(updatedGiveaways);
    }

    // Met à jour le message original du giveaway avec la nouvelle liste de gagnants
    try {
      const channel = await interaction.client.channels.fetch(giveaway.channelId);
      const originalMessage = await channel.messages.fetch(giveaway.messageId);
      const { buildGiveawayEmbed } = require('./creategw');
      const embed = buildGiveawayEmbed({
        prize: giveaway.prize,
        winnersCount: giveaway.winnersCount,
        participantsCount: giveaway.participants.length,
        ended: true,
        winners: giveaway.winners,
        boosterBonus: giveaway.boosterBonus,
        conditions: giveaway.conditions,
        host: giveaway.hostName ? { name: giveaway.hostName, avatarURL: giveaway.hostAvatarURL } : null,
      });
      await originalMessage.edit({ embeds: [embed] });
    } catch (err) {
      console.error('Erreur lors de la mise à jour du message après reroll :', err);
    }

    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🔁 Reroll effectué')
      .setDescription(`**${winnersToRemove.length}** gagnant(s) retiré(s) : ${winnersToRemove.map(id => `<@${id}>`).join(', ')}`)
      .addFields({
        name: 'Nouveau(x) gagnant(s)',
        value: newWinners.length ? newWinners.map(id => `<@${id}>`).join(', ') : 'Aucun participant disponible pour remplacer',
      });

    await interaction.editReply({ embeds: [embed] });

    if (newWinners.length) {
      await interaction.channel.send(
        `🔁 Suite au reroll du giveaway **${giveaway.prize}**, félicitations à ${newWinners.map(id => `<@${id}>`).join(', ')} !`
      );
    }
  },
};
