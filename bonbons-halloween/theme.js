// Tout le style des messages est ici : couleurs, phrases, emojis.
// Après le 31 octobre : mettre THEME=automne (variable Railway), aucune autre modification.
const cfg = require('./config');

const THEMES = {
  halloween: {
    color: 0xff7518,
    footer: 'Boutique des Citrouilles · MSP 🎃',
    gainTitles: [
      (n) => `${n} a ramassé des bonbons dans la nuit…`,
      (n) => `Une main surgit de la tombe : ${n} gagne des bonbons !`,
      (n) => `${n} a déterré un trésor sucré 🦇`,
      (n) => `Les fantômes offrent des bonbons à ${n} 👻`,
      (n) => `${n} a fait le plein de bonbons !`,
    ],
    paliertitle: 'La citrouille s’ouvre…',
    palierText: 'Un coffre ensorcelé t’attend !',
    ticketTitle: 'Le chaudron bouillonne',
    shopTitle: 'La Boutique des Citrouilles',
    soldeTitle: 'Ton sac à bonbons',
  },
  automne: {
    color: 0xc9661f,
    footer: 'Boutique des Citrouilles · MSP 🍂',
    gainTitles: [
      (n) => `${n} a ramassé des bonbons 🍂`,
      (n) => `${n} remplit son panier d’automne 🍁`,
      (n) => `${n} gagne des bonbons !`,
    ],
    paliertitle: 'Une récompense est prête…',
    palierText: 'Une belle récompense t’attend !',
    ticketTitle: 'Ta récompense est en route',
    shopTitle: 'La Boutique des Citrouilles',
    soldeTitle: 'Ton panier de bonbons',
  },
};

const t = THEMES[cfg.theme] || THEMES.halloween;
const { citrouille, bonbon } = cfg.emoji;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports = {
  ...t,
  citrouille,
  bonbon,
  gainTitle: (name) => pick(t.gainTitles)(name),
  fmt: (n) => Number(n).toLocaleString('fr-FR'),
};
