// Point d'entrée du module.
//   const bonbons = require('./bonbons-halloween');
//   bonbons.init(client, { getGuildConfig: storage.getGuildConfig });   // UNE fois, après le chargement des commandes
//   Dans tes jeux :  bonbons.api.miniJeu(userId)  /  bonbons.api.drop(userId)  /  bonbons.api.giveaway(userId, giveawayId)
const { Events } = require('discord.js');
const cfg = require('./config');
const store = require('./store');
const engine = require('./engine');
const economy = require('./economy');
const claims = require('./claims');
const commands = require('./commands');
const events = require('./events');
const runtime = require('./runtime');

function init(client, opts = {}) {
  runtime.setStorage(opts.getGuildConfig);
  economy.setClient(client);
  economy.setPromptHook(claims.promptHook);
  const ev = events.register(client);

  // Ton bot réenregistre toutes ses commandes au démarrage depuis client.commands :
  // on ajoute donc les nôtres dedans (sinon elles seraient effacées).
  const ownRegistration = !client.commands;
  if (client.commands) for (const c of commands.list) client.commands.set(c.data.name, c);

  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    const guild = client.guilds.cache.get(cfg.guildId);
    if (!guild) return console.error('[bonbons] GUILD_ID introuvable : vérifie la variable GUILD_ID');
    if (!cfg.niveauxChannelId) console.warn('[bonbons] NIVEAUX_CHANNEL_ID n’est pas renseigné : aucune annonce ne sera publiée');
    if (!runtime.ticketCategoryId()) console.warn('[bonbons] aucune catégorie de tickets trouvée (TICKET_CATEGORY_ID ou config des tickets)');
    if (!runtime.staffRoleIds().length) console.warn('[bonbons] aucun rôle staff trouvé (STAFF_ROLE_ID ou config des tickets)');
    await ev.init();
    if (ownRegistration) await commands.register(guild);
    await claims.sweep(guild);
    console.log('[bonbons] 🎃 système de bonbons prêt');
  };
  if (client.isReady()) start();
  else client.once(Events.ClientReady, start);

  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (!i.guild || i.guild.id !== cfg.guildId) return;
      // Les commandes slash sont déjà exécutées par ton gestionnaire (client.commands).
      if (ownRegistration && i.isChatInputCommand() && ['solde', 'recompenses', 'boutique', 'autographes', 'stock', 'bonbons'].includes(i.commandName)) return await commands.handle(i);
      if ((i.isButton() || i.isStringSelectMenu()) && /^(cl_|tk_)/.test(i.customId)) return await claims.handleComponent(i);
    } catch (e) {
      console.error('[bonbons] interaction', e);
      const msg = { content: 'Oups, une araignée a mangé le fil 🕷️ Réessaie, ou préviens le staff.', ephemeral: true };
      if (i.deferred || i.replied) i.followUp(msg).catch(() => {});
      else i.reply(msg).catch(() => {});
    }
  });
}

const api = {
  /** Une partie de mini-jeu terminée par ce membre. */
  miniJeu: async (userId) => economy.pushGains(userId, engine.onGame(store.user(userId), 'jeu', engine.getCtx())),
  /** Un drop attrapé par ce membre. */
  drop: async (userId) => economy.pushGains(userId, engine.onGame(store.user(userId), 'drop', engine.getCtx())),
  /** Participation à un giveaway (une seule fois par giveaway, 10 giveaways maximum). */
  giveaway: async (userId, giveawayId) => economy.pushGains(userId, engine.onGiveaway(store.user(userId), String(giveawayId), engine.getCtx())),
  ajouterBonbons: economy.ajouterBonbons,
};

module.exports = { init, api };
