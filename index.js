require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const storage = require('./utils/storage');
const antispam = require('./utils/antispam');
const uno = require('./utils/unoGame');
const { buildGiveawayEmbed } = require('./commands/creategw');
const { buildLobbyEmbed } = require('./commands/uno');

// --- Petit serveur web ---
// Render (et d'autres hébergeurs "gratuits") ont besoin que l'app réponde sur un port web
// pour la considérer comme active. Ce serveur ne sert à rien d'autre que ça.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Le bot MSP est en ligne ✅');
}).listen(PORT, () => {
  console.log(`🌐 Serveur web de statut lancé sur le port ${PORT}`);
});

// Filets de sécurité : si quelque chose plante ailleurs dans le code,
// on veut le voir dans les logs plutôt qu'un silence total.
process.on('uncaughtException', (err) => {
  console.error('💥 Erreur fatale (uncaughtException) :', err);
});
process.on('unhandledRejection', (err) => {
  console.error('💥 Erreur fatale (unhandledRejection) :', err);
});

console.log('🔧 Vérification des variables d\'environnement...');
console.log('DISCORD_TOKEN présent :', !!process.env.DISCORD_TOKEN);
console.log('CLIENT_ID présent :', !!process.env.CLIENT_ID);
console.log('GUILD_ID présent :', !!process.env.GUILD_ID);
console.log('BLACKLIST_ROLE_ID présent :', !!process.env.BLACKLIST_ROLE_ID);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // nécessaire pour gérer les rôles - active "Server Members Intent" dans le Developer Portal
    GatewayIntentBits.GuildMessages, // nécessaire pour l'anti-spam
  ],
});

// --- Chargement des commandes ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
try {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  console.log(`📂 ${commandFiles.length} fichier(s) de commande trouvé(s) :`, commandFiles);
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data) client.commands.set(command.data.name, command);
  }
} catch (err) {
  console.error('💥 Erreur lors du chargement des commandes (dossier "commands" introuvable ou incomplet) :', err);
}

console.log('🔄 Tentative de connexion à Discord...');

// --- Message de remerciement automatique quand un membre booste le serveur ---
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    // On détecte le passage de "ne boost pas" à "boost" (premiumSince passe de null à une date)
    const justStartedBoosting = !oldMember.premiumSince && newMember.premiumSince;
    if (!justStartedBoosting) return;

    const config = storage.getGuildConfig(newMember.guild.id);
    if (!config.boostChannelId) return; // pas configuré, on ne fait rien

    const channel = await newMember.guild.channels.fetch(config.boostChannelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(config.boostColor ?? 0xFF73FA)
      .setTitle(config.boostTitle ?? 'Merci pour le boost ! 💖')
      .setDescription((config.boostMessage ?? 'Merci {membre} pour ton boost !').replace(/\{membre\}/g, newMember.toString()));

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erreur lors de l\'envoi du message de boost :', err);
  }
});

// --- Anti-spam ---
client.on(Events.MessageCreate, async message => {
  // On ignore les messages des bots (dont le nôtre) et les messages en dehors d'un serveur
  if (message.author.bot || !message.guild) return;

  if (!antispam.isSpam(message.author.id)) return;

  const member = message.member;
  if (!member || !member.moderatable) return; // on ne touche pas aux membres qu'on ne peut pas modérer (ex: admins)

  antispam.resetHistory(message.author.id);

  try {
    // Supprime les derniers messages de ce membre dans le salon
    const recentMessages = await message.channel.messages.fetch({ limit: 20 });
    const toDelete = recentMessages.filter(m => m.author.id === message.author.id);
    await message.channel.bulkDelete(toDelete, true).catch(() => {});

    // Mute temporairement le membre
    await member.timeout(antispam.TIMEOUT_MS, 'Anti-spam automatique');

    const warning = await message.channel.send(
      `🚫 ${member} a été mis en sourdine 5 minutes pour spam (trop de messages envoyés trop vite).`
    );
    setTimeout(() => warning.delete().catch(() => {}), 8000);
  } catch (err) {
    console.error('Erreur anti-spam :', err);
  }
});

