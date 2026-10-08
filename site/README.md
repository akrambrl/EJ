# Site en ligne (Vercel)

`index.html` est le dashboard en un seul fichier, **chiffré** : il ne s'ouvre qu'avec le code d'accès
(le code n'est pas dans le dépôt). Ne jamais déposer ici une version non chiffrée.

Mise à jour : `EJ_MOT_DE_PASSE='…' python3 outils/construire_netlify.py site`, puis commit et push :
Vercel remet le site en ligne automatiquement.

Réglages Vercel : Root Directory `site`, Framework Preset « Other », pas de commande de build.
`vercel.json` : pas d'indexation par les moteurs de recherche, pas de cache (les mises à jour s'affichent tout de suite).
