require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('./utils/storage');
const antispam = require('./utils/antispam');
const { buildGiveawayEmbed } = require('./commands/creategw');

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

// --- Tirage des gagnants ---
async function endGiveaway(giveaway) {
  const giveaways = storage.getGiveaways();
  const stored = giveaways.find(g => g.messageId === giveaway.messageId);
  if (!stored || stored.ended) return;

  stored.ended = true;

  // On exclut les membres blacklistés au moment du tirage, par sécurité
  const blacklist = storage.getBlacklist().map(e => e.userId);
  const eligible = stored.participants.filter(id => !blacklist.includes(id));

  const shuffled = eligible.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, stored.winnersCount);

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
