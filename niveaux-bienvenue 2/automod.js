// Automodération : invitations Discord, liens, mots interdits, MAJUSCULES, spam de mentions, anti-raid.
// Chaque infraction : message supprimé + petit rappel (qui disparaît seul) + avertissement noté dans /historique (et sourdine auto si MOD_SEUIL_MUTE est réglé).
// Le staff (permission « Gérer les messages ») n’est jamais touché. Le spam de messages trop rapides reste géré par l’anti-spam existant.
//   /automod voir                          état de toutes les règles
//   /automod regle règle on|off            activer / couper une règle
//   /automod parametre nom valeur          régler les seuils (majuscules, mentions, anti-raid…)
//   /automod mot-ajouter mots              ajouter un ou plusieurs mots interdits (séparés par une virgule)
//   /automod mot-retirer mot  ·  /automod mots-liste
//   /automod lien-autoriser domaine  ·  /automod lien-retirer domaine
//   /automod exempter [salon] [role]       salon ou rôle ignoré par l’automod (re-taper pour annuler)
//   /automod raid-fin                      terminer le mode anti-raid
// Variable facultative : AUTOMOD_ALERT_ROLE_ID (rôle mentionné quand un raid est détecté)
const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, Events } = require('discord.js');

const EPHEMERAL = 64;
const DIR = process.env.DATA_DIR || (fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, 'data'));
const FILE = path.join(DIR, 'automod.json');
const GUILD = () => process.env.GUILD_ID || '';

const DEFAUT = {
  rules: { invitations: true, liens: false, mots: true, majuscules: true, mentions: true, raid: true },
  params: { maj_pourcent: 70, maj_min: 12, mentions_max: 5, raid_arrivees: 5, raid_secondes: 10, raid_minutes: 10 },
  raidAction: 'alerte', // alerte | sourdine | expulsion
  mots: [],
  liensOk: ['tenor.com', 'giphy.com', 'youtube.com', 'youtu.be', 'discord.com', 'cdn.discordapp.com', 'media.discordapp.net', 'twitch.tv', 'instagram.com', 'tiktok.com'],
  ignoreChannels: [], ignoreRoles: [],
};
let cfg = JSON.parse(JSON.stringify(DEFAUT));
try { const d = JSON.parse(fs.readFileSync(FILE, 'utf8')); cfg = { ...cfg, ...d, rules: { ...cfg.rules, ...d.rules }, params: { ...cfg.params, ...d.params } }; } catch {}
function save() { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(cfg)); } catch (e) { console.error('[automod] sauvegarde', e.message); } }

const REGLES = { invitations: 'Invitations Discord', liens: 'Liens (hors domaines autorisés)', mots: 'Mots interdits', majuscules: 'Messages en majuscules', mentions: 'Spam de mentions', raid: 'Anti-raid' };
const PARAMS = {
  maj_pourcent: ['Majuscules : % de lettres en majuscules qui déclenche la règle', 40, 100],
  maj_min: ['Majuscules : longueur minimale du message (en lettres)', 5, 200],
  mentions_max: ['Mentions : nombre maximum par message', 2, 30],
  raid_arrivees: ['Anti-raid : nombre d’arrivées qui déclenche l’alerte', 3, 50],
  raid_secondes: ['Anti-raid : …en combien de secondes', 3, 120],
  raid_minutes: ['Anti-raid : durée du mode raid (minutes)', 1, 120],
};
const perm = PermissionFlagsBits.ManageGuild;
const defs = [
  new SlashCommandBuilder().setName('automod').setDescription('(Staff) Régler l’automodération').setDefaultMemberPermissions(perm)
    .addSubcommand((s) => s.setName('voir').setDescription('Voir l’état de toutes les règles'))
    .addSubcommand((s) => s.setName('regle').setDescription('Activer ou couper une règle')
      .addStringOption((o) => o.setName('regle').setDescription('Quelle règle').setRequired(true).addChoices(...Object.entries(REGLES).map(([v, n]) => ({ name: n, value: v }))))
      .addStringOption((o) => o.setName('etat').setDescription('Activer ou couper').setRequired(true).addChoices({ name: 'Activer', value: 'on' }, { name: 'Couper', value: 'off' })))
    .addSubcommand((s) => s.setName('parametre').setDescription('Régler un seuil')
      .addStringOption((o) => o.setName('nom').setDescription('Quel réglage').setRequired(true).addChoices(...Object.entries(PARAMS).map(([v, p]) => ({ name: p[0].slice(0, 100), value: v }))))
      .addIntegerOption((o) => o.setName('valeur').setDescription('Nouvelle valeur').setRequired(true).setMinValue(1).setMaxValue(200)))
    .addSubcommand((s) => s.setName('raid-action').setDescription('Que faire des nouveaux arrivants pendant un raid ?')
      .addStringOption((o) => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name: 'Alerter le staff seulement', value: 'alerte' }, { name: 'Alerter + mettre les nouveaux en sourdine (30 min)', value: 'sourdine' }, { name: 'Alerter + expulser les nouveaux', value: 'expulsion' })))
    .addSubcommand((s) => s.setName('mot-ajouter').setDescription('Ajouter des mots interdits (séparés par une virgule)')
      .addStringOption((o) => o.setName('mots').setDescription('ex : mot1, mot2').setRequired(true)))
    .addSubcommand((s) => s.setName('mot-retirer').setDescription('Retirer un mot interdit')
      .addStringOption((o) => o.setName('mot').setDescription('Le mot').setRequired(true)))
    .addSubcommand((s) => s.setName('mots-liste').setDescription('Voir les mots interdits'))
    .addSubcommand((s) => s.setName('lien-autoriser').setDescription('Autoriser un domaine (ex : youtube.com)')
      .addStringOption((o) => o.setName('domaine').setDescription('Domaine').setRequired(true)))
    .addSubcommand((s) => s.setName('lien-retirer').setDescription('Retirer un domaine autorisé')
      .addStringOption((o) => o.setName('domaine').setDescription('Domaine').setRequired(true)))
    .addSubcommand((s) => s.setName('exempter').setDescription('Salon ou rôle ignoré par l’automod (re-taper pour annuler)')
      .addChannelOption((o) => o.setName('salon').setDescription('Salon exempté'))
      .addRoleOption((o) => o.setName('role').setDescription('Rôle exempté')))
    .addSubcommand((s) => s.setName('raid-fin').setDescription('Terminer le mode anti-raid maintenant')),
];
const NAMES = defs.map((d) => d.name);

