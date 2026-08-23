# Bot MSP — Blacklist & Giveaways

Bot Discord qui gère automatiquement la blacklist temporaire des giveaways et permet d'en créer directement depuis Discord.

## Fonctionnalités

- `/blacklist membre:@X jours:7 raison:"..."` → attribue le rôle blacklist et le retire automatiquement à la fin
- `/unblacklist membre:@X` → retire manuellement la blacklist
- `/creer-gw prix:"..." duree:2h gagnants:1` → crée un giveaway avec bouton "Participer", tire les gagnants automatiquement à la fin en excluant les membres blacklistés

---

## 1. Créer l'application Discord

1. Va sur https://discord.com/developers/applications → **New Application**
2. Onglet **Bot** → **Reset Token** → copie le token (tu ne pourras plus le revoir après)
3. Toujours dans l'onglet **Bot**, active **Server Members Intent** (obligatoire, sinon le bot ne peut pas gérer les rôles correctement)
4. Onglet **General Information** → copie l'**Application ID** (= `CLIENT_ID`)

## 2. Inviter le bot sur ton serveur

1. Onglet **OAuth2 → URL Generator**
2. Coche **`bot`** et **`applications.commands`**
3. Dans permissions, coche au minimum : **Manage Roles**, **Send Messages**, **Embed Links**, **Read Message History**
4. Copie l'URL générée en bas, ouvre-la, et invite le bot sur ton serveur

⚠️ **Important** : dans *Paramètres du serveur → Rôles*, fais glisser le rôle du bot **au-dessus** du rôle "Blacklist" dans la liste, sinon il ne pourra pas l'attribuer/retirer.

## 3. Récupérer les identifiants

Active le **mode développeur** (Paramètres Discord → Avancés → Mode développeur), puis clic droit pour copier :
- L'ID de ton serveur → `GUILD_ID`
- L'ID du rôle "Blacklist" (crée-le d'abord si besoin) → `BLACKLIST_ROLE_ID`

## 4. Configuration locale

```bash
cp .env.example .env
```

Remplis le fichier `.env` avec toutes tes valeurs.

```bash
npm install
npm run deploy   # enregistre les commandes slash sur ton serveur (instantané)
npm start        # lance le bot en local pour tester
```

## 5. Héberger le bot 24/7 sur Railway

1. Crée un compte sur https://railway.app (connexion avec GitHub la plus simple)
2. Mets ce dossier dans un dépôt GitHub (ou utilise `railway up` via leur CLI si tu ne veux pas de GitHub)
3. Sur Railway : **New Project → Deploy from GitHub repo** → sélectionne ton repo
4. Dans l'onglet **Variables** du projet Railway, ajoute exactement les mêmes clés que ton `.env` (`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `BLACKLIST_ROLE_ID`, `LOG_CHANNEL_ID`)
5. Railway détecte automatiquement Node.js et lance `npm start`
6. Ton bot tourne maintenant 24/7 ✅

⚠️ Ne mets **jamais** ton `.env` ou ton token sur GitHub — le `.gitignore` fourni l'exclut déjà.

## Notes

- Les données (blacklist + giveaways en cours) sont stockées dans `data/*.json`. Sur Railway, ces fichiers sont réinitialisés si tu redéploies — pour un usage plus poussé plus tard, on pourra migrer vers une vraie base de données (ex. SQLite persistant ou Railway Postgres).
- Format de durée pour `/creer-gw` : `30m`, `2h`, `3j`.
- Pour changer la durée par défaut de la blacklist (7 jours), tu peux simplement préciser l'option `jours` à chaque fois.
