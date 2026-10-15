// Moteur pur (aucun Discord ici) : règles des missions. Testable seul : voir test/simulate.js
const cfg = require('./config');

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKeyOf = (ms) => fmtDay.format(new Date(ms));
const dayMs = (key) => Date.parse(`${key}T00:00:00Z`);
const dayDiff = (a, b) => Math.round((dayMs(a) - dayMs(b)) / 864e5);
const addDays = (key, n) => new Date(dayMs(key) + n * 864e5).toISOString().slice(0, 10);

/** Contexte du jour, ou null si l'événement n'est pas en cours. */
function getCtx(ms = Date.now()) {
  const dayKey = dayKeyOf(ms);
  const idx = dayDiff(dayKey, cfg.eventStart);
  const total = dayDiff(cfg.eventEnd, cfg.eventStart) + 1;
  if (idx < 0 || idx >= total) return null;
  const finalStart = total - cfg.finalStretch.days;
  const weekKey = idx >= finalStart ? 'final' : `w${Math.floor(idx / 7)}`;
  return { dayKey, idx, total, weekKey, prevKey: addDays(dayKey, -1) };
}

function createUser() {
  return {
    balance: 0,
    earned: 0, // gains automatiques cumulés (hors ajout staff)
    eventEarned: 0,
    spent: 0,
    claimedPaliers: [],
    notified: [], // paliers déjà proposés
    autographes: 0, // autographes échangés (plafond)
    today: null,
    week: null,
    validatedDays: 0,
    streak: 0,
    lastValidated: null,
    streakAwards: [],
    loyaltyAwards: [],
    stats: { msgs: 0, voiceMin: 0, jeux: 0, drops: 0 },
    achievements: [],
    giveaways: [],
    referralsValidated: 0,
    boostGiven: false,
    lastMsgAt: 0,
    hist: [],
  };
}

function rollover(u, ctx) {
  if (!u.today || u.today.key !== ctx.dayKey) {
    u.today = { key: ctx.dayKey, msgs: 0, voiceMin: 0, jeu: 0, done: [], validated: false, earnedJour: 0 };
  }
  if (!u.week || u.week.key !== ctx.weekKey) {
    u.week = { key: ctx.weekKey, msgs: 0, voiceMin: 0, validatedDays: 0, done: [] };
  }
}

const DAILY_TESTS = {
  connexion: (t) => t.msgs >= 1,
  msg1: (t) => t.msgs >= 25,
  msg2: (t) => t.msgs >= 75,
  msg3: (t) => t.msgs >= 150,
  voc1: (t) => t.voiceMin >= 20,
  voc2: (t) => t.voiceMin >= 60,
  jeu: (t) => t.jeu >= 1,
};

const ACHIEVEMENTS = [
  ['first_msg', 'premier message', (u) => u.stats.msgs >= 1],
  ['first_voice', 'premier vocal', (u) => u.stats.voiceMin >= 1],
  ['first_jeu', 'première partie de mini-jeu', (u) => u.stats.jeux >= 1],
  ['first_drop', 'premier drop attrapé', (u) => u.stats.drops >= 1],
  ['first_giveaway', 'première participation à un giveaway', (u) => u.giveaways.length >= 1],
  ['first_parrain', 'premier parrainage validé', (u) => u.referralsValidated >= 1],
  ['msgs1000', '1 000 messages cumulés', (u) => u.stats.msgs >= 1000],
  ['msgs3000', '3 000 messages cumulés', (u) => u.stats.msgs >= 3000],
  ['voice20h', '20 h de vocal cumulées', (u) => u.stats.voiceMin >= 1200],
  ['voice50h', '50 h de vocal cumulées', (u) => u.stats.voiceMin >= 3000],
];

function evalAchievements(u, gains) {
  for (const [id, label, test] of ACHIEVEMENTS) {
    if (!u.achievements.includes(id) && test(u)) {
      u.achievements.push(id);
      gains.push({ amount: cfg.succesBonbons, reason: `succès : ${label}`, category: 'succes' });
    }
  }
}

