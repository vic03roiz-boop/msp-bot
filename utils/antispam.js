// Anti-spam simple basé sur la fréquence des messages.
// Si un membre envoie trop de messages en peu de temps, on considère que c'est du spam.

const MESSAGE_LIMIT = 5;       // nombre de messages...
const TIME_WINDOW_MS = 4000;   // ...en moins de X millisecondes = spam
const TIMEOUT_MS = 5 * 60 * 1000; // durée du mute automatique en cas de spam (5 minutes)

// Stocke les timestamps des derniers messages par membre : Map<userId, number[]>
const messageHistory = new Map();

/**
 * Enregistre un message et renvoie true si ça dépasse le seuil de spam.
 */
function isSpam(userId) {
  const now = Date.now();
  const timestamps = (messageHistory.get(userId) || []).filter(t => now - t < TIME_WINDOW_MS);
  timestamps.push(now);
  messageHistory.set(userId, timestamps);
  return timestamps.length > MESSAGE_LIMIT;
}

/**
 * Réinitialise le compteur d'un membre (utile après une action anti-spam).
 */
function resetHistory(userId) {
  messageHistory.delete(userId);
}

module.exports = { isSpam, resetHistory, TIMEOUT_MS, MESSAGE_LIMIT, TIME_WINDOW_MS };
