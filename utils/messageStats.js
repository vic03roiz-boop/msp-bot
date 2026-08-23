const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'messageStats.json');
const KEEP_DAYS = 35; // on ne garde le détail jour par jour que 35 jours, au-delà seul le total compte

function ensureFile() {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, '{}');
}

function readAll() {
  ensureFile();
  return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(STATS_FILE, JSON.stringify(data));
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function pruneOldDays(userStats) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const cutoffKey = dayKey(cutoff);
  for (const key of Object.keys(userStats.days)) {
    if (key < cutoffKey) delete userStats.days[key];
  }
}

function recordMessage(guildId, userId) {
  const all = readAll();
  if (!all[guildId]) all[guildId] = {};
  if (!all[guildId][userId]) all[guildId][userId] = { total: 0, days: {} };

  const userStats = all[guildId][userId];
  userStats.total += 1;
  const today = dayKey();
  userStats.days[today] = (userStats.days[today] || 0) + 1;
  pruneOldDays(userStats);

  writeAll(all);
}

function sumLastDays(userStats, nbDays) {
  let sum = 0;
  const date = new Date();
  for (let i = 0; i < nbDays; i++) {
    sum += userStats.days[dayKey(date)] || 0;
    date.setDate(date.getDate() - 1);
  }
  return sum;
}

/**
 * Renvoie { total, jour, semaine, mois } pour un membre donné.
 */
function getUserStats(guildId, userId) {
  const all = readAll();
  const userStats = all[guildId]?.[userId] || { total: 0, days: {} };
  return {
    total: userStats.total,
    jour: sumLastDays(userStats, 1),
    semaine: sumLastDays(userStats, 7),
    mois: sumLastDays(userStats, 30),
  };
}

/**
 * Renvoie un classement [{ userId, count }] trié du plus actif au moins actif,
 * pour une période donnée : 'total' | 'jour' | 'semaine' | 'mois'.
 */
function getLeaderboard(guildId, period, limit = 10) {
  const all = readAll();
  const guildStats = all[guildId] || {};

  const days = period === 'jour' ? 1 : period === 'semaine' ? 7 : period === 'mois' ? 30 : null;

  const entries = Object.entries(guildStats).map(([userId, stats]) => ({
    userId,
    count: days === null ? stats.total : sumLastDays(stats, days),
  }));

  return entries
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

module.exports = { recordMessage, getUserStats, getLeaderboard };
