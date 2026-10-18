// Nettoyage des noms : « 🎃 .˚ ~ 𝓑𝓵𝓸𝓸𝓶𝓮𝓻𝓲𝓪 ~ ˚. 🎃 » devient « Bloomeria » (lettres fantaisie ramenées à des lettres normales).
const plain = (t) => String(t || '').normalize('NFKC').replace(/[^\p{L}\p{N} '’_.\-!]/gu, '').replace(/\s+/g, ' ').trim();
/** Nom du serveur pour les phrases : SERVER_NAME dans Railway s'il existe, sinon le nom nettoyé. */
function serverName(guildName) {
  if (process.env.SERVER_NAME) return process.env.SERVER_NAME;
  const s = plain(guildName).replace(/^[ .\-'’_!]+|[ .\-'’_!]+$/g, '');
  return s || String(guildName || 'le serveur');
}
module.exports = { plain, serverName };
