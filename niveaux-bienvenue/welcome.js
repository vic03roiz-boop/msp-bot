// Message de bienvenue : texte + salons cliquables + image de saison en bas (embed), dans le style du serveur.
const { EmbedBuilder } = require('discord.js');
const themes = require('./themes');
const names = require('./names');

// Salons cités dans le message (variables Railway ; une ligne dont le salon manque est simplement omise)
const ch = (name) => { const id = (process.env[name] || '').trim(); return id ? `<#${id}>` : null; };

const DECO = '⊹₊˚‧︵‿₊୨ෆ୧₊‿︵‧˚₊⊹';
const SPARK = '.·⁺ ₊⊹ ⁺˖ ✧ ˖⁺ ⊹₊ ⁺·.';

function build(themeName, mention, serverName, count) {
  const T = themes.get(themeName);
  const e = T.title[0]; // 🎃 / 🍂 / 🎄 / ❄️
  const rules = ch('WELCOME_RULES_CHANNEL_ID'), roles = ch('WELCOME_ROLES_CHANNEL_ID'), rolesMsp = ch('WELCOME_ROLES_MSP_CHANNEL_ID');
  const pseudos = ch('WELCOME_PSEUDOS_CHANNEL_ID'), chat = ch('WELCOME_CHAT_CHANNEL_ID');
  const name = `${e} .˚ ~ **${names.serverName(serverName)}** ~ ˚. ${e}`;
  const lines = [
    `**𝑩𝒊𝒆𝒏𝒗𝒆𝒏𝒖𝒆 𝒔𝒖𝒓** ${name}`, '', DECO, '',
    `Hey, ${mention}`, '♡ Merci d’avoir rejoint notre communauté ♡', '', SPARK, '',
  ];
  if (rules) lines.push(`𝒫our commencer, je t’invite à lire et à accepter le règlement ${rules} pour avoir accès à la totalité du serveur.`, '');
  if (roles && rolesMsp) lines.push(`𝒯u peux également prendre tes rôles ${roles} et ${rolesMsp} pour être notifié.`, '');
  else if (roles || rolesMsp) lines.push(`𝒯u peux également prendre tes rôles ${roles || rolesMsp} pour être notifié.`, '');
  if (pseudos) lines.push(`𝒫ense à mettre ton pseudo MSP ${pseudos} !`, '');
  if (chat) lines.push(`𝒩’hésite pas à passer discuter sur le ${chat} ♡`, '');
  lines.push(SPARK, '', `𝒜muse-toi bien au sein de ${name} On espère que tu te sentiras bien parmi nous ♡`, '', DECO);
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setDescription(lines.join('\n')).setImage('attachment://bienvenue.png');
  return { content: `⋆｡°ʚɞ°｡⋆ Welcome ${mention} ⋆｡°ʚɞ°｡⋆`, embeds: [embed] };
}

/** Message de remerciement pour un boost, même style que la bienvenue. */
function buildBoost(themeName, mention) {
  const T = themes.get(themeName);
  const e = T.title[0];
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setImage('attachment://boost.png')
    .setDescription([DECO, '', `${e} ♡ ${mention} vient de booster le serveur ! Merci ♡ ${e}`, '', DECO].join('\n'));
  return { content: `⋆｡°ʚɞ°｡⋆ Merci ${mention} ⋆｡°ʚɞ°｡⋆`, embeds: [embed] };
}

/** Message de départ, même style que la bienvenue. */
function buildLeave(themeName, mention, serverName) {
  const T = themes.get(themeName);
  const e = T.title[0];
  const name = `${e} .˚ ~ **${names.serverName(serverName)}** ~ ˚. ${e}`;
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setImage('attachment://depart.png')
    .setDescription([`**𝑨𝒖 𝒓𝒆𝒗𝒐𝒊𝒓**`, '', DECO, '', `${mention} a quitté ${name}.`, 'On lui souhaite un bon voyage.', '', SPARK, '',
      '♡ Nous sommes navrés que le serveur ne t’ait pas plu, prends soin de toi ♡', '', DECO].join('\n'));
  return { content: `⋆｡°ʚɞ°｡⋆ Bye ${mention} ⋆｡°ʚɞ°｡⋆`, embeds: [embed] };
}

/** Carte /invites : détail à la InviteLogger, dans le style du serveur. detail = { joins, left, fake, bonus } ou null. */
function buildInvites(themeName, { mention, count, rank, total, gap, aboveName, detail, invited, left }) {
  const T = themes.get(themeName);
  const e = T.title[0];
  const lines = [`**𝑰𝒏𝒗𝒊𝒕𝒂𝒕𝒊𝒐𝒏𝒔** ${e}`, '', DECO, '', `${mention} a actuellement **${count}** invitation${count > 1 ? 's' : ''} ! 👏`, ''];
  if (detail) lines.push(`✅ **${detail.joins}** invités`, `❌ **${detail.left}** partis`, `🚫 **${detail.fake}** invalidées`, `✨ **${detail.bonus}** bonus`, '');
  else if (invited) lines.push(`✅ **${invited}** arrivée${invited > 1 ? 's' : ''} suivie${invited > 1 ? 's' : ''} depuis l’installation du bot`, `❌ **${left}** parti${left > 1 ? 's' : ''}`, '');
  lines.push(SPARK, '');
  lines.push(rank ? `🏆 Classement : **#${rank}** sur ${total}` : 'Pas encore classé·e : partage le lien du serveur !');
  if (rank === 1) lines.push('👑 Tu es en tête du classement !');
  else if (rank) lines.push(`Encore **${gap}** invitation${gap > 1 ? 's' : ''} pour dépasser **${aboveName}**`);
  lines.push('', DECO);
  const embed = new EmbedBuilder().setColor(parseInt(T.accent.slice(1), 16)).setDescription(lines.join('\n')).setImage('attachment://invitations.png');
  return { embeds: [embed] };
}

module.exports = { buildInvites, build, buildBoost, buildLeave };
