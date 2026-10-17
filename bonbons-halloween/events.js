// Écoute Discord : messages, vocal, parrainage (invitations), boost. Tout est automatique.
const { ChannelType } = require('discord.js');
const cfg = require('./config');
const engine = require('./engine');
const store = require('./store');
const economy = require('./economy');
const runtime = require('./runtime');

const inviteUses = new Map(); // code -> uses

async function refreshInvites(guild) {
  const list = await guild.invites.fetch().catch(() => null);
  if (!list) return null;
  const before = new Map(inviteUses);
  inviteUses.clear();
  for (const inv of list.values()) inviteUses.set(inv.code, inv.uses ?? 0);
  return { list, before };
}

async function checkReferral(filleulId) {
  const r = store.db.referrals[filleulId];
  if (!r || r.validated) return;
  const f = store.user(filleulId);
  const ctx = engine.getCtx();
  if (Date.now() - r.joinedAt < cfg.referralMinDays * 864e5) return;
  if (f.stats.msgs < cfg.referralMinMessages) return;
  r.validated = true;
  store.save();
  const inviter = store.user(r.inviter);
  await economy.pushGains(r.inviter, engine.onReferralValidated(inviter, ctx));
}

function register(client) {
  // --- Messages ---
  client.on('messageCreate', async (msg) => {
    try {
      if (!msg.guild || msg.guild.id !== cfg.guildId || msg.author.bot || msg.webhookId) return;
      const ch = msg.channel;
      if (cfg.excludedChannelIds.includes(ch.id) || ch.id === cfg.niveauxChannelId) return;
      if (runtime.ticketCategoryId() && ch.parentId === runtime.ticketCategoryId()) return;
      const ctx = engine.getCtx(msg.createdTimestamp);
      const u = store.user(msg.author.id);
      const gains = engine.onMessage(u, msg.createdTimestamp, (msg.content || "").trim().length, ctx, msg.content || "");
      store.save();
      if (gains.length) await economy.pushGains(msg.author.id, gains);
      if (store.db.referrals[msg.author.id] && !store.db.referrals[msg.author.id].validated) await checkReferral(msg.author.id);
    } catch (e) {
      console.error('[bonbons] messageCreate', e);
    }
  });

  // --- Vocal : +1 minute par minute passée dans un salon éligible (>= 2 humains, hors AFK, hors sourdine) ---
  setInterval(async () => {
    try {
      const guild = client.guilds.cache.get(cfg.guildId);
      const ctx = engine.getCtx();
      if (!guild || !ctx) return;
      for (const ch of guild.channels.cache.values()) {
        if (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice) continue;
        if (ch.id === guild.afkChannelId) continue;
        const humans = ch.members.filter((m) => !m.user.bot);
        if (humans.size < 2) continue;
        for (const m of humans.values()) {
          if (m.voice.selfDeaf || m.voice.serverDeaf) continue;
          const gains = engine.onVoiceMinute(store.user(m.id), ctx);
          if (gains.length) await economy.pushGains(m.id, gains);
        }
      }
      store.save();
    } catch (e) {
      console.error('[bonbons] vocal', e);
    }
  }, 60 * 1000).unref();

  // --- Parrainage : on compare les invitations avant/après chaque arrivée ---
  client.on('inviteCreate', (inv) => inviteUses.set(inv.code, inv.uses ?? 0));
  client.on('inviteDelete', (inv) => inviteUses.delete(inv.code));
  client.on('guildMemberAdd', async (member) => {
    try {
      if (member.guild.id !== cfg.guildId || member.user.bot) return;
      const res = await refreshInvites(member.guild);
      if (!res) return;
      const used = [...res.list.values()].find((inv) => (inv.uses ?? 0) > (res.before.get(inv.code) ?? 0));
      const ctx = engine.getCtx();
      if (!used || !used.inviter || !ctx) return; // URL personnalisée ou arrivée inconnue : pas de parrain
      if (used.inviter.id === member.id || used.inviter.bot) return;
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 864e5;
      if (accountAgeDays < cfg.referralMinAccountDays) return;
      if (store.db.referrals[member.id]) return; // un filleul ne compte qu'une fois
      store.db.referrals[member.id] = { inviter: used.inviter.id, joinedAt: Date.now(), validated: false };
      store.save();
    } catch (e) {
      console.error('[bonbons] guildMemberAdd', e);
    }
  });
  // Contrôle toutes les heures des filleuls qui ont atteint 7 jours.
  setInterval(() => {
    for (const id of Object.keys(store.db.referrals)) checkReferral(id).catch(() => {});
  }, 60 * 60 * 1000).unref();

  // --- Boost ---
  client.on('guildMemberUpdate', async (oldM, newM) => {
    try {
      if (newM.guild.id !== cfg.guildId) return;
      if (!oldM.premiumSince && newM.premiumSince) {
        const gains = engine.onBoost(store.user(newM.id), engine.getCtx());
        if (gains.length) await economy.pushGains(newM.id, gains);
      }
    } catch (e) {
      console.error('[bonbons] boost', e);
    }
  });

  return {
    async init() {
      const guild = client.guilds.cache.get(cfg.guildId);
      if (guild) await refreshInvites(guild);
      store.backupIfNeeded();
    },
  };
}

module.exports = { register };