// --- Gestion des interactions (commandes + boutons) ---
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === 'gw_participate') {
      await handleGiveawayParticipation(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('gw_cancel_ask:')) {
      await handleGiveawayCancelAsk(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('gw_cancel_confirm:')) {
      await handleGiveawayCancelConfirm(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('gw_cancel_abort:')) {
      await handleGiveawayCancelAbort(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('uno_')) {
      await handleUnoButton(interaction);
      return;
    }
  } catch (err) {
    console.error(err);
    const errorPayload = { content: "❌ Une erreur est survenue.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorPayload).catch(() => {});
    } else {
      await interaction.reply(errorPayload).catch(() => {});
    }
  }
});

async function handleGiveawayParticipation(interaction) {
  const roleId = process.env.BLACKLIST_ROLE_ID;
  const member = interaction.member;

  // Vérifie si le membre est blacklisté
  if (roleId && member.roles.cache.has(roleId)) {
    const blacklist = storage.getBlacklist();
    const entry = blacklist.find(e => e.userId === member.id);
    const dateStr = entry ? `<t:${Math.floor(entry.endTimestamp / 1000)}:F>` : 'une date indéterminée';
    return interaction.reply({
      content: `🚫 Tu es actuellement blacklisté des giveaways jusqu'au ${dateStr}.`,
      ephemeral: true,
    });
  }

  const giveaways = storage.getGiveaways();
  const giveaway = giveaways.find(g => g.messageId === interaction.message.id && !g.ended);

  if (!giveaway) {
    return interaction.reply({ content: "Ce giveaway n'est plus disponible.", ephemeral: true });
  }

  const cancelRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_cancel_ask:${giveaway.messageId}`)
      .setLabel('❌ Annuler ma participation')
      .setStyle(ButtonStyle.Danger)
  );

  // Déjà participant : on lui propose juste d'annuler, sans le compter deux fois
  if (giveaway.participants.includes(member.id)) {
    return interaction.reply({
      content: "Tu participes déjà à ce giveaway ✅",
      components: [cancelRow],
      ephemeral: true,
    });
  }

  giveaway.participants.push(member.id);
  storage.saveGiveaways(giveaways);

  // Met à jour le compteur de participants dans l'embed public
  const embed = buildGiveawayEmbed({
    prize: giveaway.prize,
    endTimestamp: giveaway.endTimestamp,
    winnersCount: giveaway.winnersCount,
    participantsCount: giveaway.participants.length,
    boosterBonus: giveaway.boosterBonus,
    conditions: giveaway.conditions,
  });
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});

  return interaction.reply({
    content: "🎉 Tu participes bien au giveaway, bonne chance !",
    components: [cancelRow],
    ephemeral: true,
  });
}

// Étape 1 : le membre a cliqué sur "Annuler ma participation" → on demande confirmation
async function handleGiveawayCancelAsk(interaction) {
  const giveawayMessageId = interaction.customId.split(':')[1];

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`gw_cancel_confirm:${giveawayMessageId}`)
      .setLabel('Oui, je confirme ne plus vouloir participer')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`gw_cancel_abort:${giveawayMessageId}`)
      .setLabel('Non, annuler')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.update({
    content: '⚠️ Es-tu sûr(e) de vouloir annuler ta participation à ce giveaway ?',
    components: [confirmRow],
  });
}

// Étape 2a : le membre confirme → on retire vraiment sa participation
async function handleGiveawayCancelConfirm(interaction) {
  const giveawayMessageId = interaction.customId.split(':')[1];
  const member = interaction.member;

  const giveaways = storage.getGiveaways();
  const giveaway = giveaways.find(g => g.messageId === giveawayMessageId && !g.ended);

  if (!giveaway) {
    return interaction.update({ content: "Ce giveaway n'est plus disponible.", components: [] });
  }

  giveaway.participants = giveaway.participants.filter(id => id !== member.id);
  storage.saveGiveaways(giveaways);

  // Met à jour le compteur sur le message public du giveaway
  try {
    const channel = await interaction.client.channels.fetch(giveaway.channelId);
    const originalMessage = await channel.messages.fetch(giveaway.messageId);
    const embed = buildGiveawayEmbed({
      prize: giveaway.prize,
      endTimestamp: giveaway.endTimestamp,
      winnersCount: giveaway.winnersCount,
      participantsCount: giveaway.participants.length,
      boosterBonus: giveaway.boosterBonus,
      conditions: giveaway.conditions,
    });
    await originalMessage.edit({ embeds: [embed] });
  } catch (err) {
    console.error('Erreur lors de la mise à jour du giveaway après annulation :', err);
  }

  return interaction.update({ content: '✅ Ta participation a bien été annulée.', components: [] });
}

// Étape 2b : le membre revient sur sa décision → on ne change rien
async function handleGiveawayCancelAbort(interaction) {
  return interaction.update({ content: '👍 Pas de souci, tu participes toujours au giveaway 🎉', components: [] });
}

// --- UNO ---

function colorToStyle(color) {
  switch (color) {
    case 'rouge': return ButtonStyle.Danger;
    case 'vert': return ButtonStyle.Success;
    case 'bleu': return ButtonStyle.Primary;
    default: return ButtonStyle.Secondary; // jaune et noir n'ont pas de style dédié
  }
}

function buildUnoStateEmbed(game) {
  const top = uno.topCard(game);
  return new EmbedBuilder()
    .setColor(0xC4D6C3)
    .setTitle('🎴 UNO en cours')
    .setDescription(
      `Carte du dessus : **${uno.cardLabel(top)}**\n` +
      `Couleur actuelle : ${uno.COLOR_EMOJI[game.currentColor]} ${game.currentColor}\n\n` +
      `C'est au tour de <@${uno.currentPlayer(game)}> !`
    )
    .addFields({
      name: 'Joueurs',
      value: game.players.map(id => `<@${id}> — ${game.hands[id].length} carte(s)`).join('\n'),
    });
}

