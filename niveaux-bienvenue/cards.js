// Cartes en image : carte de rang et image de bienvenue (@napi-rs/canvas, polices incluses dans fonts/).
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans.ttf'), 'CardSans');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'), 'CardSansBold');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoColorEmoji.ttf'), 'CardEmoji');
const themes = require('./themes');

const getTheme = (name) => themes.get(name);
const names = require('./names');
const clean = (name, max = 22) => (names.plain(String(name || '').normalize('NFKC').replace(/[^A-Za-zÀ-ÿ0-9 _.\-!'’]/g, '')) || 'membre').slice(0, max);
const nf = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');

async function fetchImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch { return null; }
}
function gradient(g, w, h, T) { const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, T.bg1); bg.addColorStop(1, T.bg2); g.fillStyle = bg; g.fillRect(0, 0, w, h); }
function circleImage(g, img, cx, cy, r, fallbackLetter, T) {
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
  if (img) g.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else {
    const f = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); f.addColorStop(0, T.accent); f.addColorStop(1, T.accent2);
    g.fillStyle = f; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.fillStyle = '#fff'; g.font = `${Math.round(r)}px CardSansBold, CardEmoji`; g.textAlign = 'center'; g.fillText((fallbackLetter || '?').toUpperCase(), cx, cy + r * 0.35);
  }
  g.restore();
  g.beginPath(); g.arc(cx, cy, r + 3, 0, Math.PI * 2); g.lineWidth = 5; g.strokeStyle = T.accent; g.stroke();
}
/** Emojis de saison en décor (légers, sur les bords) + un grand emoji principal à droite. */
function decor(g, W, H, T, big = true, sides = false) {
  let spots = [[0.045, 0.12, 0.13], [0.30, 0.92, 0.10], [0.62, 0.10, 0.10], [0.80, 0.90, 0.13], [0.975, 0.45, 0.10], [0.50, 0.50, 0], [0.02, 0.88, 0.11]];
  if (sides) spots = [[0.06, 0.16, 0.2], [0.94, 0.18, 0.17], [0.04, 0.78, 0.16], [0.95, 0.80, 0.2], [0.17, 0.46, 0.1], [0.84, 0.48, 0.1]];
  g.save(); g.fillStyle = '#ffffff'; g.globalAlpha = 0.4; g.textAlign = 'center'; g.textBaseline = 'middle';
  spots.forEach(([fx, fy, fs], k) => { if (!fs) return; g.font = `${Math.round(H * fs * 1.6)}px CardEmoji`; g.fillText(T.emojis[(k + 1) % T.emojis.length], W * fx, H * fy); });
  g.restore();
  if (big) { g.save(); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${Math.round(H * 0.42)}px CardEmoji`; g.fillText(T.main, W - H * 0.42, H * 0.5); g.restore(); }
  g.textBaseline = 'alphabetic';
}
function cover(g, img, w, h) {
  const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Carte de rang 934 x 282. */
async function rankCard({ name, avatarUrl, level, into, need, rank, total, xp, theme }) {
  const T = getTheme(theme);
  const W = 934, H = 282, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  gradient(g, W, H, T);
  g.fillStyle = '#ffffff10'; g.beginPath(); g.roundRect(20, 20, W - 40, H - 40, 22); g.fill();
  decor(g, W, H, T, false);
  circleImage(g, await fetchImage(avatarUrl), 130, 141, 82, clean(name)[0], T);
  const x0 = 250;
  g.textAlign = 'left'; g.fillStyle = T.text; g.font = '34px CardSansBold, CardEmoji'; g.fillText(clean(name), x0, 105);
  g.fillStyle = T.mute; g.font = '18px CardSans, CardEmoji'; g.fillText(`${nf(xp)} XP au total`, x0, 135);
  g.textAlign = 'right'; g.fillStyle = T.accent; g.font = '26px CardSansBold, CardEmoji'; g.fillText(`NIVEAU ${level}`, W - 50, 88);
  g.fillStyle = T.accent2; g.fillText(`RANG #${rank}`, W - 50, 125);
  const bx = x0, by = 175, bw = W - 50 - bx, bh = 34, pct = Math.max(0.02, Math.min(1, into / need));
  g.fillStyle = '#ffffff1c'; g.beginPath(); g.roundRect(bx, by, bw, bh, 17); g.fill();
  const f = g.createLinearGradient(bx, 0, bx + bw, 0); f.addColorStop(0, T.accent); f.addColorStop(1, T.accent2);
  g.fillStyle = f; g.beginPath(); g.roundRect(bx, by, bw * pct, bh, 17); g.fill();
  g.textAlign = 'left'; g.fillStyle = T.text; g.font = '16px CardSansBold, CardEmoji'; g.fillText(`${nf(into)} / ${nf(need)} XP`, bx + 14, by + 23);
  g.textAlign = 'right'; g.fillStyle = T.mute; g.font = '15px CardSans, CardEmoji'; g.fillText(`${total ? `${rank} sur ${total} membres classés` : ''}`, W - 50, 240);
  return canvas.toBuffer('image/png');
}

/** Image de bienvenue 1000 x 360 : bannière en fond (ou dégradé), avatar rond, pseudo, numéro de membre. */
async function welcomeCard({ name, avatarUrl, bannerUrl, memberCount, serverName, theme }) {
  const T = getTheme(theme);
  const W = 1000, H = 360, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  let banner = await fetchImage(bannerUrl);
  if (!banner) { const local = path.join(__dirname, 'assets', 'banniere.png'); if (fs.existsSync(local)) banner = await loadImage(fs.readFileSync(local)).catch(() => null); }
  if (banner) { cover(g, banner, W, H); g.fillStyle = '#10081f99'; g.fillRect(0, 0, W, H); } else gradient(g, W, H, T);
  decor(g, W, H, T, false, true);
  circleImage(g, await fetchImage(avatarUrl), W / 2, 118, 70, clean(name)[0], T);
  g.textAlign = 'center'; g.fillStyle = T.accent; g.font = '22px CardSansBold, CardEmoji'; g.fillText(`${T.title[0]} ${T.welcome} ${T.title[1]}`, W / 2, 232);
  g.fillStyle = T.text; g.font = '38px CardSansBold, CardEmoji'; g.fillText(clean(name, 26), W / 2, 280);
  g.fillStyle = T.mute; g.font = '19px CardSans, CardEmoji';
  g.fillText(`${serverName ? `sur ${clean(names.serverName(serverName), 30)} · ` : ''}tu es le membre n°${nf(memberCount)}`, W / 2, 316);
  return canvas.toBuffer('image/png');
}

/** Image « passage de niveau » 900 x 240. */
async function levelUpCard({ name, avatarUrl, from, to, theme }) {
  const T = getTheme(theme);
  const W = 900, H = 240, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  gradient(g, W, H, T);
  g.fillStyle = '#ffffff10'; g.beginPath(); g.roundRect(14, 14, W - 28, H - 28, 20); g.fill();
  decor(g, W, H, T, true);
  circleImage(g, await fetchImage(avatarUrl), 120, 120, 72, clean(name)[0], T);
  g.textAlign = 'left'; g.fillStyle = T.accent; g.font = '20px CardSansBold, CardEmoji'; g.fillText(`${T.title[0]} ${T.levelUp}`, 230, 78);
  g.fillStyle = T.text; g.font = '36px CardSansBold, CardEmoji'; g.fillText(clean(name, 22), 230, 128);
  g.fillStyle = T.mute; g.font = '20px CardSans, CardEmoji'; g.fillText(`Niveau ${from}  →`, 230, 172);
  const w = g.measureText(`Niveau ${from}  →`).width;
  g.fillStyle = T.accent2; g.font = '30px CardSansBold, CardEmoji'; g.fillText(`Niveau ${to}`, 230 + w + 14, 174);
  return canvas.toBuffer('image/png');
}

/** Image « merci pour le boost » 1000 x 360 : même présentation que la bienvenue, texte différent. */
async function boostCard({ name, avatarUrl, serverName, theme }) {
  const T = getTheme(theme);
  const W = 1000, H = 360, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  gradient(g, W, H, T);
  decor(g, W, H, T, false, true);
  circleImage(g, await fetchImage(avatarUrl), W / 2, 118, 70, clean(name)[0], T);
  g.textAlign = 'center'; g.fillStyle = T.accent; g.font = '22px CardSansBold, CardEmoji'; g.fillText('💎 MERCI POUR LE BOOST ' + T.title[0], W / 2, 232);
  g.fillStyle = T.text; g.font = '38px CardSansBold, CardEmoji'; g.fillText(clean(name, 26), W / 2, 280);
  g.fillStyle = T.mute; g.font = '19px CardSans, CardEmoji'; g.fillText(`tu fais briller ${clean(names.serverName(serverName), 30)} ✨`, W / 2, 316);
  return canvas.toBuffer('image/png');
}

/** Image « au revoir » 1000 x 360. */
async function leaveCard({ name, avatarUrl, serverName, theme }) {
  const T = getTheme(theme);
  const W = 1000, H = 360, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  gradient(g, W, H, T);
  decor(g, W, H, T, false, true);
  circleImage(g, await fetchImage(avatarUrl), W / 2, 118, 70, clean(name)[0], T);
  g.textAlign = 'center'; g.fillStyle = T.accent; g.font = '22px CardSansBold, CardEmoji'; g.fillText('👋 AU REVOIR ' + T.title[1], W / 2, 232);
  g.fillStyle = T.text; g.font = '38px CardSansBold, CardEmoji'; g.fillText(clean(name, 26), W / 2, 280);
  g.fillStyle = T.mute; g.font = '19px CardSans, CardEmoji'; g.fillText(`a quitté ${clean(names.serverName(serverName), 30)} · bon voyage`, W / 2, 316);
  return canvas.toBuffer('image/png');
}

/** Carte « invitations » 960 x 340 : profil à gauche, total, tuiles de détail et barre vers le rang du dessus. */
async function invitesCard({ name, avatarUrl, count, rank, total, gap, above, tiles, theme }) {
  const T = getTheme(theme);
  const W = 960, H = 340, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  gradient(g, W, H, T);
  decor(g, W, H, T, false, true);
  const rr = (x, y, w, h, r, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  rr(24, 24, 270, H - 48, 24, 'rgba(0,0,0,0.38)');
  circleImage(g, await fetchImage(avatarUrl), 159, 118, 66, clean(name)[0], T);
  g.textAlign = 'center'; g.fillStyle = T.text; g.font = '24px CardSansBold, CardEmoji'; g.fillText(clean(name, 16), 159, 226);
  rr(84, 248, 150, 38, 19, T.accent);
  g.fillStyle = '#1a0f08'; g.font = '19px CardSansBold, CardEmoji'; g.fillText(rank ? `🏆 #${rank} / ${total}` : 'Non classé', 159, 274);
  const x0 = 326;
  g.textAlign = 'left'; g.fillStyle = T.accent; g.font = '19px CardSansBold, CardEmoji'; g.fillText(`📨 INVITATIONS ${T.title[0]}`, x0, 62);
  g.fillStyle = T.accent2; g.font = '72px CardSansBold, CardEmoji'; g.fillText(nf(count), x0, 140);
  const w = g.measureText(nf(count)).width;
  g.fillStyle = T.mute; g.font = '24px CardSans, CardEmoji'; g.fillText(count > 1 ? 'au total' : 'au total', x0 + w + 14, 140);
  const n = tiles.length, tw = (W - 24 - x0 - 12 * (n - 1) - 12) / n;
  tiles.forEach((t, k) => {
    const x = x0 + k * (tw + 12);
    rr(x, 164, tw, 84, 16, 'rgba(255,255,255,0.09)');
    g.textAlign = 'center'; g.fillStyle = T.text; g.font = '30px CardSansBold, CardEmoji'; g.fillText(nf(t.value), x + tw / 2, 206);
    g.fillStyle = T.mute; g.font = '15px CardSans, CardEmoji'; g.fillText(`${t.icon} ${t.label}`, x + tw / 2, 232);
  });
  g.textAlign = 'left';
  if (rank === 1) { g.fillStyle = T.text; g.font = '18px CardSansBold, CardEmoji'; g.fillText('👑 En tête du classement !', x0, 292); }
  else if (rank) {
    const bw = W - 36 - x0, pct = Math.max(0.04, Math.min(1, count / (count + gap)));
    rr(x0, 276, bw, 14, 7, 'rgba(255,255,255,0.12)'); rr(x0, 276, bw * pct, 14, 7, T.accent);
    g.fillStyle = T.mute; g.font = '15px CardSans, CardEmoji'; g.fillText(`Encore ${gap} pour dépasser ${clean(above, 20)}`, x0, 314);
  } else { g.fillStyle = T.mute; g.font = '16px CardSans, CardEmoji'; g.fillText('Partage le lien du serveur pour apparaître au classement !', x0, 300); }
  return canvas.toBuffer('image/png');
}

module.exports = { invitesCard, leaveCard, boostCard, levelUpCard, getTheme, rankCard, welcomeCard, clean, nf };