// ---------- détection ----------
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[@4]/g, 'a').replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's').replace(/7/g, 't');
const collapse = (w) => w.replace(/(.)\1+/g, '$1');
function motInterdit(text) {
  if (!cfg.mots.length) return null;
  const t = norm(text), raw = t.split(/[^a-z]+/).filter(Boolean);
  // « m.e.r.d.e » / « m e r d e » : les lettres isolées qui se suivent sont recollées en un seul mot
  const words = []; let run = '';
  for (const w of raw) { if (w.length === 1) run += w; else { if (run.length >= 3) words.push(run); run = ''; words.push(w); } }
  if (run.length >= 3) words.push(run);
  const phrase = ' ' + words.join(' ') + ' ', phraseC = ' ' + words.map(collapse).join(' ') + ' ';
  for (const rawW of cfg.mots) {
    const m = norm(rawW).replace(/[^a-z ]/g, '').trim(); if (!m) continue;
    if (phrase.includes(' ' + m + ' ') || phraseC.includes(' ' + collapse(m) + ' ')) return rawW; // mot entier, avec lettres répétées tolérées (« meeerde »)
  }
  return null;
}
const INVITE_RE = /(?:discord\.gg|discord(?:app)?\.com\/invite|dsc\.gg|invite\.gg|discord\.me)\/([\w-]+)/gi;
const URL_RE = /\bhttps?:\/\/[^\s<>]+|\bwww\.[^\s<>]+/gi;
const invCache = { at: 0, codes: new Set() };
async function codesDuServeur(guild) {
  if (Date.now() - invCache.at < 5 * 60 * 1000) return invCache.codes;
  invCache.at = Date.now();
  try { const inv = await guild.invites.fetch(); invCache.codes = new Set([...inv.keys(), guild.vanityURLCode].filter(Boolean).map((c) => c.toLowerCase())); } catch {}
  return invCache.codes;
}
function hostOf(u) { try { return new URL(/^https?:/i.test(u) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
const domaineOk = (h) => cfg.liensOk.some((d) => h === d || h.endsWith('.' + d));

async function analyser(m) {
  const txt = m.content || '';
  if (cfg.rules.invitations) {
    const own = await codesDuServeur(m.guild);
    for (const x of txt.matchAll(INVITE_RE)) if (!own.has(x[1].toLowerCase())) return 'les invitations vers d’autres serveurs sont interdites ici';
  }
  if (cfg.rules.liens) {
    for (const u of txt.match(URL_RE) || []) { const h = hostOf(u); if (h && !domaineOk(h) && !/(discord\.gg|invite)/.test(h)) return 'les liens ne sont pas autorisés ici';}
  }
  if (cfg.rules.mots) { const w = motInterdit(txt); if (w) return 'langage interdit sur le serveur'; }
  if (cfg.rules.majuscules) {
    const letters = txt.replace(/<[^>]+>|https?:\/\/\S+|:\w+:/g, '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
    if (letters.length >= cfg.params.maj_min) {
      const up = letters.replace(/[^A-ZÀ-ÖØ-Þ]/g, '').length;
      if (up / letters.length * 100 >= cfg.params.maj_pourcent) return 'merci d’éviter d’écrire en majuscules';
    }
  }
  if (cfg.rules.mentions) {
    const n = new Set([...m.mentions.users.keys(), ...m.mentions.roles.keys()]).size;
    if (n > cfg.params.mentions_max) return { raison: `trop de mentions (${n})`, grave: n >= cfg.params.mentions_max * 2 };
  }
  return null;
}
function exempt(m) {
  if (!m.member || m.author.bot) return true;
  if (m.member.permissions.has(PermissionFlagsBits.ManageMessages) || m.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (cfg.ignoreChannels.includes(m.channelId) || (m.channel.parentId && cfg.ignoreChannels.includes(m.channel.parentId))) return true;
  if (cfg.ignoreRoles.some((r) => m.member.roles.cache.has(r))) return true;
  return false;
}

// ---------- commande ----------
const onoff = (b) => (b ? '🟢 activée' : '⚪ coupée');
async function run(i) {
  if (!i.memberPermissions?.has(perm)) return i.reply({ content: 'Réservé au staff.', flags: EPHEMERAL });
  const sub = i.options.getSubcommand();
  const rep = (c) => i.reply({ content: c, flags: EPHEMERAL, allowedMentions: { parse: [] } });
  if (sub === 'voir') {
    const e = new EmbedBuilder().setColor(0xC4D6C3).setTitle('🛡️ Automodération')
      .setDescription(Object.entries(REGLES).map(([k, n]) => `**${n}** : ${onoff(cfg.rules[k])}`).join('\n'))
      .addFields(
        { name: 'Seuils', value: Object.entries(PARAMS).map(([k, p]) => `${p[0]} : **${cfg.params[k]}**`).join('\n') },
        { name: 'Anti-raid : action', value: { alerte: 'alerter le staff', sourdine: 'alerter + sourdine 30 min', expulsion: 'alerter + expulser' }[cfg.raidAction], inline: true },
        { name: 'Mots interdits', value: `${cfg.mots.length} (voir /automod mots-liste)`, inline: true },
        { name: 'Domaines autorisés', value: cfg.liensOk.join(', ') || '*aucun*' },
        { name: 'Exemptions', value: [...cfg.ignoreChannels.map((x) => `<#${x}>`), ...cfg.ignoreRoles.map((x) => `<@&${x}>`)].join(' ') || '*aucune*' });
    return i.reply({ embeds: [e], flags: EPHEMERAL });
  }
  if (sub === 'regle') { const r = i.options.getString('regle'), on = i.options.getString('etat') === 'on'; cfg.rules[r] = on; save(); return rep(`${on ? '🟢' : '⚪'} **${REGLES[r]}** ${on ? 'activée' : 'coupée'}.`); }
  if (sub === 'parametre') {
    const k = i.options.getString('nom'), v = i.options.getInteger('valeur'), [lab, mn, mx] = PARAMS[k];
    if (v < mn || v > mx) return rep(`❌ Valeur entre ${mn} et ${mx}.`);
    cfg.params[k] = v; save(); return rep(`✅ ${lab} → **${v}**`);
  }
  if (sub === 'raid-action') { cfg.raidAction = i.options.getString('action'); save(); return rep(`✅ Pendant un raid : **${cfg.raidAction}**.`); }
  if (sub === 'mot-ajouter') {
    const list = i.options.getString('mots').split(',').map((x) => x.trim().toLowerCase()).filter((x) => x.length >= 2);
    let n = 0; for (const w of list) if (!cfg.mots.includes(w)) { cfg.mots.push(w); n++; }
    save(); return rep(`✅ ${n} mot(s) ajouté(s). Total : ${cfg.mots.length}. (Cette réponse est privée.)`);
  }
  if (sub === 'mot-retirer') { const w = i.options.getString('mot').trim().toLowerCase(), k = cfg.mots.indexOf(w); if (k < 0) return rep('Ce mot n’est pas dans la liste.'); cfg.mots.splice(k, 1); save(); return rep('✅ Mot retiré.'); }
  if (sub === 'mots-liste') return rep(cfg.mots.length ? `||${cfg.mots.join(', ')}||` : 'Aucun mot interdit pour l’instant. Ajoute-en avec `/automod mot-ajouter`.');
  if (sub === 'lien-autoriser') { const d = hostOf(i.options.getString('domaine')); if (!d) return rep('❌ Domaine invalide.'); if (!cfg.liensOk.includes(d)) cfg.liensOk.push(d); save(); return rep(`✅ **${d}** autorisé.`); }
  if (sub === 'lien-retirer') { const d = hostOf(i.options.getString('domaine')), k = cfg.liensOk.indexOf(d); if (k < 0) return rep('Ce domaine n’est pas dans la liste.'); cfg.liensOk.splice(k, 1); save(); return rep(`✅ **${d}** retiré.`); }
  if (sub === 'exempter') {
    const ch = i.options.getChannel('salon'), ro = i.options.getRole('role');
    if (!ch && !ro) return rep('Choisis un salon et/ou un rôle.');
    const out = [];
    for (const [x, arr, label] of [[ch, cfg.ignoreChannels, `<#${ch?.id}>`], [ro, cfg.ignoreRoles, `<@&${ro?.id}>`]]) {
      if (!x) continue; const k = arr.indexOf(x.id);
      if (k >= 0) { arr.splice(k, 1); out.push(`${label} n’est plus exempté`); } else { arr.push(x.id); out.push(`${label} est exempté`); }
    }
    save(); return rep('✅ ' + out.join(' · '));
  }
  if (sub === 'raid-fin') { raid.until = 0; return rep('✅ Mode anti-raid terminé.'); }
}

// ---------- anti-raid ----------
const raid = { joins: [], until: 0 };
async function appliquerRaid(client, member) {
  try {
    if (cfg.raidAction === 'sourdine') await member.timeout(30 * 60 * 1000, 'Anti-raid');
    else if (cfg.raidAction === 'expulsion') await member.kick('Anti-raid');
  } catch {}
}

function register(client) {
  const mod = () => require('./moderation');
  async function check(m) {
    try {
      if (!m.guild || m.guild.id !== GUILD() || m.partial && !(m = await m.fetch().catch(() => null))) return;
      if (exempt(m)) return;
      const r = await analyser(m); if (!r) return;
      const raison = typeof r === 'string' ? r : r.raison;
      await m.delete().catch(() => {});
      const n = await m.channel.send({ content: `🛡️ ${m.author}, ${raison}.`, allowedMentions: { users: [m.author.id] } }).catch(() => null);
      if (n) setTimeout(() => n.delete().catch(() => {}), 7000);
      await mod().avertirAuto(client, m.member, `Automod : ${raison}`);
      if (typeof r === 'object' && r.grave && m.member.moderatable) m.member.timeout(10 * 60 * 1000, 'Spam de mentions').catch(() => {});
    } catch (e) { console.error('[automod]', e.message); }
  }
  client.on(Events.MessageCreate, check);
  client.on(Events.MessageUpdate, (o, n) => { if (n.content !== o.content) check(n); });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      if (member.guild.id !== GUILD() || !cfg.rules.raid) return;
      const now = Date.now(), win = cfg.params.raid_secondes * 1000;
      raid.joins = raid.joins.filter((j) => now - j.t < win); raid.joins.push({ t: now, id: member.id, tag: member.user.username });
      if (now < raid.until) { await appliquerRaid(client, member); raid.joins.pop(); return; }
      if (raid.joins.length >= cfg.params.raid_arrivees) {
        raid.until = now + cfg.params.raid_minutes * 60 * 1000;
        const vus = [...raid.joins]; raid.joins = [];
        for (const j of vus) { const mm = await member.guild.members.fetch(j.id).catch(() => null); if (mm) await appliquerRaid(client, mm); }
        const role = process.env.AUTOMOD_ALERT_ROLE_ID;
        const e = new EmbedBuilder().setColor(0xE06C75).setTitle('🚨 Raid probable détecté')
          .setDescription(`**${vus.length} arrivées en ${cfg.params.raid_secondes} secondes.**\nMode raid actif pendant ${cfg.params.raid_minutes} min (action : ${cfg.raidAction}).\n\n${vus.map((j) => `<@${j.id}> (${j.tag})`).join('\n')}\n\nPour arrêter : \`/automod raid-fin\``).setTimestamp();
        const sent = await mod().logStaff(client, e);
        if (role) { const id = process.env.MOD_LOG_CHANNEL_ID || (() => { try { return require('./logs').chanFor('moderation'); } catch {} })(); const ch = id && await client.channels.fetch(id).catch(() => null); ch?.send({ content: `<@&${role}>`, allowedMentions: { roles: [role] } }).catch(() => {}); }
      }
    } catch (e) { console.error('[automod] raid', e.message); }
  });
}
module.exports = { defs, NAMES, run, register };
