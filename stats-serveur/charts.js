// Graphiques dessinés en image (PNG) avec @napi-rs/canvas. Polices incluses dans fonts/ (rien à installer sur Railway).
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans.ttf'), 'StatsSans');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'), 'StatsSansBold');

const C = { bg1: '#1b1330', bg2: '#2a1747', card: '#ffffff12', text: '#f4ecff', mute: '#b9a8d6', accent: '#ff8a2b', accent2: '#b36bff', good: '#5ee0a0', bad: '#ff6b7a', grid: '#ffffff1f' };
const W = 1000, H = 560;

/** Nettoie un pseudo pour la police (pas d'emoji ni de caractères exotiques). */
function clean(name, max = 20) {
  const s = String(name || '').replace(/[^A-Za-zÀ-ÿ0-9 _.\-!]/g, '').replace(/\s+/g, ' ').trim();
  return (s || 'membre').slice(0, max);
}
const nf = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');

function base(title, subtitle) {
  const canvas = createCanvas(W, H);
  const g = canvas.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, C.bg1); bg.addColorStop(1, C.bg2);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = C.accent; g.fillRect(40, 38, 6, 44);
  g.fillStyle = C.text; g.font = '28px StatsSansBold'; g.textBaseline = 'alphabetic';
  g.fillText(title, 60, 64);
  g.fillStyle = C.mute; g.font = '15px StatsSans';
  g.fillText(subtitle, 60, 86);
  return { canvas, g };
}
function empty(g, msg) {
  g.fillStyle = C.mute; g.font = '18px StatsSans'; g.textAlign = 'center';
  g.fillText(msg, W / 2, H / 2 + 20); g.textAlign = 'left';
}
function niceMax(v) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].find((x) => x * p >= v);
  return m * p;
}

/** Courbe du nombre de membres + arrivées/départs par jour. */
function growthChart(growth, label) {
  const { canvas, g } = base('Croissance du serveur', label);
  const pts = growth.filter((x) => x.members !== null);
  if (!pts.length) { empty(g, 'Pas encore de données : elles s’accumulent à partir d’aujourd’hui.'); return canvas.toBuffer('image/png'); }
  const L = 90, R = W - 50, T = 120, B = 370;
  const min = Math.min(...pts.map((p) => p.members)), max = Math.max(...pts.map((p) => p.members));
  const lo = Math.max(0, min - Math.max(2, Math.round((max - min) * 0.2))), hi = max + Math.max(2, Math.round((max - min) * 0.2));
  const x = (i) => (growth.length === 1 ? (L + R) / 2 : L + (i * (R - L)) / (growth.length - 1));
  const y = (v) => B - ((v - lo) / (hi - lo || 1)) * (B - T);
  g.font = '13px StatsSans'; g.fillStyle = C.mute; g.strokeStyle = C.grid; g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4, yy = y(v);
    g.beginPath(); g.moveTo(L, yy); g.lineTo(R, yy); g.stroke();
    g.textAlign = 'right'; g.fillText(nf(v), L - 10, yy + 4);
  }
  g.textAlign = 'center';
  const step = Math.max(1, Math.ceil(growth.length / 8));
  growth.forEach((p, i) => { if (i % step === 0 && (growth.length - 1 - i >= step || i === growth.length - 1) || i === growth.length - 1 && growth.length === 1) g.fillText(p.key.slice(8) + '/' + p.key.slice(5, 7), x(i), B + 22); });
  // aire + ligne
  const idx = growth.map((p, i) => (p.members !== null ? i : -1)).filter((i) => i >= 0);
  if (idx.length > 1) {
    const fill = g.createLinearGradient(0, T, 0, B);
    fill.addColorStop(0, '#ff8a2b66'); fill.addColorStop(1, '#ff8a2b00');
    g.beginPath(); g.moveTo(x(idx[0]), B);
    idx.forEach((i) => g.lineTo(x(i), y(growth[i].members)));
    g.lineTo(x(idx[idx.length - 1]), B); g.closePath(); g.fillStyle = fill; g.fill();
    g.beginPath(); idx.forEach((i, k) => (k ? g.lineTo(x(i), y(growth[i].members)) : g.moveTo(x(i), y(growth[i].members))));
    g.strokeStyle = C.accent; g.lineWidth = 3; g.stroke();
  }
  idx.forEach((i) => { g.beginPath(); g.arc(x(i), y(growth[i].members), 4, 0, Math.PI * 2); g.fillStyle = C.accent; g.fill(); });
  // arrivées / départs
  const mv = Math.max(1, ...growth.map((p) => Math.max(p.joins, p.leaves)));
  const bw = Math.max(3, Math.min(18, (R - L) / growth.length / 3));
  growth.forEach((p, i) => {
    g.fillStyle = C.good; g.fillRect(x(i) - bw, 490 - (p.joins / mv) * 60, bw, (p.joins / mv) * 60);
    g.fillStyle = C.bad; g.fillRect(x(i), 490 - (p.leaves / mv) * 60, bw, (p.leaves / mv) * 60);
  });
  g.textAlign = 'left'; g.fillStyle = C.mute; g.font = '13px StatsSans';
  g.fillText('Arrivées', L, 520); g.fillStyle = C.good; g.fillRect(L - 14, 511, 9, 9);
  g.fillStyle = C.mute; g.fillText('Départs', L + 100, 520); g.fillStyle = C.bad; g.fillRect(L + 86, 511, 9, 9);
  return canvas.toBuffer('image/png');
}