function evalDaily(u, ctx, gains) {
  rollover(u, ctx);
  for (const m of cfg.daily) {
    if (!u.today.done.includes(m.id) && DAILY_TESTS[m.id](u.today)) {
      u.today.done.push(m.id);
      gains.push({ amount: m.amount, reason: `mission : ${m.label}`, category: 'jour' });
    }
  }
  if (!u.today.validated && u.today.done.length >= cfg.dailyValidateAt) {
    u.today.validated = true;
    u.validatedDays += 1;
    u.week.validatedDays += 1;
    u.streak = u.lastValidated === ctx.prevKey ? u.streak + 1 : 1;
    u.lastValidated = ctx.dayKey;
    for (const [days, amount] of cfg.streaks) {
      if (u.streak >= days && !u.streakAwards.includes(days)) {
        u.streakAwards.push(days);
        gains.push({ amount, reason: `série de ${days} jours`, category: 'serie' });
      }
    }
    for (const [days, amount] of cfg.loyalty) {
      if (u.validatedDays >= days && !u.loyaltyAwards.includes(days)) {
        u.loyaltyAwards.push(days);
        gains.push({ amount, reason: `fidélité de ${days} jours`, category: 'fidelite' });
      }
    }
  }
}

function evalWeekly(u, ctx, gains) {
  const w = ctx.weekKey === 'final' ? cfg.finalStretch : cfg.weekly;
  const tag = ctx.weekKey === 'final' ? 'dernière ligne droite' : 'semaine';
  const checks = [
    ['msgs', u.week.msgs >= w.msgs, `${tag} : ${w.msgs} messages`],
    ['voice', u.week.voiceMin >= w.voice, `${tag} : ${Math.round(w.voice / 60 * 10) / 10} h de vocal`],
    ['perfect', u.week.validatedDays >= w.perfect, `${tag} parfaite : ${w.perfect} jours validés`],
  ];
  for (const [id, ok, label] of checks) {
    if (ok && !u.week.done.includes(id)) {
      u.week.done.push(id);
      gains.push({ amount: w.awards[id], reason: label, category: 'semaine' });
    }
  }
}

function evaluate(u, ctx) {
  const gains = [];
  evalDaily(u, ctx, gains);
  evalWeekly(u, ctx, gains);
  evalAchievements(u, gains);
  return gains;
}

/** Un message de membre. Renvoie la liste des gains. */
function onMessage(u, nowMs, length, ctx) {
  if (!ctx || length < cfg.minMsgChars) return [];
  if (nowMs - u.lastMsgAt < cfg.msgGapMs) return [];
  u.lastMsgAt = nowMs;
  rollover(u, ctx);
  u.today.msgs += 1;
  u.week.msgs += 1;
  u.stats.msgs += 1;
  return evaluate(u, ctx);
}

/** Une minute passée en vocal (salon éligible). */
function onVoiceMinute(u, ctx) {
  if (!ctx) return [];
  rollover(u, ctx);
  u.today.voiceMin += 1;
  u.week.voiceMin += 1;
  u.stats.voiceMin += 1;
  return evaluate(u, ctx);
}

/** kind = 'jeu' (partie de mini-jeu finie) ou 'drop' (drop attrapé). */
function onGame(u, kind, ctx) {
  if (!ctx) return [];
  rollover(u, ctx);
  u.today.jeu += 1;
  if (kind === 'drop') u.stats.drops += 1;
  else u.stats.jeux += 1;
  return evaluate(u, ctx);
}

function onReferralValidated(u, ctx) {
  if (!ctx || u.referralsValidated >= cfg.parrainMax) return [];
  u.referralsValidated += 1;
  const gains = [{ amount: cfg.parrainBonbons, reason: 'parrainage : un filleul est resté actif', category: 'parrainage' }];
  evalAchievements(u, gains);
  return gains;
}

function onBoost(u, ctx) {
  if (!ctx || u.boostGiven) return [];
  u.boostGiven = true;
  return [{ amount: cfg.boostBonbons, reason: 'boost du serveur', category: 'boost' }];
}

function onGiveaway(u, giveawayId, ctx) {
  if (!ctx || u.giveaways.length >= cfg.giveawayMax || u.giveaways.includes(giveawayId)) return [];
  u.giveaways.push(giveawayId);
  const gains = [{ amount: cfg.giveawayBonbons, reason: 'participation à un giveaway', category: 'giveaway' }];
  evalAchievements(u, gains);
  return gains;
}

module.exports = { getCtx, createUser, onMessage, onVoiceMinute, onGame, onReferralValidated, onBoost, onGiveaway, dayKeyOf, addDays, dayDiff };
