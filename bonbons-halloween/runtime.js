// Lit en direct les réglages déjà présents dans ton bot (tickets) pour éviter de les redéfinir.
const cfg = require('./config');
let getGuildConfig = null;
const gc = () => { try { return (getGuildConfig && getGuildConfig(cfg.guildId)) || {}; } catch { return {}; } };

module.exports = {
  setStorage(fn) { getGuildConfig = fn; },
  ticketCategoryId: () => cfg.ticketCategoryId || gc().ticketCategoryId || undefined,
  staffRoleIds: () => (cfg.staffRoleIds.length ? cfg.staffRoleIds : gc().ticketStaffRoleIds || []),
};