async function updatePublicUnoMessage(client, game, opts = {}) {
  try {
    const channel = await client.channels.fetch(game.channelId);
    const message = await channel.messages.fetch(game.messageId);

    if (opts.ended) {
      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('🎴 Partie terminée')
        .setDescription(`🏆 <@${opts.winnerId}> a gagné la partie de UNO !`);
      await message.edit({ embeds: [embed], components: [] });
    } else {
      const embed = buildUnoStateEmbed(game);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('uno_turn').setLabel('🎴 Voir ma main / Jouer').setStyle(ButtonStyle.Primary)
      );
      await message.edit({ embeds: [embed], components: [row] });
    }
  } catch (err) {
    console.error('Erreur lors de la mise à jour du message UNO :', err);
  }
}

function buildHandComponents(hand) {
  // On limite l'affichage à 20 cartes pour rester dans la limite de 5 lignes de boutons Discord
  const playable = hand.slice(0, 20);
  const rows = [];
  for (let i = 0; i < playable.length; i += 5) {
    const chunk = playable.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map((card, idx) =>
        new ButtonBuilder()
          .setCustomId(`uno_play:${i + idx}`)
          .setLabel(uno.cardLabel(card))
          .setStyle(colorToStyle(card.color))
      )
    );
    rows.push(row);
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('uno_draw').setLabel('🃏 Piocher').setStyle(ButtonStyle.Secondary)
  ));
  return rows;
}

