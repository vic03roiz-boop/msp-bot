const cfg = require('./config');

const CIT = cfg.bonbonsParCitrouille;

// 21 paliers en bonbons. stockKey = récompense à stock limité (le staff règle avec /stock).
const PALIERS = [
  { n: 1, cost: 50, reward: '5 autographes', note: 'Faits main' },
  { n: 2, cost: 75, reward: '10 autographes', note: 'Faits main' },
  { n: 3, cost: 100, reward: '1 liste de souhaits', note: 'Hors items' },
  { n: 4, cost: 150, reward: '1 item', note: 'Selon le stock', stockKey: 'p4' },
  { n: 5, cost: 200, reward: '25 autographes', note: 'Faits main' },
  { n: 6, cost: 250, reward: '2 items + 2 salutes', note: 'Selon le stock', stockKey: 'p6' },
  { n: 7, cost: 300, reward: '10 autographes + 1 item', note: 'Faits main / selon le stock', stockKey: 'p7' },
  { n: 8, cost: 350, reward: '1 tour de petite roue' },
  { n: 9, cost: 400, reward: '50 autographes', note: 'Faits main' },
  { n: 10, cost: 450, reward: '1 liste de souhaits + 20 autographes', note: 'Hors items / faits main' },
  { n: 11, cost: 500, reward: '1 rôle perso' },
  { n: 12, cost: 600, reward: '5 salutes' },
  { n: 13, cost: 700, reward: '10k argent boutique' },
  { n: 14, cost: 800, reward: '100 autographes', note: 'Faits main' },
  { n: 15, cost: 900, reward: '10 salutes' },
  { n: 16, cost: 1000, reward: '10 pixels', note: 'Selon le stock', stockKey: 'p16' },
  { n: 17, cost: 1200, reward: '2 listes de souhaits + 50 autographes', note: 'Hors items / faits main' },
  { n: 18, cost: 1400, reward: '15k argent boutique' },
  { n: 19, cost: 1600, reward: '15 salutes + 5 rares', note: 'Selon le stock', stockKey: 'p19' },
  { n: 20, cost: 1800, reward: '200 autographes + 2 tours de petite roue', note: 'Faits main' },
  { n: 21, cost: 2000, reward: '1 rôle perso + 1 liste de souhaits + 2 pixels + 10 salutes' },
];

// Boutique en citrouilles (prix en citrouilles ; converties en bonbons à l'achat).
const SHOP = [
  { key: 'petite-roue', name: 'Petite roue', cit: 3, hidden: !cfg.petiteRoueEnBoutique },
  { key: 'deco-discord', name: 'Déco profil Discord', cit: 4 },
  { key: 'petit-nitro', name: 'Petit Nitro', cit: 5 },
  { key: 'topup-bronze', name: 'Top-Up Bronze', cit: 5 },
  { key: 'vip-1s', name: 'VIP 1 semaine', cit: 7 },
  { key: 'topup-silver', name: 'Top-Up Silver', cit: 8 },
  { key: 'nitro', name: 'Nitro', cit: 11 },
  { key: 'topup-gold', name: 'Top-Up Gold', cit: 14 },
  { key: 'vip-1m', name: 'VIP 1 mois', cit: 15 },
  { key: 'topup-platinum', name: 'Top-Up Platinum', cit: 21 },
  { key: 'topup-diamond', name: 'Top-Up Diamond', cit: 36 },
  { key: 'vip-3m', name: 'VIP 3 mois', cit: 42 },
  { key: 'vip-1an', name: 'VIP 1 an', cit: 80 },
].filter((s) => !s.hidden);

const STOCK_KEYS = PALIERS.filter((p) => p.stockKey).map((p) => ({ key: p.stockKey, label: `Palier ${p.n} : ${p.reward}` }));

/** key = 'p:8' | 's:vip-1an' | 'a:20' -> description de l'article, ou null */
function resolve(key) {
  const [kind, val] = String(key).split(':');
  if (kind === 'p') {
    const p = PALIERS.find((x) => x.n === Number(val));
    if (!p) return null;
    return { key, kind, cost: p.cost, title: `Palier ${p.n} : ${p.reward}`, note: p.note || '', stockKey: p.stockKey, palier: p.n };
  }
  if (kind === 's') {
    const s = SHOP.find((x) => x.key === val);
    if (!s) return null;
    return { key, kind, cost: s.cit * CIT, title: `${s.name} (${s.cit} citrouille${s.cit > 1 ? 's' : ''})`, note: '' };
  }
  if (kind === 'a') {
    const q = Number(val);
    if (!Number.isInteger(q) || q < 1) return null;
    return { key, kind, cost: q * cfg.bonbonsParAutographe, title: `${q} autographe${q > 1 ? 's' : ''} (échange de bonbons)`, note: 'Faits main', qty: q };
  }
  return null;
}

module.exports = { PALIERS, SHOP, STOCK_KEYS, resolve, CIT };
