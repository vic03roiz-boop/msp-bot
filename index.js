require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const storage = require('./utils/storage');
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

  if (giveaway.participants.includes(member.id)) {
    return interaction.reply({ content: "Tu participes déjà à ce giveaway ✅", ephemeral: true });
  }

  giveaway.participants.push(member.id);
  storage.saveGiveaways(giveaways);

  // Met à jour le compteur de participants dans l'embed
  const embed = buildGiveawayEmbed({
    prize: giveaway.prize,
    endTimestamp: giveaway.endTimestamp,
    winnersCount: giveaway.winnersCount,
    participantsCount: giveaway.participants.length,
  });
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});

  return interaction.reply({ content: "🎉 Tu participes bien au giveaway, bonne chance !", ephemeral: true });
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

client.once(Events.ClientReady, c => {
  console.log(`✅ Connecté en tant que ${c.user.tag}`);
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
