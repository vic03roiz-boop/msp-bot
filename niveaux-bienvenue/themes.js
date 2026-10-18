// Saisons : couleurs, emojis et message de passage de niveau. La saison change toute seule selon la date (heure de Paris).
//   Halloween : jusqu'au 31 octobre · Automne : novembre · Noël : 1er décembre → 6 janvier · Hiver : 7 janvier → 20 mars
// Forcer une saison : variable LEVELS_THEME = halloween | automne | noel | hiver
const THEMES = {
  halloween: {
    label: 'Halloween',
    bg1: '#150b17', bg2: '#3b1608', text: '#fff3e2', mute: '#e6b98c', accent: '#ff7a18', accent2: '#ffc857',
    emojis: ['🎃', '🦇', '🕸️', '🍬', '👻', '🍂', '🕷️', '🍭'], main: '🎃', title: ['🎃', '🦇'],
    welcome: 'BIENVENUE', levelUp: 'NIVEAU SUPÉRIEUR !',
    message: '🎃🕸️ ⊹₊˚‧︵‿₊୨ {user}, tu viens de passer au niveau {level} ! Merci de ton activité au sein du serveur. ୧₊‿︵‧˚₊⊹ 🦇🍬',
  },
  automne: {
    label: 'Automne',
    bg1: '#1d1209', bg2: '#4a2410', text: '#fff1de', mute: '#e3b98a', accent: '#f0892f', accent2: '#e8c36a',
    emojis: ['🍂', '🍁', '🍄', '🌰', '🍃', '🥧', '🧡', '🍎'], main: '🍁', title: ['🍂', '🍁'],
    welcome: 'BIENVENUE', levelUp: 'NIVEAU SUPÉRIEUR !',
    message: '🍂🍁 ⊹₊˚‧︵‿₊୨ {user}, tu viens de passer au niveau {level} ! Merci de ton activité au sein du serveur. ୧₊‿︵‧˚₊⊹ 🍄🌰',
  },
  noel: {
    label: 'Noël',
    bg1: '#0a1a33', bg2: '#17406b', text: '#f3f9ff', mute: '#b5d3ec', accent: '#ff5468', accent2: '#ffd36e',
    emojis: ['🎄', '❄️', '⛄', '🎁', '⭐', '🔔', '🧦', '🍪'], main: '🎄', title: ['🎄', '❄️'],
    welcome: 'JOYEUX NOËL ET BIENVENUE', levelUp: 'NIVEAU SUPÉRIEUR !',
    message: '🎄❄️ ⊹₊˚‧︵‿₊୨ {user}, tu viens de passer au niveau {level} ! Merci de ton activité au sein du serveur. ୧₊‿︵‧˚₊⊹ 🎁⭐',
  },
  hiver: {
    label: 'Hiver',
    bg1: '#0c1730', bg2: '#243f73', text: '#f4f8ff', mute: '#b8c9e6', accent: '#7fd6ff', accent2: '#d6c2ff',
    emojis: ['❄️', '⛄', '🧣', '☃️', '🩵', '✨', '🧤', '☕'], main: '⛄', title: ['❄️', '⛄'],
    welcome: 'BIENVENUE', levelUp: 'NIVEAU SUPÉRIEUR !',
    message: '❄️⛄ ⊹₊˚‧︵‿₊୨ {user}, tu viens de passer au niveau {level} ! Merci de ton activité au sein du serveur. ୧₊‿︵‧˚₊⊹ ☃️✨',
  },
};

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
function seasonAt(ms = Date.now()) {
  const [, m, d] = fmt.format(new Date(ms)).split('-').map(Number);
  if (m === 10) return 'halloween';
  if (m === 11) return 'automne';
  if (m === 12 || (m === 1 && d <= 6)) return 'noel';
  if (m === 1 || m === 2 || (m === 3 && d <= 20)) return 'hiver';
  return 'halloween'; // en attendant le thème de printemps
}
const currentName = (ms) => (THEMES[(process.env.LEVELS_THEME || '').toLowerCase()] ? process.env.LEVELS_THEME.toLowerCase() : seasonAt(ms));
const get = (name) => THEMES[name] || THEMES.halloween;
/** Message de passage de niveau (LEVELS_MESSAGE dans Railway pour le personnaliser : {user} et {level}). */
const levelMessage = (name, userMention, level) => (process.env.LEVELS_MESSAGE || get(name).message).replace(/\{user\}/g, userMention).replace(/\{level\}/g, String(level));

module.exports = { THEMES, get, seasonAt, currentName, levelMessage };
