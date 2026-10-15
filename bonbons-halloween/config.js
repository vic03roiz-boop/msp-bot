// Réglages du système bonbons / citrouilles.
// Tout se règle par variables d'environnement (Railway > Variables) ou directement ici.
const env = process.env;

module.exports = {
  // --- À REMPLIR (IDs Discord : clic droit > Copier l'identifiant, mode développeur activé) ---
  guildId: env.GUILD_ID || '',
  niveauxChannelId: env.NIVEAUX_CHANNEL_ID || '1508797397864812584', // salon des niveaux : toutes les annonces y vont
  ticketCategoryId: env.TICKET_CATEGORY_ID || '', // facultatif : sinon on reprend la catégorie de tes tickets
  staffRoleIds: (env.STAFF_ROLE_ID || '').split(',').map((s) => s.trim()).filter(Boolean), // facultatif : sinon on reprend les rôles staff de tes tickets
  excludedChannelIds: (env.EXCLUDED_CHANNEL_IDS || '1508832964404842737,1516128446177345829,1509260987440566383,1508948870657478696,1508800051995086939,1508833734408011806,1508833821058142260,1508912867431419914,1508800086770188348,1508931942022643924,1508800107410362438,1508800132005630003,1508800521199161415,1518616431510425711,1510351571765170406,1510362792530546868,1508800213278527579,1508854429669920799,1508800350935842856,1508800391519928330,1509232567663071303,1529156272602222662').split(',').map((s) => s.trim()).filter(Boolean), // spam, commandes...

  // --- Apparence ---
  // Pour un emoji perso : EMOJI_CITROUILLE="<:citrouille:123456789012345678>"
  emoji: {
    citrouille: env.EMOJI_CITROUILLE || '<:citrouille:1560366094303232033>',
    bonbon: env.EMOJI_BONBON || '<:bonbon:1560366139740004432>',
  },
  pumpkinImage: env.PUMPKIN_IMAGE_URL || '', // lien d'une image de citrouille (facultatif)
  theme: env.THEME || 'halloween', // 'halloween' puis 'automne' après le 31 octobre (voir theme.js)

  // --- Calendrier ---
  timezone: 'Europe/Paris',
  eventStart: env.EVENT_START || '2026-10-17', // premier jour (inclus) : samedi 17 octobre
  eventEnd: env.EVENT_END || '2026-11-30', // dernier jour (inclus) = 45 jours

  // --- Économie ---
  bonbonsParCitrouille: 150,
  bonbonsParAutographe: 5,
  autographesMax: 100, // par membre, pour l'échange des bonbons restants
  dailyCap: 100, // plafond des missions du jour
  totalCap: 12000, // plafond de sécurité des gains automatiques par membre
  petiteRoueEnBoutique: false, // false = la petite roue n'est que dans les paliers (palier 8 = 350). true = aussi en boutique à 3 citrouilles
  parrainMax: 8,
  parrainBonbons: 150,
  boostBonbons: 500,
  giveawayBonbons: 50,
  giveawayMax: 10,
  succesBonbons: 100,

  // --- Anti-abus ---
  announceWindowMs: 10 * 60 * 1000, // 1 message d'annonce par membre toutes les 10 minutes
  minMsgChars: 5,
  msgGapMs: 30 * 1000,
  referralMinDays: 7,
  referralMinMessages: 50,
  referralMinAccountDays: 30,

  // --- Missions ---
  daily: [
    { id: 'connexion', label: 'connexion du jour', amount: 10 },
    { id: 'msg1', label: '25 messages', amount: 10 },
    { id: 'msg2', label: '75 messages', amount: 15 },
    { id: 'msg3', label: '150 messages', amount: 25 },
    { id: 'voc1', label: '20 min en vocal', amount: 10 },
    { id: 'voc2', label: '60 min en vocal', amount: 15 },
    { id: 'jeu', label: 'mini-jeu ou drop', amount: 15 },
  ],
  dailyValidateAt: 3, // un jour est validé à partir de 3 missions faites
  streaks: [[3, 50], [7, 100], [14, 250], [30, 450], ['all', 750]], // [jours d'affilée, bonbons] ; 'all' = tous les jours de l'événement
  loyalty: [[10, 100], [20, 200], [30, 300], [40, 400]], // [jours validés au total, bonbons]
  weekly: { msgs: 600, voice: 240, perfect: 7, awards: { msgs: 80, voice: 60, perfect: 110 } },
  finalStretch: { days: 4, msgs: 300, voice: 120, perfect: 4, awards: { msgs: 60, voice: 50, perfect: 90 } },
};