/** Barres horizontales (classement). items = [{ name, value }] */
function rankChart(title, subtitle, items, unit, color = C.accent) {
  const { canvas, g } = base(title, subtitle);
  if (!items.length) { empty(g, 'Pas encore de données.'); return canvas.toBuffer('image/png'); }
  const L = 250, R = W - 120, T = 115, rowH = Math.min(46, (H - T - 40) / items.length);
  const max = Math.max(...items.map((i) => i.value));
  items.forEach((it, i) => {
    const yy = T + i * rowH, w = Math.max(4, (it.value / max) * (R - L));
    g.fillStyle = C.mute; g.font = '16px StatsSans'; g.textAlign = 'right'; g.fillText(`${i + 1}. ${clean(it.name, 18)}`, L - 14, yy + rowH / 2 + 2);
    const grad = g.createLinearGradient(L, 0, L + w, 0);
    grad.addColorStop(0, color); grad.addColorStop(1, i === 0 ? C.accent2 : color);
    g.fillStyle = grad; g.beginPath(); g.roundRect(L, yy + 6, w, rowH - 14, 6); g.fill();
    g.fillStyle = C.text; g.font = '15px StatsSansBold'; g.textAlign = 'left'; g.fillText(`${nf(it.value)} ${unit}`, L + w + 10, yy + rowH / 2 + 2);
  });
  return canvas.toBuffer('image/png');
}

/** Heures de pointe (0 h – 23 h, heure de Paris). */
function hoursChart(hours, label) {
  const { canvas, g } = base('Heures de pointe', label);
  const total = hours.reduce((a, b) => a + b, 0);
  if (!total) { empty(g, 'Pas encore de données.'); return canvas.toBuffer('image/png'); }
  const L = 70, R = W - 40, T = 125, B = 440, max = niceMax(Math.max(...hours));
  g.font = '13px StatsSans'; g.strokeStyle = C.grid; g.fillStyle = C.mute; g.textAlign = 'right';
  for (let k = 0; k <= 4; k++) { const yy = B - (k / 4) * (B - T); g.beginPath(); g.moveTo(L, yy); g.lineTo(R, yy); g.stroke(); g.fillText(nf((max * k) / 4), L - 8, yy + 4); }
  const slot = (R - L) / 24, bw = slot * 0.65, best = hours.indexOf(Math.max(...hours));
  hours.forEach((v, h) => {
    const bh = (v / max) * (B - T), xx = L + h * slot + (slot - bw) / 2;
    g.fillStyle = h === best ? C.accent : C.accent2; g.beginPath(); g.roundRect(xx, B - bh, bw, Math.max(bh, 1), 4); g.fill();
    g.fillStyle = C.mute; g.textAlign = 'center'; if (h % 2 === 0) g.fillText(`${h}h`, xx + bw / 2, B + 22);
  });
  g.fillStyle = C.text; g.font = '17px StatsSansBold'; g.textAlign = 'left';
  g.fillText(`Pic d’activité : ${best} h – ${(best + 1) % 24} h (heure de Paris)`, L, 495);
  return canvas.toBuffer('image/png');
}

module.exports = { growthChart, rankChart, hoursChart, clean, nf };
