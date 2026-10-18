// Cartes en image : carte de rang et image de bienvenue (@napi-rs/canvas, polices incluses dans fonts/).
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans.ttf'), 'CardSans');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'), 'CardSansBold');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoColorEmoji.ttf'), 'CardEmoji');
// Polices de Noël (licence libre OFL) : titre « Mountains of Christmas », texte arrondi « Fredoka »
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'MountainsOfChristmas-Bold.woff'), 'XmasTitle');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'Fredoka-SemiBold.woff'), 'XmasBody');
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

/** Calendrier de l'Avent 1100 x 1350 : nuit de Noël kawaii, Père Noël en traîneau, cadeaux pastel enneigés, bonhommes de neige et sapins. */
async function adventCard({ today, serverName, background }) {
  const W = 1100;
  const bgImg = Buffer.isBuffer(background) ? await loadImage(background).catch(() => null) : background ? await fetchImage(background) : null;
  const H = bgImg ? 1500 : 1350, canvas = createCanvas(W, H), g = canvas.getContext('2d');
  const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const GOLD = '#ffe3a1', GOLD2 = '#f6b84a', PLUM = '#5b3a6e';
  const dot = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  const ell = (x, y, rx, ry, col, rot = 0) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 7); g.fill(); };
  const glow = (x, y, r, rgb, a) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${rgb},${a})`); rg.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); };
  const sparkle = (x, y, r, col, al = 1) => { g.save(); g.globalAlpha = al; g.fillStyle = col; g.beginPath(); for (let k = 0; k < 8; k++) { const ang = (k * Math.PI) / 4, rad = k % 2 ? r * 0.28 : r; g.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); } g.closePath(); g.fill(); g.restore(); };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  const cheeks = (x, y, dx, s) => { ell(x - dx, y, 3.6 * s, 2.3 * s, 'rgba(255,120,150,0.55)'); ell(x + dx, y, 3.6 * s, 2.3 * s, 'rgba(255,120,150,0.55)'); };
  // Neige posée sur le dessus d'un objet (x = bord gauche, y = bord haut, w = largeur)
  const snowCap = (x, y, w, depth = 9) => { const n = Math.max(2, Math.round(w / 22)), sw = (w + 10) / n;
    g.fillStyle = 'rgba(120,140,200,0.35)'; g.beginPath(); g.moveTo(x - 5, y + 4); for (let k = 0; k < n; k++) g.quadraticCurveTo(x - 5 + sw * (k + 0.5), y + 4 + depth + 3 + (k % 2) * 3, x - 5 + sw * (k + 1), y + 4); g.lineTo(x + w + 5, y - 4); g.lineTo(x - 5, y - 4); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - 5, y + 2); g.quadraticCurveTo(x - 5, y - 8, x + 8, y - 8); g.lineTo(x + w - 8, y - 8); g.quadraticCurveTo(x + w + 5, y - 8, x + w + 5, y + 2);
    for (let k = n - 1; k >= 0; k--) g.quadraticCurveTo(x - 5 + sw * (k + 0.5), y + 2 + depth + (k % 2) * 3, x - 5 + sw * k, y + 2); g.closePath(); g.fill(); };

  if (bgImg) { // haut et bas de l'illustration gardés tels quels, le milieu (ciel vide) est étiré pour laisser la place aux cases
    const s = W / bgImg.width, sh = bgImg.height, tf = parseFloat(process.env.AVENT_FOND_HAUT) || 0.215, bf = parseFloat(process.env.AVENT_FOND_BAS) || 0.337;
    const topS = sh * tf, botS = sh * bf, topD = topS * s, botD = botS * s;
    g.drawImage(bgImg, 0, 0, bgImg.width, topS, 0, 0, W, topD);
    g.drawImage(bgImg, 0, topS, bgImg.width, sh - topS - botS, 0, topD, W, H - topD - botD);
    g.drawImage(bgImg, 0, sh - botS, bgImg.width, botS, 0, H - botD, W, botD); }
  else {
  // ---- Ciel pastel nuit ----
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#141b4a'); bg.addColorStop(0.45, '#3a3a8f'); bg.addColorStop(0.85, '#8a62b5'); bg.addColorStop(1, '#d7a3d3');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  glow(930, 165, 300, '255,236,190', 0.4); glow(140, 1000, 380, '255,150,200', 0.22); glow(W / 2, 650, 600, '150,170,255', 0.12);
  for (let k = 0; k < 70; k++) sparkle(rnd() * W, rnd() * 380 + 8, 2 + rnd() * 5, '#fff6d8', 0.3 + rnd() * 0.6);
  glow(930, 165, 110, '255,245,215', 0.55); dot(930, 165, 48, '#fff6dc'); for (const [dx, dy, r] of [[-15, -10, 9], [13, 15, 7], [11, -19, 5]]) dot(930 + dx, 165 + dy, r, '#f0e2bd');

  // ---- Père Noël en traîneau (ciel, sous la guirlande) ----
  const reindeer = (x, y, s, leg) => { g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = '#a9693f'; g.lineWidth = 7; g.lineCap = 'round'; for (const [dx, a] of [[-26, leg], [-12, -leg], [16, leg], [30, -leg]]) { g.beginPath(); g.moveTo(dx, 12); g.lineTo(dx + 14 + a * 6, 34 - a * 4); g.stroke(); }
    ell(0, 0, 44, 22, '#c98a57'); ell(2, 8, 30, 12, '#e8b98a'); ell(-44, -6, 8, 8, '#fff');
    g.strokeStyle = '#c98a57'; g.lineWidth = 14; g.beginPath(); g.moveTo(34, -8); g.lineTo(52, -28); g.stroke();
    ell(60, -34, 20, 17, '#c98a57', -0.2); ell(76, -30, 10, 8, '#e8b98a');
    g.strokeStyle = '#7a4a2b'; g.lineWidth = 3.5; for (const sx of [52, 66]) { g.beginPath(); g.moveTo(sx, -48); g.lineTo(sx - 4, -72); g.moveTo(sx - 2, -60); g.lineTo(sx - 12, -66); g.moveTo(sx - 4, -72); g.lineTo(sx + 4, -80); g.stroke(); }
    ell(56, -46, 5, 9, '#c98a57', -0.4); ell(67, -46, 5, 9, '#c98a57', 0.3);
    glow(86, -31, 22, '255,80,110', 0.55); dot(86, -31, 6, '#ff4d6d'); dot(62, -40, 2.4, '#3a2540'); ell(56, -31, 3.6, 2.2, 'rgba(255,120,150,0.6)'); dot(36, 0, 5, '#ffd36e');
    g.restore(); };
  const santa = (x, y, s) => { g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = GOLD2; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-70, 66); g.lineTo(78, 66); g.quadraticCurveTo(104, 66, 98, 38); g.stroke(); g.beginPath(); g.moveTo(-40, 50); g.lineTo(-40, 66); g.moveTo(40, 50); g.lineTo(40, 66); g.stroke();
    // sac de cadeaux (derrière)
    ell(-50, -8, 30, 34, '#b9d9a8'); g.fillStyle = '#f7a6c4'; rr(-68, -34, 26, 22, 4); g.fill(); g.fillStyle = '#9ad6ff'; rr(-46, -42, 24, 22, 4); g.fill(); g.fillStyle = '#fff'; g.fillRect(-57, -34, 4, 22); g.fillRect(-37, -42, 4, 22);
    // corps du Père Noël (derrière le traîneau)
    ell(20, -6, 30, 32, '#ff5d7a');
    // traîneau
    g.fillStyle = '#e8506c'; g.beginPath(); g.moveTo(-72, 8); g.lineTo(70, 8); g.quadraticCurveTo(100, 10, 98, 38); g.lineTo(80, 54); g.lineTo(-62, 54); g.quadraticCurveTo(-76, 40, -72, 8); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)'; rr(-62, 14, 130, 8, 4); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 4; g.beginPath(); g.moveTo(-60, 44); g.lineTo(78, 44); g.stroke();
    // tête : visage, barbe, nez, moustache, bonnet
    dot(20, -58, 24, '#ffd9c4'); face2(g, 20, -62, 1.1, cheeks);
    ell(20, -40, 24, 15, '#ffffff'); ell(11, -51, 9, 5.5, '#ffffff'); ell(29, -51, 9, 5.5, '#ffffff'); dot(20, -56, 4, '#ff9fb4');
    g.fillStyle = '#ff5d7a'; g.beginPath(); g.moveTo(-4, -76); g.quadraticCurveTo(14, -120, 60, -96); g.lineTo(48, -76); g.quadraticCurveTo(22, -88, -4, -76); g.fill();
    g.fillStyle = '#ffffff'; rr(-6, -86, 54, 12, 6); g.fill(); dot(60, -97, 9, '#ffffff');
    g.restore(); };
  function face2(gc, x, y, s, ch) { dot(x - 8 * s, y, 1.9 * s, '#3a2540'); dot(x + 8 * s, y, 1.9 * s, '#3a2540'); ch(x, y + 4.5 * s, 14 * s, s); }
  for (let k = 0; k < 28; k++) { const x = 18 + k * 9.4, y = 190 + Math.sin(k * 0.7) * 9 + k * 0.5; sparkle(x, y, 3 + (k % 4) * 1.5, k % 2 ? '#ffe3a1' : '#ffc2e0', 0.2 + (k / 28) * 0.6); }
  g.strokeStyle = 'rgba(255,227,161,0.7)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(408, 190); g.lineTo(468, 188); g.moveTo(560, 186); g.lineTo(612, 184); g.stroke();
  santa(330, 196, 0.82); reindeer(520, 188, 0.78, 1); reindeer(660, 180, 0.78, -1);

  // ---- Guirlande ----
  const gy = (x) => 34 + Math.sin((x / W) * Math.PI * 6) * 14 + 20 * Math.sin((x / W) * Math.PI);
  g.strokeStyle = '#1d4a3a'; g.lineWidth = 3; g.beginPath(); for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, gy(x)); g.stroke();
  const cols = ['#ff7a95', '#ffd36e', '#7be3b2', '#8cd3ff', '#ffa8e0'];
  for (let k = 0, x = 22; x < W; x += 52, k++) { const y = gy(x) + 10, col = cols[k % cols.length];
    const rg = g.createRadialGradient(x, y + 6, 0, x, y + 6, 32); rg.addColorStop(0, col + 'aa'); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(x - 32, y - 26, 64, 64);
    g.fillStyle = '#1d4a3a'; g.fillRect(x - 3, y - 6, 6, 8); ell(x, y + 8, 6.5, 9, col); ell(x - 2, y + 5, 1.8, 3, 'rgba(255,255,255,0.7)'); }

  }
  // ---- Titre ----
  g.textAlign = 'center';
  const bx = W / 2 - 230, by = 290, bw = 460, bh = 40;
  g.fillStyle = '#f0607f'; g.beginPath(); g.moveTo(bx - 34, by + 6); g.lineTo(bx + 10, by + 6); g.lineTo(bx + 10, by + bh + 6); g.lineTo(bx - 34, by + bh + 6); g.lineTo(bx - 20, by + bh / 2 + 6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(bx + bw + 34, by + 6); g.lineTo(bx + bw - 10, by + 6); g.lineTo(bx + bw - 10, by + bh + 6); g.lineTo(bx + bw + 34, by + bh + 6); g.lineTo(bx + bw + 20, by + bh / 2 + 6); g.closePath(); g.fill();
  g.fillStyle = '#c94a69'; g.beginPath(); g.moveTo(bx + 10, by + bh + 6); g.lineTo(bx + 10, by + bh + 14); g.lineTo(bx + 24, by + bh + 6); g.fill(); g.beginPath(); g.moveTo(bx + bw - 10, by + bh + 6); g.lineTo(bx + bw - 10, by + bh + 14); g.lineTo(bx + bw - 24, by + bh + 6); g.fill();
  const rb = g.createLinearGradient(0, by, 0, by + bh); rb.addColorStop(0, '#ff8aa3'); rb.addColorStop(1, '#ee5a7b'); g.fillStyle = rb; rr(bx, by, bw, bh, 8); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.6; g.setLineDash([6, 5]); rr(bx + 5, by + 5, bw - 10, bh - 10, 5); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.font = '33px XmasTitle, CardEmoji'; g.fillText('Calendrier de l\'Avent', W / 2, by + 30);
  const name = clean(names.serverName(serverName), 24), ny = bgImg ? 427 : 424;
  g.font = '104px XmasTitle, CardEmoji'; g.lineJoin = 'round';
  g.strokeStyle = '#d8456a'; g.lineWidth = 16; g.strokeText(name, W / 2, ny); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeText(name, W / 2, ny);
  const tg = g.createLinearGradient(0, ny - 62, 0, ny + 8); tg.addColorStop(0, '#fff7e0'); tg.addColorStop(1, '#ffd2e0'); g.fillStyle = tg; g.fillText(name, W / 2, ny);
  const tw = g.measureText(name).width;
  const holly = (x, y, s, fl) => { g.save(); g.translate(x, y); g.scale(fl * s, s);
    for (const rot of [-0.45, 0.45]) { g.save(); g.rotate(rot); const lg = g.createLinearGradient(0, -8, 0, 8); lg.addColorStop(0, '#67d68f'); lg.addColorStop(1, '#2f9c63'); g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(26, -22, 54, 0); g.quadraticCurveTo(26, 22, 0, 0); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(4, 0); g.lineTo(46, 0); g.stroke(); g.restore(); }
    for (const [dx, dy] of [[-4, -6], [6, 4], [-6, 8]]) { dot(dx, dy, 8, '#ff4d6d'); dot(dx - 2.5, dy - 2.5, 2.4, 'rgba(255,255,255,0.85)'); } g.restore(); };
  holly(W / 2 - tw / 2 - 90, ny - 28, 1, -1); holly(W / 2 + tw / 2 + 90, ny - 28, 1, 1);
  const lg = g.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0); lg.addColorStop(0, 'rgba(255,227,161,0)'); lg.addColorStop(0.5, GOLD); lg.addColorStop(1, 'rgba(255,227,161,0)');
  g.strokeStyle = lg; g.lineWidth = 2; g.beginPath(); const fy = ny + 22; g.moveTo(W / 2 - 250, fy); g.lineTo(W / 2 + 250, fy); g.stroke(); sparkle(W / 2, fy, 11, GOLD); sparkle(W / 2 - 34, fy, 5, GOLD, 0.9); sparkle(W / 2 + 34, fy, 5, GOLD, 0.9);

  // ---- Panneau ----
  const COLS = bgImg ? 8 : 6, GW = bgImg ? 112 : 146, GH = bgImg ? 96 : 100, GX = bgImg ? 14 : 22, GYP = bgImg ? 54 : 56, ROWS = 24 / COLS;
  const px = 50, py = bgImg ? 478 : 470, pw = W - 100, ph = (bgImg ? 62 : 66) + ROWS * GH + (ROWS - 1) * GYP + (bgImg ? 66 : 70);
  g.fillStyle = 'rgba(40,30,90,0.42)'; rr(px, py, pw, ph, 36); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2.5; rr(px, py, pw, ph, 36); g.stroke();
  snowCap(px + 36, py + 2, pw - 72, 12);

  // ---- Cases : paquets cadeaux pastel enneigés ----
  const bow = (cx, cy, s, col, edge) => { for (const sg of [-1, 1]) { g.save(); g.translate(cx, cy); g.rotate(sg * 0.5); ell(sg * s * 0.9, -s * 0.2, s * 0.95, s * 0.55, col); g.strokeStyle = edge; g.lineWidth = 1.8; g.beginPath(); g.ellipse(sg * s * 0.9, -s * 0.2, s * 0.95, s * 0.55, 0, 0, 7); g.stroke(); g.restore(); }
    dot(cx, cy, s * 0.42, col); g.strokeStyle = edge; g.lineWidth = 1.8; g.beginPath(); g.arc(cx, cy, s * 0.42, 0, 7); g.stroke(); };
  const PAL = [['#ffd6e5', '#ff9ec3', '#ff7fae'], ['#d6f7e8', '#8fe0bd', '#4fcf9b'], ['#e6dcff', '#b9a4ff', '#9a80ff'], ['#d6ecff', '#8cc9ff', '#5bb0ff'], ['#ffe6d4', '#ffb88f', '#ff9560'], ['#fff5c8', '#ffe070', '#ffc83c']];
  const gw = GW, gh = GH, gx = GX, gyp = GYP, cols6 = COLS, x0 = px + (pw - (cols6 * gw + (cols6 - 1) * gx)) / 2, y0 = py + (bgImg ? 62 : 66);
  for (let d = 1; d <= 24; d++) {
    const x = x0 + ((d - 1) % cols6) * (gw + gx), y = y0 + Math.floor((d - 1) / cols6) * (gh + gyp);
    const past = d < today, now = d === today, [c1, c2, c3] = PAL[(d * 5 + Math.floor((d - 1) / 6)) % 6];
    if (now) glow(x + gw / 2, y + gh / 2, 150, '255,230,150', 0.6);
    g.save(); if (past) g.globalAlpha = 0.9;
    g.shadowColor = 'rgba(30,20,80,0.45)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
    const gr = g.createLinearGradient(x, y, x, y + gh);
    if (now) { gr.addColorStop(0, '#fff6c8'); gr.addColorStop(1, '#ffd25e'); } else { gr.addColorStop(0, c1); gr.addColorStop(1, c2); }
    g.fillStyle = gr; rr(x, y, gw, gh, 16); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.fillStyle = now ? '#ff6b86' : 'rgba(255,255,255,0.92)'; g.fillRect(x + gw / 2 - 9, y, 18, gh); g.fillRect(x, y + gh / 2 - 8, gw, 16);
    g.strokeStyle = now ? '#fffbe0' : 'rgba(255,255,255,0.85)'; g.lineWidth = now ? 4 : 2.5; rr(x, y, gw, gh, 16); g.stroke();
    for (let k = 0; k < 4; k++) dot(x + 14 + ((d * 37 + k * 41) % (gw - 28)), y + 24 + ((d * 17 + k * 23) % (gh - 34)), 1.6, 'rgba(255,255,255,0.75)');
    snowCap(x + 6, y, gw - 12, 7 + (d % 3) * 2);
    bow(x + gw / 2, y - 9, 16, now ? '#ff6b86' : c3, 'rgba(255,255,255,0.95)');
    g.restore();
    const cx = x + gw / 2, cy = y + gh / 2 + 8;
    g.save(); if (past) g.globalAlpha = 0.85;
    const bg2 = g.createRadialGradient(cx - 6, cy - 8, 2, cx, cy, 28); bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(1, '#ffeedd');
    g.fillStyle = bg2; g.beginPath(); g.arc(cx, cy, 27, 0, 7); g.fill(); g.strokeStyle = now ? '#ff6b86' : c3; g.lineWidth = 3; g.stroke();
    g.fillStyle = now ? '#c43456' : PLUM; g.font = `${d > 9 ? 27 : 31}px XmasBody, CardEmoji`; g.textBaseline = 'middle'; g.fillText(String(d), cx, cy + 1); g.textBaseline = 'alphabetic'; g.restore();
    if (past) { g.font = '18px CardEmoji'; g.fillStyle = '#ffffff'; g.fillText('✨', x + gw - 17, y + gh - 8); }
    if (now) { sparkle(x - 8, y + 16, 11, '#fffbe0'); sparkle(x + gw + 9, y + 30, 9, '#fffbe0'); sparkle(x + gw - 4, y + gh + 6, 7, '#fffbe0', 0.9);
      g.fillStyle = '#ff6b86'; rr(cx - 62, y + gh + 8, 124, 24, 12); g.fill(); g.fillStyle = '#fff'; g.font = '15px XmasBody, CardEmoji'; g.fillText('AUJOURD’HUI', cx, y + gh + 25); }
  }
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = '23px XmasBody, CardEmoji';
  g.fillText(today <= 0 ? 'Les cases ouvrent à partir du 1er décembre' : today >= 25 ? 'Joyeux Noël à tous !' : 'Une surprise t’attend chaque jour : clique sur le bouton du jour', W / 2, py + ph - 24);

  if (!bgImg) {
  // ---- Décor du bas (sous le panneau) ----
  const tree = (x, base, h, col1, col2, deco) => { for (let t = 0; t < 3; t++) { const w = h * (0.42 - t * 0.08), top = base - h + t * h * 0.27; const tg2 = g.createLinearGradient(0, top, 0, top + h * 0.4); tg2.addColorStop(0, col1); tg2.addColorStop(1, col2);
      g.fillStyle = tg2; g.beginPath(); g.moveTo(x, top); g.lineTo(x - w, top + h * 0.38); g.lineTo(x + w, top + h * 0.38); g.closePath(); g.fill(); if (deco) snowCap(x - w * 0.55, top + h * 0.2, w * 1.1, 6); }
    g.fillStyle = '#8a5a3c'; g.fillRect(x - 5, base - h * 0.08, 10, h * 0.1);
    if (deco) { sparkle(x, base - h - 4, 11, '#ffe27a'); for (const [dx, dy, col] of [[-12, -h * 0.55, '#ff7a95'], [14, -h * 0.4, '#8cd3ff'], [-18, -h * 0.28, '#ffd36e'], [8, -h * 0.7, '#ffa8e0'], [20, -h * 0.2, '#ff7a95']]) dot(x + dx, base + dy, 3.6, col); } };
  const mini = (x, y, w, h, col, rib) => { g.fillStyle = col; rr(x, y, w, h, 6); g.fill(); g.fillStyle = rib; g.fillRect(x + w / 2 - 4, y, 8, h); g.fillRect(x, y + h / 2 - 4, w, 8); snowCap(x + 3, y, w - 6, 4); bow(x + w / 2, y - 7, 8, rib === '#ffffff' ? '#ff9ec3' : rib, 'rgba(255,255,255,0.9)'); };
  const snowman = (x, base, s) => { g.save(); g.translate(x, base); g.scale(s, s);
    const ball = (cx, cy, r) => { const rg = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 2, cx, cy, r); rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#cfdcff'); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };
    g.strokeStyle = '#8a5a3c'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-36, -62); g.lineTo(-66, -80); g.moveTo(-56, -74); g.lineTo(-60, -90); g.moveTo(36, -62); g.lineTo(66, -80); g.moveTo(56, -74); g.lineTo(60, -90); g.stroke();
    ball(0, -34, 40); ball(0, -92, 31);
    // chapeau
    g.save(); g.translate(0, -118); g.rotate(-0.08); g.fillStyle = '#3a2f6b'; rr(-20, -34, 40, 34, 6); g.fill(); g.fillStyle = '#ff6b86'; g.fillRect(-20, -10, 40, 7); g.fillStyle = '#3a2f6b'; rr(-32, -4, 64, 10, 5); g.fill(); g.restore();
    // visage : yeux, joues, nez entre les yeux, sourire en dessous
    dot(-10, -99, 2.6, '#3a2540'); dot(10, -99, 2.6, '#3a2540'); ell(-19, -90, 4.4, 2.8, 'rgba(255,120,150,0.55)'); ell(19, -90, 4.4, 2.8, 'rgba(255,120,150,0.55)');
    g.fillStyle = '#ff9a4d'; g.beginPath(); g.moveTo(-4.5, -93); g.quadraticCurveTo(0, -90, 4.5, -93); g.quadraticCurveTo(0, -84, -4.5, -93); g.fill();
    g.strokeStyle = '#3a2540'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, -86, 5.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    // écharpe + boutons
    g.fillStyle = '#ff6b86'; rr(-27, -68, 54, 12, 6); g.fill(); g.beginPath(); g.moveTo(8, -58); g.lineTo(24, -28); g.lineTo(12, -28); g.lineTo(0, -56); g.fill();
    for (const y of [-42, -22, -4]) dot(-6, y, 3.4, '#5b3a6e'); g.restore(); };
  const base = 1308;
  for (const [x, h] of [[24, 100], [128, 86], [338, 86], [770, 86], [986, 94], [1078, 100]]) tree(x, base - 4, h, '#4fae8b', '#2c7a66', false);
  for (const [x, h] of [[72, 124], [296, 110], [812, 110], [1036, 122]]) tree(x, base + 2, h, '#62c9a0', '#2f8a74', true);
  snowman(190, base + 4, 0.8); snowman(912, base + 4, 0.8);
  mini(452, base - 30, 46, 36, '#ffd6e5', '#ffffff'); mini(508, base - 22, 34, 28, '#d6ecff', '#ffffff'); mini(552, base - 36, 42, 40, '#fff5c8', '#ff9ec3'); mini(604, base - 24, 36, 30, '#e6dcff', '#ffffff');
  g.fillStyle = '#f4f7ff'; g.beginPath(); g.moveTo(0, base); for (let x = 0; x <= W; x += 20) g.lineTo(x, base - 2 + Math.sin(x / 55) * 5); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  for (let k = 0; k < 110; k++) { const x = rnd() * W, y = rnd() * H, r = 1 + rnd() * 3.4; g.globalAlpha = 0.3 + rnd() * 0.6; dot(x, y, r, '#ffffff'); }
  g.globalAlpha = 1;
  }
  return canvas.toBuffer('image/png');
}

module.exports = { adventCard, invitesCard, leaveCard, boostCard, levelUpCard, getTheme, rankCard, welcomeCard, clean, nf };
