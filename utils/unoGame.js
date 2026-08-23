// Moteur de jeu UNO. Les parties sont stockées en mémoire (une par salon Discord),
// donc elles ne survivent pas à un redémarrage du bot — c'est volontaire pour rester simple.

const COLORS = ['rouge', 'jaune', 'vert', 'bleu'];
const COLOR_EMOJI = { rouge: '🔴', jaune: '🟡', vert: '🟢', bleu: '🔵', noir: '⚫' };

// games: Map<channelId, GameState>
const games = new Map();

function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: String(i) });
      deck.push({ color, value: String(i) });
    }
    for (const special of ['Passer', 'Inverser', '+2']) {
      deck.push({ color, value: special });
      deck.push({ color, value: special });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'noir', value: 'Joker' });
    deck.push({ color: 'noir', value: 'Joker+4' });
  }
  return shuffle(deck);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardLabel(card) {
  return `${COLOR_EMOJI[card.color]} ${card.value}`;
}

function cardMatches(card, topCard, currentColor) {
  if (card.color === 'noir') return true; // les Jokers se jouent toujours
  return card.color === currentColor || card.value === topCard.value;
}

function createGame(channelId, hostId) {
  const game = {
    channelId,
    hostId,
    players: [hostId], // liste ordonnée des userId
    hands: {},          // userId -> carte[]
    deck: [],
    discard: [],
    currentColor: null,
    currentPlayerIndex: 0,
    direction: 1,
    started: false,
    pendingColorChoice: false, // true après avoir joué un Joker, en attente du choix de couleur
    lastPlayerToPlayWild: null,
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

function addPlayer(game, userId) {
  if (!game.players.includes(userId)) game.players.push(userId);
}

function startGame(game) {
  game.deck = createDeck();
  game.hands = {};
  for (const playerId of game.players) {
    game.hands[playerId] = game.deck.splice(0, 7);
  }

  // On tire la première carte de la défausse ; si c'est un Joker+4, on relance (règle simplifiée)
  let firstCard = game.deck.pop();
  while (firstCard.value === 'Joker+4') {
    game.deck.unshift(firstCard);
    game.deck = shuffle(game.deck);
    firstCard = game.deck.pop();
  }
  game.discard = [firstCard];
  game.currentColor = firstCard.color === 'noir' ? COLORS[Math.floor(Math.random() * 4)] : firstCard.color;
  game.currentPlayerIndex = 0;
  game.started = true;
}

function currentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function topCard(game) {
  return game.discard[game.discard.length - 1];
}

function advanceTurn(game, steps = 1) {
  const n = game.players.length;
  game.currentPlayerIndex = (game.currentPlayerIndex + game.direction * steps + n * steps) % n;
}

function drawCards(game, playerId, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (game.deck.length === 0) reshuffleDiscardIntoDeck(game);
    if (game.deck.length === 0) break; // plus aucune carte disponible (cas très rare)
    drawn.push(game.deck.pop());
  }
  game.hands[playerId].push(...drawn);
  return drawn;
}

function reshuffleDiscardIntoDeck(game) {
  const last = game.discard.pop();
  game.deck = shuffle(game.discard);
  game.discard = [last];
}

/**
 * Joue une carte pour le joueur courant.
 * Renvoie { success, error?, winnerId?, needsColorChoice? }
 */
function playCard(game, playerId, cardIndex) {
  const hand = game.hands[playerId];
  const card = hand[cardIndex];
  if (!card) return { success: false, error: 'Carte introuvable.' };

  if (!cardMatches(card, topCard(game), game.currentColor)) {
    return { success: false, error: "Cette carte ne correspond pas à la couleur ou à la valeur en cours." };
  }

  hand.splice(cardIndex, 1);
  game.discard.push(card);

  if (hand.length === 0) {
    return { success: true, winnerId: playerId };
  }

  if (card.color === 'noir') {
    game.lastPlayerToPlayWild = playerId;
    if (card.value === 'Joker+4') {
      advanceTurn(game);
      const victim = currentPlayer(game);
      drawCards(game, victim, 4);
      advanceTurn(game); // la victime passe son tour
    } else {
      advanceTurn(game);
    }
    return { success: true, needsColorChoice: true };
  }

  game.currentColor = card.color;

  if (card.value === 'Passer') {
    advanceTurn(game, 2);
  } else if (card.value === 'Inverser') {
    game.direction *= -1;
    // à 2 joueurs, Inverser agit comme Passer
    advanceTurn(game, game.players.length === 2 ? 2 : 1);
  } else if (card.value === '+2') {
    advanceTurn(game);
    const victim = currentPlayer(game);
    drawCards(game, victim, 2);
    advanceTurn(game);
  } else {
    advanceTurn(game);
  }

  return { success: true };
}

function chooseColor(game, color) {
  game.currentColor = color;
}

module.exports = {
  COLORS,
  COLOR_EMOJI,
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  startGame,
  currentPlayer,
  topCard,
  drawCards,
  playCard,
  chooseColor,
  advanceTurn,
  cardLabel,
  cardMatches,
};
