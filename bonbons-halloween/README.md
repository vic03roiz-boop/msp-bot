# 🎃 Bonbons & Citrouilles : module pour ton bot (discord.js v14)

## 1. Installer (10 minutes)

1. Sur GitHub, dans `msp-bot`, glisse-dépose le dossier `bonbons-halloween` à la racine, à côté de `index.js`.
2. Remplace ton `index.js` par celui fourni (`index.js`) : il contient déjà les 5 petits ajouts (voir plus bas). Glisse-dépose le fichier, ne le colle pas à la main.
3. **Variables Railway** : rien à ajouter. Le salon des niveaux, les salons ignorés et les emojis sont déjà dans `config.js` (une variable Railway du même nom reste prioritaire si tu veux changer).
4. Le portail développeur Discord (Bot) : *Message Content Intent* et *Server Members Intent* sont déjà utilisés par ton bot, rien à changer.
5. **Permissions du bot** : Gérer les salons, Gérer le serveur (pour lire les invitations), Voir les salons, Envoyer des messages, Intégrer des liens.

### Ce qui a été ajouté dans ton index.js (5 endroits, repérables par 🎃)
* le `require` du module ;
* 2 intents : `GuildVoiceStates` (vocal) et `GuildInvites` (parrainage) ;
* `bonbons.init(client, ...)` juste après le chargement des commandes (il ajoute les commandes à `client.commands`, sinon ton enregistrement au démarrage les effacerait) ;
* +50 bonbons à chaque participation à un giveaway ;
* mission « mini-jeu » validée pour tous les joueurs quand une partie de UNO se termine.

## 2. Fichiers de ton bot à remplacer aussi
* `commands/pendu-deviner.js` : partie de pendu gagnée = mission « mini-jeu » pour chaque joueur qui a proposé une lettre.
* `commands/drop.js` : drop attrapé = mission « drop ».

## 3. Tester demain (checklist)

1. Lance le bot, regarde les logs : `🎃 système de bonbons prêt`. Les commandes apparaissent dans le serveur.
2. Écris un message de plus de 5 caractères dans un salon normal : une annonce apparaît dans le salon des niveaux (+10 connexion). Réécris dans les 10 minutes : le **même** message est modifié.
3. `/solde` : missions du jour. `/recompenses` : liste des 21 paliers.
4. `/bonbons ajouter` +60 pour toi : le palier 1 (50) est proposé avec les boutons. Teste « Continuer à cumuler », puis `/recompenses`.
5. Réclame un palier : confirmation, bonbons retirés, salon privé créé, boutons du staff (« Je m'en occupe », « Livré », « Annuler et rembourser »).
6. Teste le vocal à deux comptes (20 minutes pour la première mission).
7. `/stock` : règle le stock d'un palier, vérifie « épuisé ».
8. **Avant l'annonce** : `/bonbons reinit` avec `REINITIALISER` pour tout remettre à zéro.

## 4. Commandes

| Commande | Pour qui | Rôle |
|---|---|---|
| `/solde` | tous | solde, missions du jour, séries, historique (visible par toi seul) |
| `/recompenses` | tous | paliers en bonbons + réclamation |
| `/boutique` | tous | boutique en citrouilles + achat |
| `/autographes quantite` | tous | 5 bonbons = 1 autographe, 100 maximum par membre |
| `/stock` | staff | stock des récompenses limitées (non réglé = illimité) |
| `/bonbons ajouter / retirer / voir` | staff | correction de solde (raison dans le journal) |
| `/bonbons jeu` | staff | valide un mini-jeu/drop à la main |
| `/bonbons reinit` | staff | remet tout à zéro (fin des tests) |

## 5. Réglages utiles

* `config.js` : dates (`EVENT_START`, `EVENT_END`), montants des missions, plafonds, anti-abus.
* `THEME=automne` (variable Railway) après le 31 octobre : couleurs et phrases d'automne.
* `petiteRoueEnBoutique` dans `config.js` : la petite roue est seulement dans les paliers (palier 8 = 350 bonbons) tant que le prix n'est pas tranché.

## 6. Limites connues

* Le parrainage ne marche pas si le serveur est rejoint par une URL personnalisée (vanity) : le bot ne sait pas qui a invité.
* Les tours de petite roue sont donnés par le staff dans le ticket (les lots de la roue ne sont pas décrits).
* Les propositions « palier atteint » concernent les paliers en bonbons ; la boutique se consulte avec `/boutique`.
* Si une de tes commandes existantes répond « commande inconnue » pour les nouvelles, c'est ton gestionnaire de commandes qui doit ignorer ces noms : ils sont gérés par ce module.
