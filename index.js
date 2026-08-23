require('dotenv').config();
const fs = require('fs');
const chemin = require('chemin');
const http = require('http');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const storage = require('./utils/storage');
const { buildGiveawayEmbed } = require('./commands/creategw');

// --- Petit serveur web ---
// Render (et d'autres hébergeurs "gratuits") ont besoin que l'application réponde sur un port web
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
  console.error('💥 Erreur fatale (rejet non géré) :', err);
});

console.log('🔧 Vérification des variables d\'environnement...');
console.log('DISCORD_TOKEN présent :', !!process.env.DISCORD_TOKEN);
console.log('CLIENT_ID présent :', !!process.env.CLIENT_ID);
console.log('GUILD_ID présent :', !!process.env.GUILD_ID);
console.log('BLACKLIST_ROLE_ID présent :', !!process.env.BLACKLIST_ROLE_ID);

const client = new Client({
  intentions : [
    GatewayIntentBits.Guildes,
    GatewayIntentBits.GuildMembers, // nécessaire pour gérer les rôles - actif "Server Members Intent" dans le Developer Portal
  ],
});

// --- Chargement des commandes ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
essayer {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  console.log(`📂 ${commandFiles.length} fichier(s) de commande trouvé(s) :`, commandFiles);
  pour (const fichier de commandFiles) {
    const commande = require(path.join(commandsPath, fichier));
    si (commande.data) client.commands.set(commande.data.name, commande);
  }
} attraper (erreur) {
  console.error('💥 Erreur lors du chargement des commandes (dossier "commands" introuvable ou incomplet) :', err);
}

console.log('🔄 Tentative de connexion à Discord...');

// --- Gestion des interactions (commandes + boutons) ---
client.on(Events.InteractionCreate, interaction asynchrone => {
  essayer {
    si (interaction.isChatInputCommand()) {
      const commande = client.commands.get(interaction.commandName);
      si (!commande) retourner;
      attendre la commande.execute(interaction);
      retour;
    }

    si (interaction.isButton() && interaction.customId === 'gw_participate') {
      attendre handleGiveawayParticipation(interaction);
      retour;
    }
  } attraper (erreur) {
    console.error(err);
    const errorPayload = { content: "❌ Une erreur est survenue.", ephemeral: true };
    si (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorPayload).catch(() => {});
    } autre {
      attendre interaction.reply(errorPayload).catch(() => {});
    }
  }
});

fonction asynchrone handleGiveawayParticipation(interaction) {
  const roleId = process.env.BLACKLIST_ROLE_ID;
  const membre = interaction.membre;

  // Vérifie si le membre est blacklisté
  si (roleId && member.roles.cache.has(roleId)) {
    const blacklist = storage.getBlacklist();
    const entrée = liste noire.find(e => e.userId === membre.id);
    const dateStr = entrée ? `<t:${Math.floor(entry.endTimestamp / 1000)}:F>` : 'une date indéterminée';
    retourner interaction.réponse({
      content: `🚫 Tu es actuellement blacklisté des cadeaux jusqu'au ${dateStr}.`,
      éphémère : vrai,
    });
  }

  const giveaways = storage.getGiveaways();
  const giveaway = giveaways.find(g => g.messageId === interaction.message.id && !g.ended);

  si (!cadeau) {
    return interaction.reply({ content: "Ce giveaway n'est plus disponible.", ephemeral: true });
  }

  si (giveaway.participants.includes(member.id)) {
    return interaction.reply({ content: "Tu participes déjà à ce cadeau ✅", ephemeral: true });
  }

  giveaway.participants.push(member.id);
  stockage.sauvegarderCadeaux(cadeaux);

  // Met à jour le compteur de participants dans l'embed
  const embed = buildGiveawayEmbed({
    prix : giveaway.prize,
    endTimestamp : giveaway.endTimestamp,
    nombre de gagnants : giveaway.winnersCount,
    participantsNombre : giveaway.participants.length,
  });
  await interaction.message.edit({ embeds: [embed] }).catch(() => {});

  return interaction.reply({ content: "🎉 Tu participes bien au cadeau, bonne chance !", éphémère : true });
}

// --- Tirage des gagnants ---
fonction asynchrone endGiveaway(giveaway) {
  const giveaways = storage.getGiveaways();
  const stored = giveaways.find(g => g.messageId === giveaway.messageId);
  si (!stocké || stocké.terminé) retourner;

  stocké.terminé = vrai;

  // On exclut les membres blacklistés au moment du tirage, par sécurité
  const blacklist = storage.getBlacklist().map(e => e.userId);
  const éligibles = stocké.participants.filter(id => !blacklist.includes(id));

  const shuffled = eligible.sort(() => Math.random() - 0.5);
  const gagnants = shuffled.slice(0, stored.winnersCount);

  stockage.sauvegarderCadeaux(cadeaux);

  essayer {
    const channel = await client.channels.fetch(stored.channelId);
    const message = await channel.messages.fetch(stored.messageId);

    const embed = buildGiveawayEmbed({
      prix : stocké.prix,
      gagnantsCount : stocké.winnersCount,
      participantsNombre : longueur des participants stockée,
      terminé : vrai,
      gagnants,
    });
    await message.edit({ embeds: [embed], components: [] });

    si (gagnants.longueur) {
      await channel.send(`🎉 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} ! Tu remportes **${stored.prize}** !`);
    } autre {
      wait Channel.send(`😢 Aucun participant valide pour le cadeau **${stored.prize}**.`);
    }
  } attraper (erreur) {
    console.error('Erreur lors de la clôture du cadeau :', err);
  }
}

// Vérifie toutes les 30 secondes si un cadeau doit se terminer
fonction startGiveawayLoop() {
  setInterval(async () => {
    const giveaways = storage.getGiveaways();
    const toEnd = giveaways.filter(g => !g.ended && g.endTimestamp <= Date.now());
    pour (const g de toEnd) {
      attendre finGiveaway(g);
    }
  }, 30 * 1000);
}

// --- Retrait automatique de la liste noire ---
fonction asynchrone checkBlacklist() {
  const blacklist = storage.getBlacklist();
  const maintenant = Date.maintenant();
  const stillActive = [];

  pour (const entrée de la liste noire) {
    si (entry.endTimestamp > maintenant) {
      toujoursActif.push(entrée);
      continuer;
    }

    essayer {
      const guilde = await client.guilds.fetch(entry.guildId);
      const membre = await guild.members.fetch(entry.userId).catch(() => null);
      const roleId = process.env.BLACKLIST_ROLE_ID;

      si (membre && roleId && membre.roles.cache.has(roleId)) {
        wait member.roles.remove(roleId, 'Fin de la période de blacklist');
      }

      const logChannelId = process.env.LOG_CHANNEL_ID;
      si (logChannelId) {
        const logChannel = wait client.channels.fetch(logChannelId).catch(() => null);
        si (logChannel) {
          await logChannel.send(`✅ <@${entry.userId}> n'est plus blacklisté des giveaways.`);
        }
      }
    } attraper (erreur) {
      console.error('Erreur lors du retrait de blacklist :', err);
    }
  }

  stockage.saveBlacklist(stillActive);
}

// Vérifie toutes les 5 minutes les blacklists à retirer
fonction startBlacklistLoop() {
  définirIntervalle(vérifierListeNoire, 5 * 60 * 1000);
}

client.once(Events.ClientReady, c => {
  console.log(`✅ Connecté à tant que ${c.user.tag}`);
  vérifier la liste noire();
  démarrerBlacklistLoop();
  démarrerGiveawayLoop();
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('💥 Échec de la connexion à Discord :', err.message);
});
