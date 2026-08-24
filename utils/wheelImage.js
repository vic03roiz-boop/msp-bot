const { createCanvas } = require('@napi-rs/canvas');
const GIFEncoder = require('gif-encoder-2');

const COLORS = ['#C4D6C3', '#A9C4A7']; // deux tons pastel vert qui alternent
const SIZE = 500;
const TOTAL_SPIN_FRAMES = 40;
const FINAL_PAUSE_FRAMES = 15; // quelques frames fixes à la fin pour bien voir le résultat

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function normalizeAngle(a) {
  const TWO_PI = Math.PI * 2;
  a = a % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a;
}

/**
 * Génère un GIF animé d'une roue de la fortune qui tourne et s'arrête sur le gagnant.
 * `labels` : liste des noms affichés sur chaque segment (dans l'ordre).
 * `winnerIndex` : index dans `labels` du segment gagnant.
 * Renvoie un Buffer (le fichier GIF).
 */
function generateWheelGif(labels, winnerIndex) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(SIZE, SIZE);
  encoder.start();
  encoder.setRepeat(-1); // joue une seule fois, s'arrête sur la dernière frame
  encoder.setDelay(80);
  encoder.setQuality(10);

  const n = labels.length;
  const sliceAngle = (Math.PI * 2) / n;
  const TWO_PI = Math.PI * 2;

  // Angle final pour que le milieu du segment gagnant soit pile sous la flèche (en haut)
  let targetRotation = -Math.PI / 2 - (winnerIndex * sliceAngle + sliceAngle / 2);
  targetRotation = normalizeAngle(targetRotation);
  const totalRotation = targetRotation + TWO_PI * 4; // + 4 tours complets pour l'effet

  function drawFrame(angle) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(SIZE / 2, SIZE / 2);
    ctx.rotate(angle);

    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SIZE / 2 - 10, i * sliceAngle, (i + 1) * sliceAngle);
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();

      const midAngle = i * sliceAngle + sliceAngle / 2;
      const worldMidAngle = normalizeAngle(midAngle + angle);
      const upsideDown = worldMidAngle > Math.PI / 2 && worldMidAngle < (3 * Math.PI) / 2;

      let label = labels[i];
      if (label.length > 14) label = label.slice(0, 13) + '…';

      ctx.save();
      ctx.rotate(midAngle);
      ctx.fillStyle = '#222222';
      ctx.font = 'bold 18px sans-serif';
      if (upsideDown) {
        ctx.rotate(Math.PI);
        ctx.textAlign = 'left';
        ctx.fillText(label, -(SIZE / 2 - 25), 6);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(label, SIZE / 2 - 25, 6);
      }
      ctx.restore();
    }
    ctx.restore();

    // Flèche pointeur fixe en haut
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(SIZE / 2 - 15, 5);
    ctx.lineTo(SIZE / 2 + 15, 5);
    ctx.lineTo(SIZE / 2, 35);
    ctx.closePath();
    ctx.fill();
  }

  for (let f = 0; f < TOTAL_SPIN_FRAMES; f++) {
    const t = f / (TOTAL_SPIN_FRAMES - 1);
    const angle = easeOutCubic(t) * totalRotation;
    drawFrame(angle);
    encoder.addFrame(ctx);
  }

  // On répète la dernière frame pour laisser le temps de voir le résultat
  for (let k = 0; k < FINAL_PAUSE_FRAMES; k++) {
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = { generateWheelGif };