async function handleUnoButton(interaction) {
  const game = uno.getGame(interaction.channel.id);
  const id = interaction.customId;

  if (id === 'uno_join') {
    if (!game) return interaction.reply({ content: 'Aucune partie en attente dans ce salon.', ephemeral: true });
    if (game.started) return interaction.reply({ content: 'La partie a déjà commencé.', ephemeral: true });
    uno.addPlayer(game, interaction.user.id);
    return interaction.update({ embeds: [buildLobbyEmbed(game)] });
  }

  if (id === 'uno_cancel') {
    if (!game) return interaction.reply({ content: 'Aucune partie en cours dans ce salon.', ephemeral: true });
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: "Seul l'hôte de la partie peut l'annuler.", ephemeral: true });
    }
    uno.deleteGame(interaction.channel.id);
    return interaction.update({ content: '❌ Partie de UNO annulée.', embeds: [], components: [] });
  }

  if (id === 'uno_start') {
    if (!game) return interaction.reply({ content: 'Aucune partie en attente dans ce salon.', ephemeral: true });
    if (interaction.user.id !== game.hostId) {
      return interaction.reply({ content: "Seul l'hôte de la partie peut la démarrer.", ephemeral: true });
    }
    if (game.players.length < 2) {
      return interaction.reply({ content: 'Il faut au moins 2 joueurs pour démarrer.', ephemeral: true });
    }
    uno.startGame(game);
    const embed = buildUnoStateEmbed(game);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('uno_turn').setLabel('🎴 Voir ma main / Jouer').setStyle(ButtonStyle.Primary)
    );
    await interaction.update({ embeds: [embed], components: [row] });
    game.messageId = interaction.message.id;
    return;
  }

  if (id === 'uno_turn') {
    if (!game || !game.started) return interaction.reply({ content: 'Aucune partie en cours dans ce salon.', ephemeral: true });
    if (uno.currentPlayer(game) !== interaction.user.id) {
      return interaction.reply({ content: "Ce n'est pas ton tour.", ephemeral: true });
    }
    const hand = game.hands[interaction.user.id];
    const embed = new EmbedBuilder()
      .setColor(0xC4D6C3)
      .setTitle('🎴 Ta main')
      .setDescription('Clique sur une carte pour la jouer, ou pioche si tu ne peux pas jouer.');
    return interaction.reply({ embeds: [embed], components: buildHandComponents(hand), ephemeral: true });
  }

  if (id.startsWith('uno_play:')) {
    if (!game || !game.started) return interaction.update({ content: 'Cette partie n\'existe plus.', embeds: [], components: [] });
    if (uno.currentPlayer(game) !== interaction.user.id) {
      return interaction.update({ content: "Ce n'est plus ton tour.", embeds: [], components: [] });
    }

    const cardIndex = parseInt(id.split(':')[1], 10);
    const result = uno.playCard(game, interaction.user.id, cardIndex);

    if (!result.success) {
      // On garde la main affichée pour réessayer
      const hand = game.hands[interaction.user.id];
      return interaction.reply({ content: `⚠️ ${result.error}`, ephemeral: true });
    }

    if (result.winnerId) {
      uno.deleteGame(interaction.channel.id);
      await interaction.update({ content: `🏆 Bravo, tu as gagné la partie de UNO !`, embeds: [], components: [] });
      await updatePublicUnoMessage(interaction.client, game, { ended: true, winnerId: result.winnerId });
      return;
    }

    if (result.needsColorChoice) {
      const colorRow = new ActionRowBuilder().addComponents(
        uno.COLORS.map(c =>
          new ButtonBuilder().setCustomId(`uno_color:${c}`).setLabel(`${uno.COLOR_EMOJI[c]} ${c}`).setStyle(ButtonStyle.Secondary)
        )
      );
      await interaction.update({ content: '🃏 Tu as joué un Joker ! Choisis la couleur :', embeds: [], components: [colorRow] });
      return;
    }

    await interaction.update({ content: '✅ Carte jouée !', embeds: [], components: [] });
    await updatePublicUnoMessage(interaction.client, game);
    return;
  }

  if (id === 'uno_draw') {
    if (!game || !game.started) return interaction.update({ content: 'Cette partie n\'existe plus.', embeds: [], components: [] });
    if (uno.currentPlayer(game) !== interaction.user.id) {
      return interaction.update({ content: "Ce n'est plus ton tour.", embeds: [], components: [] });
    }
    uno.drawCards(game, interaction.user.id, 1);
    uno.advanceTurn(game);
    await interaction.update({ content: '🃏 Tu as pioché une carte, ton tour est passé.', embeds: [], components: [] });
    await updatePublicUnoMessage(interaction.client, game);
    return;
  }

  if (id.startsWith('uno_color:')) {
    if (!game || !game.started) return interaction.update({ content: 'Cette partie n\'existe plus.', embeds: [], components: [] });
    const color = id.split(':')[1];
    uno.chooseColor(game, color);
    await interaction.update({ content: `Couleur choisie : ${uno.COLOR_EMOJI[color]} ${color}`, embeds: [], components: [] });
    await updatePublicUnoMessage(interaction.client, game);
    return;
  }
}

