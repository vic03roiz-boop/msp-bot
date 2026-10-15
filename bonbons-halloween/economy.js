// ajouterBonbons : LA fonction par laquelle passe chaque gain (solde, plafonds, journal, annonce).
const { EmbedBuilder } = require('discord.js');
const cfg = require('./config');
const theme = require('./theme');
const store = require('./store');
const engine = require('./engine');

let client = null;
let promptHook = async () => {};
const setClient = (c) => { client = c; };
const setPromptHook = (fn) => { promptHook = fn; };

const cit = (bal) => Math.floor(bal / cfg.bonbonsParCitrouille);

async function getChannel() {
  if (!cfg.niveauxChannelId || !client) return null;
  return client.channels.cache.get(cfg.niveauxChannelId) || (await client.channels.fetch(cfg.niveauxChannelId).catch(() => null));
}
async function displayName(userId) {
  const g = client?.guilds.cache.get(cfg.guildId);
  const m = g ? await g.members.fetch(userId).catch(() => null) : null;
  return m?.displayName || 'Un membre';
}

/**
 * category : 'manuel' (staff, hors plafonds) | 'jour' | 'serie' | 'fidelite' | 'semaine' | 'parrainage' | 'boost' | 'succes' | 'giveaway'
 * Renvoie le montant réellement ajouté.
 */
async function ajouterBonbons(userId, amount, raison, category = 'manuel') {
  const u = store.user(userId);
  let n = Math.trunc(amount);
  if (!n) return 0;

  if (n < 0) {
    n = -Math.min(u.balance, -n);
  } else if (category !== 'manuel') {
    if (category === 'jour' && u.today) n = Math.min(n, cfg.dailyCap - (u.today.earnedJour || 0));
    n = Math.min(n, cfg.totalCap - u.eventEarned);
    if (n <= 0) return 0;
    if (category === 'jour' && u.today) u.today.earnedJour = (u.today.earnedJour || 0) + n;
    u.eventEarned += n;
    u.earned += n;
  }
  if (!n) return 0;

  u.balance += n;
  u.hist.push({ t: Date.now(), n, raison });
  if (u.hist.length > 10) u.hist.shift();
  store.journal({ user: userId, n, raison, category, solde: u.balance });
  store.save();

  if (n > 0) queueAnnounce(userId, n, raison);
  return n;
}

/** Applique une liste de gains venant du moteur. */
async function pushGains(userId, gains) {
  for (const g of gains) await ajouterBonbons(userId, g.amount, g.reason, g.category);
}

// ---- Annonces : 1 message par membre toutes les 10 min, les gains suivants éditent le même message ----
const states = new Map(); // userId -> { firstAt, lines, name, title, message, chain }

function buildEmbed(userId, st) {
  const u = store.user(userId);
  const shown = st.lines.slice(-8);
  const more = st.lines.length > 8 ? `\n… et ${st.lines.length - 8} autre(s) gain(s)` : '';
  const e = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(`${theme.citrouille} ${st.title}`)
    .setDescription(shown.map((l) => `${theme.bonbon} **+${l.amount}** · ${l.reason}`).join('\n') + more)
    .setFooter({ text: `Solde : ${theme.fmt(u.balance)} bonbons (${cit(u.balance)} citrouille${cit(u.balance) > 1 ? 's' : ''}) · ${theme.footer}` });
  if (cfg.pumpkinImage) e.setThumbnail(cfg.pumpkinImage);
  return e;
}

function queueAnnounce(userId, amount, reason) {
  const now = Date.now();
  let st = states.get(userId);
  if (st && now - st.firstAt < cfg.announceWindowMs) {
    st.lines.push({ amount, reason });
    st.chain = st.chain.then(() => edit(userId, st)).then(() => promptHook(userId));
    return;
  }
  st = { firstAt: now, lines: [{ amount, reason }], name: null, title: null, message: null, chain: null };
  states.set(userId, st);
  st.chain = send(userId, st).then(() => promptHook(userId));
}

async function send(userId, st) {
  try {
    const ch = await getChannel();
    if (!ch) return;
    st.name = await displayName(userId);
    st.title = theme.gainTitle(st.name);
    st.message = await ch.send({ embeds: [buildEmbed(userId, st)], allowedMentions: { parse: [] } });
  } catch (e) {
    console.error('[bonbons] annonce impossible', e.message);
  }
}
async function edit(userId, st) {
  try {
    if (!st.message) return;
    await st.message.edit({ embeds: [buildEmbed(userId, st)], allowedMentions: { parse: [] } });
  } catch (e) {
    console.error('[bonbons] modification d’annonce impossible', e.message);
  }
}

module.exports = { setClient, setPromptHook, ajouterBonbons, pushGains, getChannel, displayName, cit };
