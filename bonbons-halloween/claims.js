// Réclamation des récompenses : proposition au palier, confirmation, ticket privé, livraison, remboursement.
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  ChannelType, PermissionFlagsBits,
} = require('discord.js');
const cfg = require('./config');
const theme = require('./theme');
const catalog = require('./catalog');
const store = require('./store');
const economy = require('./economy');
const runtime = require('./runtime');

const EPHEMERAL = 64;
const ok = (n) => theme.fmt(n);

const isStaff = (member) =>
  !!member && (runtime.staffRoleIds().some((id) => member.roles.cache.has(id)) || member.permissions.has(PermissionFlagsBits.ManageGuild));

const openTickets = () => Object.values(store.db.tickets).filter((t) => t.status === 'open' || t.status === 'taken');
const openTicketOf = (userId) => openTickets().find((t) => t.userId === userId);

/** Stock restant (Infinity tant que le staff n'a pas réglé /stock). */
function stockLeft(stockKey) {
  if (!stockKey) return Infinity;
  const s = store.db.stock[stockKey];
  if (s === undefined) return Infinity;
  const reserved = openTickets().filter((t) => t.stockKey === stockKey).length;
  return s - reserved;
}

function claimablePaliers(u) {
  return catalog.PALIERS.filter((p) => !u.claimedPaliers.includes(p.n) && p.cost <= u.balance);
}

// ---------- Proposition automatique quand un palier est atteint ----------
async function promptHook(userId) {
  const u = store.user(userId);
  u.notified = u.notified.filter((n) => catalog.PALIERS.find((p) => p.n === n)?.cost <= u.balance);
  const fresh = claimablePaliers(u).filter((p) => !u.notified.includes(p.n));
  if (!fresh.length) return;
  fresh.forEach((p) => u.notified.push(p.n));
  store.save();

  const best = fresh[fresh.length - 1];
  const ch = await economy.getChannel();
  if (!ch) return;
  const total = claimablePaliers(u).length;
  const e = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(`${theme.citrouille} ${theme.paliertitle}`)
    .setDescription(
      `Tu as **${ok(u.balance)}** ${theme.bonbon} : tu peux réclamer le **palier ${best.n}** (${ok(best.cost)} bonbons) : **${best.reward}**.\n` +
      (total > 1 ? `Au total, **${total} paliers** sont disponibles pour toi.\n` : '') +
      `\n${theme.palierText} Tu peux réclamer maintenant (le palier est alors payé avec tes bonbons) ou continuer à cumuler pour viser plus haut.`)
    .setFooter({ text: theme.footer });
  if (cfg.pumpkinImage) e.setThumbnail(cfg.pumpkinImage);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cl_now:${userId}`).setLabel('Réclamer maintenant').setStyle(ButtonStyle.Success).setEmoji('🎃'),
    new ButtonBuilder().setCustomId(`cl_later:${userId}`).setLabel('Continuer à cumuler').setStyle(ButtonStyle.Secondary).setEmoji('🍬'),
  );
  await ch.send({ content: `<@${userId}>`, embeds: [e], components: [row], allowedMentions: { users: [userId] } }).catch((err) => console.error('[bonbons] prompt', err.message));
}

// ---------- Menus ----------
function paliersMenu(u, userId) {
  const list = claimablePaliers(u).slice(0, 25);
  if (!list.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cl_pick:${userId}`)
      .setPlaceholder('Choisis le palier à réclamer')
      .addOptions(list.map((p) => ({
        label: `Palier ${p.n} · ${p.cost} bonbons`.slice(0, 100),
        description: p.reward.slice(0, 100),
        value: `p:${p.n}`,
      }))),
  );
}
function shopMenu(u, userId) {
  const list = catalog.SHOP.filter((s) => s.cit * catalog.CIT <= u.balance);
  if (!list.length) return null;
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`cl_pick:${userId}`)
      .setPlaceholder('Choisis un article')
      .addOptions(list.slice(0, 25).map((s) => ({
        label: `${s.name} · ${s.cit} citrouille${s.cit > 1 ? 's' : ''}`.slice(0, 100),
        description: `${ok(s.cit * catalog.CIT)} bonbons`,
        value: `s:${s.key}`,
      }))),
  );
}

// ---------- Vérification + confirmation ----------
function check(userId, key) {
  const item = catalog.resolve(key);
  if (!item) return { error: 'Cet article n’existe pas.' };
  const u = store.user(userId);
  if (openTicketOf(userId)) return { error: 'Tu as déjà un ticket de récompense ouvert : attends qu’il soit livré avant d’en ouvrir un autre.' };
  if (item.kind === 'p' && u.claimedPaliers.includes(item.palier)) return { error: 'Tu as déjà réclamé ce palier : chaque palier ne se réclame qu’une fois.' };
  if (item.kind === 'a') {
    const left = cfg.autographesMax - u.autographes;
    if (item.qty > left) return { error: `Plafond atteint : il te reste **${left}** autographe(s) échangeable(s) (maximum ${cfg.autographesMax} par membre).` };
  }
  if (u.balance < item.cost) return { error: `Il te manque **${ok(item.cost - u.balance)}** bonbons (tu en as ${ok(u.balance)}, il en faut ${ok(item.cost)}).` };
  if (stockLeft(item.stockKey) <= 0) return { error: 'Cette récompense est **épuisée** pour le moment 🕸️' };
  return { item, u };
}

