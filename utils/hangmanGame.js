// Moteur de jeu du Pendu. Une partie par salon, stockée en mémoire (perdue si le bot redémarre).

const WORDS = [
  // Discord / communauté
  'DISCORD', 'GIVEAWAY', 'MODERATEUR', 'SERVEUR', 'GAGNANT', 'BLACKLIST',
  'INFLUENCEUR', 'STREAMING', 'MICROPHONE', 'PSEUDO', 'EMOJI', 'MESSAGE',
  'COMMUNAUTE', 'ADMINISTRATEUR', 'SALON', 'ROBOT', 'NOTIFICATION',

  // Mode / beauté / lifestyle
  'COSTUME', 'BOUTIQUE', 'MAQUILLAGE', 'PARFUM', 'BIJOUX', 'CHAUSSURES',
  'ROBE', 'CHAPEAU', 'ECHARPE', 'MANTEAU', 'SAC', 'ROUGEALEVRES',
  'VERNIS', 'COIFFURE', 'ACCESSOIRE', 'TENUE', 'MANNEQUIN',

  // Animaux
  'CHATON', 'CHIEN', 'LAPIN', 'HAMSTER', 'PERROQUET', 'TORTUE', 'DAUPHIN',
  'PAPILLON', 'RENARD', 'PANDA', 'KOALA', 'PINGOUIN', 'GIRAFE', 'ZEBRE',
  'HIBOU', 'ECUREUIL', 'PAON',

  // Nourriture
  'PIZZA', 'CHOCOLAT', 'GATEAU', 'CROISSANT', 'BONBON', 'GLACE', 'CREPE',
  'SANDWICH', 'BISCUIT', 'FRAISE', 'ORANGE', 'BANANE', 'ANANAS', 'CERISE',
  'CARAMEL', 'MACARON', 'MIEL', 'CITRON',

  // Nature / saisons
  'PRINTEMPS', 'MONTAGNE', 'PLAGE', 'FORET', 'ARCENCIEL', 'ETOILE',
  'NUAGE', 'SOLEIL', 'OCEAN', 'CASCADE', 'VOLCAN', 'DESERT', 'JARDIN',
  'RIVIERE', 'NEIGE', 'ORAGE', 'AUTOMNE',

  // Loisirs / divertissement
  'CINEMA', 'MUSIQUE', 'GUITARE', 'PIANO', 'PEINTURE', 'DANSE', 'THEATRE',
  'AVENTURE', 'VOYAGE', 'PHOTOGRAPHIE', 'LECTURE', 'PUZZLE', 'KARAOKE',
  'MAGICIEN', 'CIRQUE', 'FEUDARTIFICE', 'CONCERT',

  // Fêtes / occasions
  'ANNIVERSAIRE', 'VACANCES', 'NOEL', 'HALLOWEEN', 'CADEAU', 'BALLON',
  'CONFETTI', 'GUIRLANDE', 'BOUGIE', 'INVITATION', 'SURPRISE',

  // Objets / technologie
  'ORDINATEUR', 'CLAVIER', 'TELEPHONE', 'CASQUE', 'MANETTE', 'ECRAN',
  'SOURIS', 'IMPRIMANTE', 'TABLETTE', 'CAMERA', 'LAMPE', 'HORLOGE',

  // Personnages / fantastique
  'PRINCESSE', 'CHEVALIER', 'SORCIERE', 'DRAGON', 'LICORNE', 'FANTOME',
  // MovieStarPlanet
  'STARCOINS', 'DIAMANTS', 'MOVIESTAR', 'GLAMOUR', 'CELEBRE', 'NIVEAU',
  'STUDIO', 'APPARTEMENT', 'GARDEROBE', 'RARE', 'CONCOURS', 'DESIGN',
  'MEILLEURAMI', 'JOURNALINTIME', 'DEGUISEMENT', 'LOOKBOOK', 'ADMIRATEUR',
  'POPULAIRE', 'ETINCELANT', 'SCINTILLANT', 'PALACE', 'CHATEAU', 'ROYAUTE',
  'MAGASIN', 'VETEMENTS', 'TALONS', 'PERRUQUE', 'STARDESIGN', 'FAMEUX',

  'PIRATE', 'SIRENE', 'VAMPIRE', 'FEE', 'SUPERHEROS', 'ROBOT',
];

// On retire les doublons éventuels (ex: ROBOT apparaît dans deux catégories)
const UNIQUE_WORDS = [...new Set(WORDS)];

const MAX_WRONG = 6;

const HANGMAN_STAGES = [
`\`\`\`
 +---+
 |   |
     |
     |
     |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
     |
     |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
 |   |
     |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
/|   |
     |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
/|\\  |
     |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
/|\\  |
/    |
     |
=========
\`\`\``,
`\`\`\`
 +---+
 |   |
 O   |
/|\\  |
/ \\  |
     |
=========
\`\`\``,
];

// games: Map<channelId, GameState>
const games = new Map();

function createGame(channelId) {
  const word = UNIQUE_WORDS[Math.floor(Math.random() * UNIQUE_WORDS.length)];
  const game = {
    channelId,
    word,
    guessedLetters: new Set(),
    wrongCount: 0,
    finished: false,
  };
  games.set(channelId, game);
  return game;
}

function getGame(channelId) {
  return games.get(channelId);
}

function deleteGame(channelId) {
  games.delete(channelId);
}

function maskedWord(game) {
  return game.word
    .split('')
    .map(letter => (game.guessedLetters.has(letter) ? letter : '_'))
    .join(' ');
}

function isWon(game) {
  return game.word.split('').every(letter => game.guessedLetters.has(letter));
}

/**
 * Propose une lettre. Renvoie { alreadyGuessed, correct, won, lost }
 */
function guessLetter(game, rawLetter) {
  const letter = rawLetter.toUpperCase();

  if (game.guessedLetters.has(letter)) {
    return { alreadyGuessed: true };
  }

  game.guessedLetters.add(letter);
  const correct = game.word.includes(letter);
  if (!correct) game.wrongCount++;

  const won = isWon(game);
  const lost = !won && game.wrongCount >= MAX_WRONG;
  if (won || lost) game.finished = true;

  return { alreadyGuessed: false, correct, won, lost };
}

function hangmanDrawing(game) {
  return HANGMAN_STAGES[Math.min(game.wrongCount, MAX_WRONG)];
}

module.exports = {
  MAX_WRONG,
  createGame,
  getGame,
  deleteGame,
  maskedWord,
  isWon,
  guessLetter,
  hangmanDrawing,
};