// Construit un "pot" de tirage pondéré (les boosters comptent deux fois si l'option est activée)
// puis tire `count` gagnants uniques parmi les personnes éligibles.
async function drawWinners({ guildId, candidateIds, count, boosterBonus }) {
  let pool = [...candidateIds];
  if (boosterBonus) {
    try {
      const guild = await client.guilds.fetch(guildId);
      for (const userId of candidateIds) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && member.premiumSince) {
          pool.push(userId); // entrée supplémentaire = 2x plus de chances
        }
      }
    } catch (err) {
      console.error('Erreur lors du calcul du bonus booster :', err);
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

// --- Tirage des gagnants ---
async function endGiveaway(giveaway) {
  const giveaways = storage.getGiveaways();
  const stored = giveaways.find(g => g.messageId === giveaway.messageId);
  if (!stored || stored.ended) return;

  stored.ended = true;

  // On exclut les membres blacklistés au moment du tirage, par sécurité
  const blacklist = storage.getBlacklist().map(e => e.userId);
  const eligible = stored.participants.filter(id => !blacklist.includes(id));

  const winners = await drawWinners({
    guildId: stored.guildId,
    candidateIds: eligible,
    count: stored.winnersCount,
    boosterBonus: stored.boosterBonus,
  });

  stored.winners = winners; // sauvegardé pour pouvoir faire un /reroll plus tard
  storage.saveGiveaways(giveaways);

  try {
    const channel = await client.channels.fetch(stored.channelId);
    const message = await channel.messages.fetch(stored.messageId);

    const embed = buildGiveawayEmbed({
      prize: stored.prize,
      winnersCount: stored.winnersCount,
      participantsCount: stored.participants.length,
      ended: true,
      winners,
      boosterBonus: stored.boosterBonus,
      conditions: stored.conditions,
    });
    await message.edit({ embeds: [embed], components: [] });

    if (winners.length) {
      await channel.send(`🎉 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} ! Tu remportes **${stored.prize}** !`);
    } else {
      await channel.send(`😢 Aucun participant valide pour le giveaway **${stored.prize}**.`);
    }
  } catch (err) {
    console.error('Erreur lors de la clôture du giveaway :', err);
  }
}

// Vérifie toutes les 30 secondes si un giveaway doit se terminer
function startGiveawayLoop() {
  setInterval(async () => {
    const giveaways = storage.getGiveaways();
    const toEnd = giveaways.filter(g => !g.ended && g.endTimestamp <= Date.now());
    for (const g of toEnd) {
      await endGiveaway(g);
    }
  }, 30 * 1000);
}

// --- Retrait automatique de la blacklist ---
async function checkBlacklist() {
  const blacklist = storage.getBlacklist();
  const now = Date.now();
  const stillActive = [];

  for (const entry of blacklist) {
    if (entry.endTimestamp > now) {
      stillActive.push(entry);
      continue;
    }

    try {
      const guild = await client.guilds.fetch(entry.guildId);
      const member = await guild.members.fetch(entry.userId).catch(() => null);
      const roleId = process.env.BLACKLIST_ROLE_ID;

      if (member && roleId && member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId, 'Fin de la période de blacklist');
      }

      const logChannelId = process.env.LOG_CHANNEL_ID;
      if (logChannelId) {
        const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
        if (logChannel) {
          await logChannel.send(`✅ <@${entry.userId}> n'est plus blacklisté des giveaways.`);
        }
      }
    } catch (err) {
      console.error('Erreur lors du retrait de blacklist :', err);
    }
  }

  storage.saveBlacklist(stillActive);
}

// Vérifie toutes les 5 minutes les blacklists à retirer
function startBlacklistLoop() {
  setInterval(checkBlacklist, 5 * 60 * 1000);
}

client.once(Events.ClientReady, async c => {
  console.log(`✅ Connecté en tant que ${c.user.tag}`);

  // Enregistre automatiquement les commandes slash (/blacklist, /creer-gw, etc.)
  // sur le serveur Discord à chaque démarrage, pour ne pas avoir à le faire manuellement.
  try {
    const commandsData = [...client.commands.values()].map(cmd => cmd.data.toJSON());
    await client.application.commands.set(commandsData, process.env.GUILD_ID);
    console.log(`📝 ${commandsData.length} commande(s) slash enregistrée(s) sur le serveur.`);
  } catch (err) {
    console.error('💥 Erreur lors de l\'enregistrement des commandes slash :', err.message);
  }

  checkBlacklist();
  startBlacklistLoop();
  startGiveawayLoop();
});

client.on('error', (err) => console.error('💥 Erreur du client Discord :', err));
client.on('shardError', (err) => console.error('💥 Erreur de connexion (shard) :', err));
client.on('warn', (msg) => console.warn('⚠️ Avertissement Discord :', msg));

// Filet de sécurité : si on n'est toujours pas connecté après 20 secondes,
// on l'affiche clairement plutôt que de rester dans le silence.
setTimeout(() => {
  if (!client.isReady()) {
    console.log('⏳ Toujours pas connecté après 20 secondes. Vérifie le token et les intents (Server Members Intent) sur le Developer Portal.');
  }
}, 20000);

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('💥 Échec de la connexion à Discord :', err.message);
});
