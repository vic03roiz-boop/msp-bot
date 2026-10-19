// /aide : la liste claire de toutes les commandes du bot, rangée par catégorie, aux couleurs de la saison.
//   Les membres voient leurs commandes ; le staff voit en plus la liste des commandes staff.
//   La liste se met à jour toute seule : une nouvelle commande ajoutée au bot apparaît dans /aide (rubrique « Autres » si je ne la connais pas).
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const themes = require('./themes');

const EPHEMERAL = 64;
const defs = [new SlashCommandBuilder().setName('aide').setDescription('La liste de toutes les commandes du bot')];
const NAMES = ['aide'];

const CATS = [
  ['🏆 Niveaux & invitations', /^(rang|classement|invites)$/],
  ['🍬 Bonbons & récompenses', /^(solde|recompenses|boutique|autographes|bonbons)$/],
  ['🎮 Jeux & concours', /(uno|pendu|drop|roue|wheel|jeu|gw|giveaway|reroll)/],
  ['🎫 Tickets', /ticket/],
  ['📊 Infos', /^(stats|aide|serveur|info)/],
];
const STAFF_RE = /^(statut|automod|niveaux|config|creer|reroll|blacklist|menu|avent-|annonce|logs-|mod-|avertir|muet|historique|tickets-ouverts|stats-config|apercu)/;

const clean = (d) => (d || '').replace(/^\(Staff\)\s*/i, '');
function usage(json) {
  const opts = (json.options || []).filter((o) => o.type !== 1 && o.type !== 2);
  const subs = (json.options || []).filter((o) => o.type === 1 || o.type === 2);
  if (subs.length) return '/' + json.name;
  return '/' + json.name + opts.map((o) => (o.required ? ` <${o.name}>` : ` [${o.name}]`)).join('');
}
function isStaff(json) {
  return json.default_member_permissions != null || /^\(Staff\)/i.test(json.description || '') || STAFF_RE.test(json.name);
}

async function run(i, extraDefs) {
  const T = themes.get(themes.currentName ? themes.currentName() : 'halloween');
  const src = i.client.commands?.size ? [...i.client.commands.values()].map((c) => c.data) : (extraDefs ? extraDefs() : defs);
  const all = src.filter(Boolean).map((d) => (d.toJSON ? d.toJSON() : d)).sort((a, b) => a.name.localeCompare(b.name));
  const membres = all.filter((j) => !isStaff(j)), staff = all.filter(isStaff);

  const groups = new Map(CATS.map(([n]) => [n, []]));
  const autres = [];
  for (const j of membres) {
    const cat = CATS.find(([, re]) => re.test(j.name));
    (cat ? groups.get(cat[0]) : autres).push(j);
  }
  if (autres.length) groups.set('✨ Autres', autres);

  const line = (j) => `\`${usage(j)}\`\n${clean(j.description)}`;
  const e = new EmbedBuilder().setColor(parseInt((T.accent || '#c4d6c3').replace('#', ''), 16))
    .setTitle(`${T.title?.[0] || '✨'} Les commandes de ${i.guild?.name?.replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'ce serveur'} ${T.title?.[1] || ''}`)
    .setDescription('Tape `/` puis le nom de la commande. Voici tout ce que tu peux faire :');
  for (const [name, list] of groups) if (list.length) e.addFields({ name, value: list.map(line).join('\n\n').slice(0, 1024) });
  e.setFooter({ text: 'Une question ? Ouvre un ticket 🎫' });

  const embeds = [e];
  const isMod = i.memberPermissions?.has(PermissionFlagsBits.ManageMessages) || i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) || i.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (isMod && staff.length) {
    const txt = staff.map((j) => `\`${usage(j)}\` · ${clean(j.description)}`).join('\n');
    embeds.push(new EmbedBuilder().setColor(0x9AA0A6).setTitle('🛠️ Commandes staff').setDescription(txt.length > 4000 ? txt.slice(0, 3990) + '…' : txt).setFooter({ text: 'Visible uniquement par le staff' }));
  }
  return i.reply({ embeds, flags: EPHEMERAL });
}

function register() {}
module.exports = { defs, NAMES, run, register };