function confirmView(userId, item, u) {
  const e = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(`${theme.citrouille} Confirmer ta récompense`)
    .setDescription(
      `**${item.title}**${item.note ? `\n_${item.note}_` : ''}\n\n` +
      `Coût : **${ok(item.cost)}** ${theme.bonbon}\nTon solde : ${ok(u.balance)} → **${ok(u.balance - item.cost)}** bonbons\n\n` +
      'Les bonbons sont retirés maintenant, et rendus si le staff annule. Un salon privé s’ouvre avec le staff pour la livraison.')
    .setFooter({ text: theme.footer });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cl_ok:${userId}:${item.key}`).setLabel('Confirmer').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId(`cl_no:${userId}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [e], components: [row] };
}

// ---------- Ticket ----------
async function createTicket(guild, member, key) {
  const c = check(member.id, key);
  if (c.error) return { error: c.error };
  const { item, u } = c;

  // Réservation immédiate des bonbons.
  u.balance -= item.cost;
  u.spent += item.cost;
  if (item.kind === 'p') u.claimedPaliers.push(item.palier);
  if (item.kind === 'a') u.autographes += item.qty;
  u.notified = u.notified.filter((n) => catalog.PALIERS.find((p) => p.n === n)?.cost <= u.balance);
  const id = store.db.meta.nextTicket++;
  const ticket = { id, userId: member.id, key, title: item.title, cost: item.cost, kind: item.kind, palier: item.palier, qty: item.qty, stockKey: item.stockKey, status: 'open', createdAt: Date.now(), channelId: null };
  store.db.tickets[id] = ticket;
  store.journal({ user: member.id, n: -item.cost, raison: `réclamation : ${item.title}`, category: 'depense', solde: u.balance, ticket: id });
  store.save();

  try {
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
    ];
    for (const rid of runtime.staffRoleIds()) overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    const name = `recompense-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 90);
    const channel = await guild.channels.create({
      name: name || `recompense-${id}`,
      type: ChannelType.GuildText,
      parent: runtime.ticketCategoryId(),
      permissionOverwrites: overwrites,
      topic: `Ticket #${id} · ${item.title}`,
    });
    ticket.channelId = channel.id;
    store.save();

    const e = new EmbedBuilder()
      .setColor(theme.color)
      .setTitle(`${theme.citrouille} ${theme.ticketTitle} · ticket #${id}`)
      .setDescription(
        `**Membre :** <@${member.id}>\n**Récompense :** ${item.title}${item.note ? ` (${item.note})` : ''}\n` +
        `**Bonbons dépensés :** ${ok(item.cost)} ${theme.bonbon}\n**Solde restant :** ${ok(u.balance)}\n\n` +
        'Le staff va te livrer ta récompense ici. Un membre du staff clique **Je m’en occupe**, puis **Livré** quand c’est fait.')
      .setFooter({ text: theme.footer });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tk_take:${id}`).setLabel('Je m’en occupe').setStyle(ButtonStyle.Primary).setEmoji('🕯️'),
      new ButtonBuilder().setCustomId(`tk_done:${id}`).setLabel('Livré').setStyle(ButtonStyle.Success).setEmoji('✅'),
      new ButtonBuilder().setCustomId(`tk_cancel:${id}`).setLabel('Annuler et rembourser').setStyle(ButtonStyle.Danger),
    );
    await channel.send({
      content: `<@${member.id}>${runtime.staffRoleIds().map((r) => ` <@&${r}>`).join('')}`,
      embeds: [e], components: [row],
      allowedMentions: { users: [member.id], roles: runtime.staffRoleIds() },
    });
    return { ticket, channel };
  } catch (err) {
    console.error('[bonbons] création de ticket impossible', err);
    refund(ticket);
    return { error: 'Je n’ai pas pu ouvrir le salon privé (permissions ou catégorie incorrecte). Tes bonbons ont été rendus : préviens le staff.' };
  }
}

function refund(ticket) {
  const u = store.user(ticket.userId);
  u.balance += ticket.cost;
  u.spent -= ticket.cost;
  if (ticket.kind === 'p') u.claimedPaliers = u.claimedPaliers.filter((n) => n !== ticket.palier);
  if (ticket.kind === 'a') u.autographes = Math.max(0, u.autographes - ticket.qty);
  ticket.status = 'cancelled';
  store.journal({ user: ticket.userId, n: ticket.cost, raison: `remboursement : ${ticket.title}`, category: 'remboursement', solde: u.balance, ticket: ticket.id });
  store.save();
}

async function closeChannelLater(guild, ticket, ms = 60000) {
  setTimeout(async () => {
    const ch = ticket.channelId && (await guild.channels.fetch(ticket.channelId).catch(() => null));
    if (ch) await ch.delete('Ticket de récompense terminé').catch(() => {});
  }, ms).unref();
}

// ---------- Interactions (boutons et menus) ----------
async function handleComponent(i) {
  const [kind, a, b] = i.customId.split(':');

  // Boutons réservés au membre concerné
  if (kind.startsWith('cl_')) {
    if (i.user.id !== a) return i.reply({ content: 'Ce bouton n’est pas pour toi 🎃', flags: EPHEMERAL });
    const u = store.user(a);

    if (kind === 'cl_later') {
      return i.update({ components: [], embeds: [EmbedBuilder.from(i.message.embeds[0]).setFooter({ text: `Tu continues à cumuler… quand tu veux : /recompenses · ${theme.footer}` })] });
    }
    if (kind === 'cl_now') {
      const menu = paliersMenu(u, a);
      if (!menu) return i.reply({ content: 'Aucun palier disponible pour le moment.', flags: EPHEMERAL });
      return i.reply({ content: 'Choisis le palier à réclamer :', components: [menu], flags: EPHEMERAL });
    }
    if (kind === 'cl_pick') {
      const c = check(a, i.values[0]);
      if (c.error) return i.update({ content: c.error, components: [], embeds: [] });
      return i.update({ content: '', ...confirmView(a, c.item, c.u) });
    }
    if (kind === 'cl_no') return i.update({ content: 'Réclamation annulée, tes bonbons sont intacts 🍬', embeds: [], components: [] });
    if (kind === 'cl_ok') {
      await i.update({ content: 'Ouverture du salon privé…', embeds: [], components: [] });
      const res = await createTicket(i.guild, i.member, `${b}${i.customId.split(':').slice(3).map((x) => ':' + x).join('')}`);
      if (res.error) return i.editReply({ content: res.error });
      return i.editReply({ content: `C’est parti ! Ton salon privé : <#${res.channel.id}> ${theme.citrouille}` });
    }
  }

  // Boutons du ticket : staff uniquement
  if (kind.startsWith('tk_')) {
    const ticket = store.db.tickets[a];
    if (!ticket) return i.reply({ content: 'Ticket introuvable.', flags: EPHEMERAL });
    if (!isStaff(i.member)) return i.reply({ content: 'Seul le staff peut utiliser ce bouton 🕸️', flags: EPHEMERAL });
    if (ticket.status === 'done' || ticket.status === 'cancelled') return i.reply({ content: 'Ce ticket est déjà terminé.', flags: EPHEMERAL });

    if (kind === 'tk_take') {
      ticket.status = 'taken';
      ticket.takenBy = i.user.id;
      store.save();
      return i.reply({ content: `🕯️ <@${i.user.id}> s’occupe de cette récompense.`, allowedMentions: { parse: [] } });
    }
    if (kind === 'tk_done') {
      ticket.status = 'done';
      ticket.doneBy = i.user.id;
      if (ticket.stockKey && store.db.stock[ticket.stockKey] !== undefined) {
        store.db.stock[ticket.stockKey] = Math.max(0, store.db.stock[ticket.stockKey] - 1);
      }
      store.journal({ user: ticket.userId, raison: `livré : ${ticket.title}`, category: 'livraison', ticket: ticket.id, par: i.user.id });
      store.save();
      await i.update({ components: [] });
      await i.channel.send(`✅ **Livré !** Merci <@${ticket.userId}> et bonne Halloween ${theme.citrouille}. Ce salon se ferme dans une minute.`);
      return closeChannelLater(i.guild, ticket);
    }
    if (kind === 'tk_cancel') {
      refund(ticket);
      await i.update({ components: [] });
      await i.channel.send(`❌ Ticket annulé par <@${i.user.id}>. Les **${ok(ticket.cost)}** bonbons ont été rendus à <@${ticket.userId}>. Ce salon se ferme dans une minute.`);
      return closeChannelLater(i.guild, ticket);
    }
  }
}

/** Au redémarrage : supprime les salons des tickets déjà terminés. */
async function sweep(guild) {
  for (const t of Object.values(store.db.tickets)) {
    if ((t.status === 'done' || t.status === 'cancelled') && t.channelId) {
      const ch = await guild.channels.fetch(t.channelId).catch(() => null);
      if (ch) await ch.delete('Ticket terminé').catch(() => {});
      t.channelId = null;
    }
  }
  store.save();
}

module.exports = { promptHook, handleComponent, createTicket, check, confirmView, paliersMenu, shopMenu, claimablePaliers, stockLeft, isStaff, openTicketOf, sweep, EPHEMERAL };
