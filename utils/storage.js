const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');
const GIVEAWAYS_FILE = path.join(DATA_DIR, 'giveaways.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');

// Crée le dossier data et les fichiers s'ils n'existent pas encore
function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BLACKLIST_FILE)) fs.writeFileSync(BLACKLIST_FILE, '[]');
  if (!fs.existsSync(GIVEAWAYS_FILE)) fs.writeFileSync(GIVEAWAYS_FILE, '[]');
  if (!fs.existsSync(CONFIG_FILE)) fs.writeFileSync(CONFIG_FILE, '{}');
  if (!fs.existsSync(WARNINGS_FILE)) fs.writeFileSync(WARNINGS_FILE, '[]');
}

function readJSON(file) {
  ensureFiles();
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  ensureFiles();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  // --- Blacklist ---
  getBlacklist: () => readJSON(BLACKLIST_FILE),
  saveBlacklist: (data) => writeJSON(BLACKLIST_FILE, data),

  // --- Giveaways ---
  getGiveaways: () => readJSON(GIVEAWAYS_FILE),
  saveGiveaways: (data) => writeJSON(GIVEAWAYS_FILE, data),

  // --- Configuration (par serveur) ---
  getGuildConfig: (guildId) => {
    const allConfig = readJSON(CONFIG_FILE);
    return allConfig[guildId] || {};
  },
  saveGuildConfig: (guildId, partialConfig) => {
    const allConfig = readJSON(CONFIG_FILE);
    allConfig[guildId] = { ...(allConfig[guildId] || {}), ...partialConfig };
    writeJSON(CONFIG_FILE, allConfig);
    return allConfig[guildId];
  },

  // --- Avertissements ---
  getWarnings: () => readJSON(WARNINGS_FILE),
  saveWarnings: (data) => writeJSON(WARNINGS_FILE, data),
};
