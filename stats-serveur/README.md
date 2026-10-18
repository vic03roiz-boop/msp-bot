# 📊 stats-serveur : statistiques du serveur en images

Commande **/stats** (administrateurs) : 4 graphiques + un résumé, sur 7, 30 ou 90 jours.
- Croissance du serveur (membres, arrivées, départs)
- Membres les plus actifs (messages)
- Les plus présents en vocal
- Heures de pointe (heure de Paris)

Le bot envoie aussi tout seul un **rapport chaque lundi à 9 h** dans le salon logs.

## Installation
1. Glisse le dossier `stats-serveur` à la racine de ton repo GitHub (à côté de `index.js`).
2. Dans `package.json` du bot, ajoute la dépendance `"@napi-rs/canvas": "^1.0.7"` (ou laisse Railway l'installer depuis le `package.json` fourni).
3. Dans `index.js`, après `bonbons.init(...)` :
   ```js
   const statsServeur = require('./stats-serveur');
   statsServeur.init(client);
   ```
4. Variable Railway : `STATS_CHANNEL_ID` = identifiant du salon logs (visible seulement par les admins).
   Facultatif : `STATS_EXCLUDED_CHANNEL_IDS` = salons à ne pas compter (séparés par des virgules).

## À savoir
- Les statistiques se construisent **à partir de l'installation** : Discord ne donne pas l'historique passé.
- Les données sont dans `/app/data/stats-serveur.json` (200 derniers jours conservés).
- Test sans Discord : `node test/render.js` génère des images d'exemple.
