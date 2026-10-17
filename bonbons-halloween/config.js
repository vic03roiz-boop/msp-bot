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
  dailyCap: 40, // plafond des missions du jour
  totalCap: 12000, // plafond de sécurité des gains automatiques par membre
  petiteRoueEnBoutique: false, // false = la petite roue n'est que dans les paliers (palier 8 = 350). true = aussi en boutique à 3 citrouilles
  parrainMax: 8,
  parrainBonbons: 150,
  boostBonbons: 500,
  giveawayBonbons: 10,
  giveawayMax: 10,

  // --- Anti-abus ---
  announceWindowMs: 10 * 60 * 1000, // 1 message d'annonce par membre toutes les 10 minutes
  minMsgChars: 5,
  msgGapMs: 30 * 1000,
  referralMinDays: 7,
  referralMinMessages: 50,
  referralMinAccountDays: 30,

  // --- Missions (version difficile : beaucoup moins de bonbons, plus de paliers, des défis très durs) ---
  // stat : msgs = messages comptés, voiceMin = minutes de vocal, jeu = mini-jeux/drops du jour
  daily: [
    { id: 'connexion', stat: 'msgs', need: 1, label: 'connexion du jour', amount: 2 },
    { id: 'msg1', stat: 'msgs', need: 50, label: '50 messages', amount: 3 },
    { id: 'msg2', stat: 'msgs', need: 150, label: '150 messages', amount: 5 },
    { id: 'msg3', stat: 'msgs', need: 300, label: '300 messages', amount: 8 },
    { id: 'voc1', stat: 'voiceMin', need: 30, label: '30 min en vocal', amount: 3 },
    { id: 'voc2', stat: 'voiceMin', need: 90, label: '1 h 30 en vocal', amount: 5 },
    { id: 'voc3', stat: 'voiceMin', need: 180, label: '3 h en vocal', amount: 8 },
    { id: 'jeu', stat: 'jeu', need: 1, label: '1 mini-jeu ou drop', amount: 3 },
    { id: 'jeu2', stat: 'jeu', need: 3, label: '3 mini-jeux ou drops', amount: 3 },
  ],
  dailyValidateAt: 6, // un jour est validé à partir de 6 missions faites (ex. 150 messages + 1 h 30 de vocal + 1 jeu)
  streaks: [[3, 10], [7, 20], [14, 50], [21, 80], [30, 150], ['all', 400]], // [jours validés d'affilée, bonbons] ; 'all' = tous les jours de l'événement
  loyalty: [[10, 20], [20, 50], [30, 100], [40, 200]], // [jours validés au total, bonbons]
  weekly: [
    { id: 'm1', stat: 'msgs', need: 1000, label: '1 000 messages', amount: 40 },
    { id: 'm2', stat: 'msgs', need: 2000, label: '2 000 messages', amount: 100 },
    { id: 'v1', stat: 'voiceMin', need: 300, label: '5 h de vocal', amount: 40 },
    { id: 'v2', stat: 'voiceMin', need: 720, label: '12 h de vocal', amount: 100 },
    { id: 'p', stat: 'perfect', need: 7, label: 'tous les jours validés', amount: 60 },
  ],
  finalStretch: {
    days: 4, // 27 → 30 novembre
    missions: [
      { id: 'm1', stat: 'msgs', need: 500, label: '500 messages', amount: 30 },
      { id: 'm2', stat: 'msgs', need: 1000, label: '1 000 messages', amount: 70 },
      { id: 'v1', stat: 'voiceMin', need: 150, label: '2 h 30 de vocal', amount: 30 },
      { id: 'v2', stat: 'voiceMin', need: 360, label: '6 h de vocal', amount: 70 },
      { id: 'p', stat: 'perfect', need: 4, label: 'les 4 jours validés', amount: 50 },
    ],
  },
  // Succès : paliers de plus en plus durs (les derniers ne seront atteints que par de très rares membres)
  achievements: [
    { id: 'first_msg', stat: 'msgs', need: 1, amount: 10, label: 'premier message' },
    { id: 'first_voice', stat: 'voiceMin', need: 1, amount: 10, label: 'premier vocal' },
    { id: 'first_jeu', stat: 'jeux', need: 1, amount: 10, label: 'première partie de mini-jeu' },
    { id: 'first_drop', stat: 'drops', need: 1, amount: 10, label: 'premier drop attrapé' },
    { id: 'first_giveaway', stat: 'giveaways', need: 1, amount: 10, label: 'premier giveaway' },
    { id: 'first_parrain', stat: 'referrals', need: 1, amount: 30, label: 'premier parrainage validé' },
    { id: 'msgs_750', stat: 'msgs', need: 750, amount: 20, label: '750 messages au total' },
    { id: 'msgs_1500', stat: 'msgs', need: 1500, amount: 40, label: '1 500 messages au total' },
    { id: 'msgs_3500', stat: 'msgs', need: 3500, amount: 90, label: '3 500 messages au total' },
    { id: 'msgs_6000', stat: 'msgs', need: 6000, amount: 170, label: '6 000 messages au total' },
    { id: 'msgs_10000', stat: 'msgs', need: 10000, amount: 300, label: '10 000 messages au total' },
    { id: 'msgs_16000', stat: 'msgs', need: 16000, amount: 500, label: '16 000 messages au total' },
    { id: 'voice_10h', stat: 'voiceMin', need: 600, amount: 20, label: '10 h de vocal au total' },
    { id: 'voice_25h', stat: 'voiceMin', need: 1500, amount: 40, label: '25 h de vocal au total' },
    { id: 'voice_50h', stat: 'voiceMin', need: 3000, amount: 90, label: '50 h de vocal au total' },
    { id: 'voice_100h', stat: 'voiceMin', need: 6000, amount: 170, label: '100 h de vocal au total' },
    { id: 'voice_150h', stat: 'voiceMin', need: 9000, amount: 300, label: '150 h de vocal au total' },
    { id: 'voice_200h', stat: 'voiceMin', need: 12000, amount: 500, label: '200 h de vocal au total' },
    { id: 'games_15', stat: 'games', need: 15, amount: 20, label: '15 jeux ou drops' },
    { id: 'games_40', stat: 'games', need: 40, amount: 60, label: '40 jeux ou drops' },
    { id: 'games_80', stat: 'games', need: 80, amount: 120, label: '80 jeux ou drops' },
    { id: 'games_120', stat: 'games', need: 120, amount: 250, label: '120 jeux ou drops' },
    { id: 'giveaways_5', stat: 'giveaways', need: 5, amount: 20, label: '5 giveaways' },
    { id: 'giveaways_10', stat: 'giveaways', need: 10, amount: 50, label: '10 giveaways' },
    { id: 'referrals_5', stat: 'referrals', need: 5, amount: 100, label: '5 parrainages validés' },
    { id: 'day_msgs_500', stat: 'dayMsgs', need: 500, amount: 750, label: '500 messages en une seule journée' },
    { id: 'day_voice_6h', stat: 'dayVoice', need: 360, amount: 750, label: '6 h de vocal en une seule journée' },
    { id: 'perfect_weeks_3', stat: 'perfectWeeks', need: 3, amount: 150, label: '3 semaines parfaites' },
    { id: 'perfect_weeks_6', stat: 'perfectWeeks', need: 6, amount: 440, label: '6 semaines parfaites' },
  ],
};
