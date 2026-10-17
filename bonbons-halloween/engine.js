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
    perfectWeeks: 0,
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
    recentTexts: [],
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

function achievementStat(u, stat) {
  switch (stat) {
    case 'msgs': return u.stats.msgs;
    case 'voiceMin': return u.stats.voiceMin;
    case 'jeux': return u.stats.jeux;
    case 'drops': return u.stats.drops;
    case 'games': return u.stats.jeux + u.stats.drops;
    case 'giveaways': return u.giveaways.length;
    case 'referrals': return u.referralsValidated;
    case 'perfectWeeks': return u.perfectWeeks || 0;
    case 'dayMsgs': return u.today ? u.today.msgs : 0;
    case 'dayVoice': return u.today ? u.today.voiceMin : 0;
    default: return 0;
  }
}

function evalAchievements(u, gains) {
  for (const a of cfg.achievements) {
    if (!u.achievements.includes(a.id) && achievementStat(u, a.stat) >= a.need) {
      u.achievements.push(a.id);
      gains.push({ amount: a.amount, reason: `succès : ${a.label}`, category: 'succes' });
    }
  }
}

function evalDaily(u, ctx, gains) {
  rollover(u, ctx);
  for (const m of cfg.daily) {
    if (!u.today.done.includes(m.id) && u.today[m.stat] >= m.need) {
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
      const need = days === 'all' ? ctx.total : days;
      if (u.streak >= need && !u.streakAwards.includes(days)) {
        u.streakAwards.push(days);
        gains.push({ amount, reason: days === 'all' ? `série complète : ${need} jours d’affilée` : `série de ${need} jours`, category: 'serie' });
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
  const isFinal = ctx.weekKey === 'final';
  const list = isFinal ? cfg.finalStretch.missions : cfg.weekly;
  const tag = isFinal ? 'dernière ligne droite' : 'semaine';
  // une semaine plus courte (fin de l'événement) demande tous ses jours, pas 7
  const weekLen = isFinal ? cfg.finalStretch.days : Math.min(7, ctx.total - cfg.finalStretch.days - Number(ctx.weekKey.slice(1)) * 7);
  for (const m of list) {
    const have = m.stat === 'perfect' ? u.week.validatedDays : m.stat === 'msgs' ? u.week.msgs : u.week.voiceMin;
    const need = m.stat === 'perfect' ? Math.min(m.need, weekLen) : m.need;
    if (have >= need && !u.week.done.includes(m.id)) {
      u.week.done.push(m.id);
      gains.push({ amount: m.amount, reason: `${tag} : ${m.label}`, category: 'semaine' });
      if (m.stat === 'perfect' && !isFinal) u.perfectWeeks = (u.perfectWeeks || 0) + 1;
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

/** Un message de membre. text (facultatif) sert à ignorer les messages copiés-collés. */
function onMessage(u, nowMs, length, ctx, text = '') {
  if (!ctx || length < cfg.minMsgChars) return [];
  if (nowMs - u.lastMsgAt < cfg.msgGapMs) return [];
  const norm = String(text).trim().toLowerCase();
  if (norm) {
    if (!u.recentTexts) u.recentTexts = [];
    if (u.recentTexts.includes(norm)) return []; // même message qu'un des 5 derniers : ne compte pas
    u.recentTexts.push(norm);
    if (u.recentTexts.length > 5) u.recentTexts.shift();
  }
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
