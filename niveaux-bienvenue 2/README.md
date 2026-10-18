# 🏆 niveaux-bienvenue

**Commandes** : `/rang [membre]` (carte image), `/classement` (top 10), `/niveaux definir`, `/niveaux importer`, `/niveaux apercu-bienvenue` (staff).
**Bienvenue** : à chaque arrivée, image avec avatar + pseudo + numéro de membre, sur la bannière du serveur.

## Installation
1. Dossier `niveaux-bienvenue` à la racine du repo GitHub.
2. Dans `index.js`, après `statsServeur.init(client);` :
   ```js
   const niveaux = require('./niveaux-bienvenue');
   niveaux.init(client);
   ```
3. Variables Railway (facultatives) : `WELCOME_CHANNEL_ID`, `WELCOME_BANNER_URL`, `LEVELS_ANNOUNCE_CHANNEL_ID`.
   Tant que DraftBot annonce encore les niveaux, **ne mets pas** `LEVELS_ANNOUNCE_CHANNEL_ID` (sinon double annonce).

## Reprendre les niveaux de DraftBot
Fichier texte, une ligne par membre : `identifiant;niveau` (identifiant Discord du membre), puis `/niveaux importer`.
Sans fichier : `/niveaux definir @membre niveau` pour chacun.

## XP
15 à 25 XP par message (5 caractères minimum), 1 fois par minute max, mêmes salons exclus que les bonbons. Courbe identique à MEE6.
Test sans Discord : `node test/run.js`
