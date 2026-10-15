// Commandes slash : /solde /recompenses /boutique /autographes /stock /bonbons (staff)
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const cfg = require('./config');
const theme = require('./theme');
const catalog = require('./catalog');
const store = require('./store');
const engine = require('./engine');
const economy = require('./economy');
const claims = require('./claims');

const E = claims.EPHEMERAL;
const ok = theme.fmt;
const staffOnly = PermissionFlagsBits.ManageGuild; // par défaut ; le code revérifie aussi le rôle staff

const DEFS = [
  new SlashCommandBuilder().setName('solde').setDescription('Voir ton sac à bonbons, tes missions du jour et ton historique'),
  new SlashCommandBuilder().setName('recompenses').setDescription('Voir et réclamer les paliers de bonbons et la boutique en citrouilles'),
  new SlashCommandBuilder().setName('boutique').setDescription('La Boutique des Citrouilles'),
  new SlashCommandBuilder().setName('autographes').setDescription('Échanger tes bonbons restants contre des autographes (5 bonbons = 1)')
    .addIntegerOption((o) => o.setName('quantite').setDescription('Nombre d’autographes (max 100 au total)').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder().setName('stock').setDescription('(Staff) Voir ou régler le stock des récompenses limitées')
    .setDefaultMemberPermissions(staffOnly)
    .addStringOption((o) => o.setName('recompense').setDescription('Récompense à stock limité').addChoices(...catalog.STOCK_KEYS.map((s) => ({ name: s.label.slice(0, 100), value: s.key }))))
    .addIntegerOption((o) => o.setName('quantite').setDescription('Nouveau stock (0 = épuisé)').setMinValue(0)),
  new SlashCommandBuilder().setName('bonbons').setDescription('(Staff) Gérer les bonbons')
    .setDefaultMemberPermissions(staffOnly)
    .addSubcommand((s) => s.setName('ajouter').setDescription('Ajouter des bonbons')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant').setMinValue(1).setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison (écrite dans le journal)').setRequired(true)))
    .addSubcommand((s) => s.setName('retirer').setDescription('Retirer des bonbons')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption((o) => o.setName('montant').setDescription('Montant').setMinValue(1).setRequired(true))
      .addStringOption((o) => o.setName('raison').setDescription('Raison (écrite dans le journal)').setRequired(true)))
    .addSubcommand((s) => s.setName('voir').setDescription('Voir le solde d’un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true)))
    .addSubcommand((s) => s.setName('jeu').setDescription('Valider un mini-jeu ou un drop pour un membre')
      .addUserOption((o) => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption((o) => o.setName('type').setDescription('Type').addChoices({ name: 'Mini-jeu', value: 'jeu' }, { name: 'Drop', value: 'drop' }).setRequired(true)))
    .addSubcommand((s) => s.setName('reinit').setDescription('REMET TOUT À ZÉRO (fin des tests, avant l’annonce)')
      .addStringOption((o) => o.setName('confirmation').setDescription('Écris REINITIALISER pour confirmer').setRequired(true))),
];

async function register(guild) {
  // Utilisé seulement si ton bot n'a pas de client.commands (create = n'efface pas tes autres commandes).
  for (const def of DEFS) await guild.commands.create(def.toJSON()).catch((e) => console.error('[bonbons] commande', def.name, e.message));
}

const bar = (v, max, size = 10) => '▰'.repeat(Math.min(size, Math.round((v / max) * size))) + '▱'.repeat(Math.max(0, size - Math.round((v / max) * size)));

function soldeEmbed(userId, name) {
  const u = store.user(userId);
  const ctx = engine.getCtx();
  const cit = economy.cit(u.balance);
  const e = new EmbedBuilder().setColor(theme.color).setTitle(`${theme.citrouille} ${theme.soldeTitle}${name ? ` · ${name}` : ''}`)
    .setDescription(`${theme.bonbon} **${ok(u.balance)} bonbons** = **${cit} citrouille${cit > 1 ? 's' : ''}**\nBonbons dépensés : ${ok(u.spent)} · gagnés : ${ok(u.earned)}`)
    .setFooter({ text: theme.footer });
  if (ctx && u.today && u.today.key === ctx.dayKey) {
    const done = cfg.daily.map((m) => `${u.today.done.includes(m.id) ? '✅' : '▫️'} ${m.label} (+${m.amount})`).join('\n');
    e.addFields({ name: `Missions du jour · ${u.today.earnedJour || 0}/${cfg.dailyCap}`, value: `${done}\n${bar(u.today.done.length, cfg.dailyValidateAt)} ${u.today.done.length}/${cfg.dailyValidateAt} pour valider le jour` });
  } else if (ctx) {
    e.addFields({ name: 'Missions du jour', value: 'Écris un message pour commencer ta journée 🎃' });
  } else {
    e.addFields({ name: 'Événement', value: 'Pas d’événement en cours.' });
  }
  e.addFields({ name: 'Séries', value: `Série en cours : **${u.streak}** jour(s) · jours validés au total : **${u.validatedDays}**`, inline: false });
  if (u.hist.length) {
    e.addFields({ name: 'Derniers gains', value: u.hist.slice(-6).reverse().map((h) => `${h.n > 0 ? '+' : ''}${h.n} · ${h.raison}`).join('\n') });
  }
  const next = catalog.PALIERS.find((p) => !u.claimedPaliers.includes(p.n) && p.cost > u.balance);
  if (next) e.addFields({ name: 'Prochain palier', value: `Palier ${next.n} : **${next.reward}** (${ok(next.cost)} bonbons, encore ${ok(next.cost - u.balance)})` });
  return e;
}

async function handle(i) {
  const name = i.commandName;

  if (name === 'solde') return i.reply({ embeds: [soldeEmbed(i.user.id, i.member?.displayName)], flags: E });

  if (name === 'recompenses') {
    const u = store.user(i.user.id);
    const lines = catalog.PALIERS.map((p) => {
      const mark = u.claimedPaliers.includes(p.n) ? '✅' : p.cost <= u.balance ? '🎃' : '🔒';
      const stock = p.stockKey && claims.stockLeft(p.stockKey) <= 0 ? ' · **épuisé**' : '';
      return `${mark} **${p.n}.** ${ok(p.cost)} ${theme.bonbon} · ${p.reward}${p.note ? ` _(${p.note})_` : ''}${stock}`;
    });
    const e1 = new EmbedBuilder().setColor(theme.color).setTitle(`${theme.bonbon} Les paliers de bonbons`)
      .setDescription(`${lines.join('\n')}\n\n✅ déjà réclamé · 🎃 disponible · 🔒 pas encore\nRéclamer un palier retire son coût de ton solde, et chaque palier ne se réclame qu’une fois.`);
    const shop = catalog.SHOP.map((s) => `${s.cit * catalog.CIT <= u.balance ? '🎃' : '🔒'} **${s.name}** · ${s.cit} ${theme.citrouille} (${ok(s.cit * catalog.CIT)} ${theme.bonbon})`);
    const e2 = new EmbedBuilder().setColor(theme.color).setTitle(`${theme.citrouille} La boutique en citrouilles`)
      .setDescription(`1 citrouille = ${catalog.CIT} bonbons, converties au moment de l’achat.\n\n${shop.join('\n')}\n\nTon solde : **${ok(u.balance)}** ${theme.bonbon} (${economy.cit(u.balance)} ${theme.citrouille}).`)
      .setFooter({ text: theme.footer });
    const rows = [claims.paliersMenu(u, i.user.id), claims.shopMenu(u, i.user.id)].filter(Boolean);
    return i.reply({ embeds: [e1, e2], components: rows, flags: E });
  }

  if (name === 'boutique') {
    const u = store.user(i.user.id);
    const lines = catalog.SHOP.map((s) => `${s.cit * catalog.CIT <= u.balance ? '🎃' : '🔒'} **${s.name}** · ${s.cit} ${theme.citrouille} (${ok(s.cit * catalog.CIT)} ${theme.bonbon})`);
    const e = new EmbedBuilder().setColor(theme.color).setTitle(`${theme.citrouille} ${theme.shopTitle}`)
      .setDescription(`1 citrouille = ${catalog.CIT} bonbons, converties au moment de l’achat.\n\n${lines.join('\n')}\n\nTon solde : **${ok(u.balance)}** ${theme.bonbon} (${economy.cit(u.balance)} ${theme.citrouille}).`)
      .setFooter({ text: theme.footer });
    const menu = claims.shopMenu(u, i.user.id);
    return i.reply({ embeds: [e], components: menu ? [menu] : [], flags: E });
  }

  if (name === 'autographes') {
    const qty = i.options.getInteger('quantite');
    const c = claims.check(i.user.id, `a:${qty}`);
    if (c.error) return i.reply({ content: c.error, flags: E });
    return i.reply({ ...claims.confirmView(i.user.id, c.item, c.u), flags: E });
  }

  // ---- Staff ----
  if (!claims.isStaff(i.member)) return i.reply({ content: 'Commande réservée au staff 🕸️', flags: E });

  if (name === 'stock') {
    const key = i.options.getString('recompense');
    const q = i.options.getInteger('quantite');
    if (key && q !== null) {
      store.db.stock[key] = q;
      store.save();
    }
    const lines = catalog.STOCK_KEYS.map((s) => `${s.label} : ${store.db.stock[s.key] === undefined ? 'illimité (non réglé)' : store.db.stock[s.key]}`);
    return i.reply({ content: `**Stock des récompenses limitées**\n${lines.join('\n')}`, flags: E });
  }

  if (name === 'bonbons') {
    const sub = i.options.getSubcommand();
    if (sub === 'reinit') {
      if (i.options.getString('confirmation') !== 'REINITIALISER') return i.reply({ content: 'Confirmation incorrecte : écris exactement REINITIALISER.', flags: E });
      store.backupIfNeeded();
      store.reset();
      return i.reply({ content: 'Tout est remis à zéro (une sauvegarde du jour existe). Prêt pour le lancement 🎃', flags: E });
    }
    const target = i.options.getUser('membre');
    if (sub === 'voir') return i.reply({ embeds: [soldeEmbed(target.id, target.username)], flags: E });
    if (sub === 'jeu') {
      const gains = engine.onGame(store.user(target.id), i.options.getString('type'), engine.getCtx());
      await economy.pushGains(target.id, gains);
      return i.reply({ content: gains.length ? 'Validé 🎃' : 'Enregistré (aucun gain nouveau).', flags: E });
    }
    const montant = i.options.getInteger('montant');
    const raison = `${i.options.getString('raison')} (staff)`;
    const n = await economy.ajouterBonbons(target.id, sub === 'ajouter' ? montant : -montant, raison, 'manuel');
    return i.reply({ content: `${sub === 'ajouter' ? 'Ajouté' : 'Retiré'} : ${Math.abs(n)} bonbons pour <@${target.id}>. Nouveau solde : ${ok(store.user(target.id).balance)}.`, flags: E, allowedMentions: { parse: [] } });
  }
}

const list = DEFS.map((data) => ({ data, execute: (i) => handle(i) }));

module.exports = { register, handle, list };
