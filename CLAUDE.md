# Dépôt EJ — dashboards Emmanuelle Jane Paris

- `dashboard-netlify/` : dashboard de référence (copie fidèle du fichier de travail d'origine, données à jour).
  **Lire `dashboard-netlify/CLAUDE.md` avant toute modification des données** (règles d'or, ajout de facture, modèle de coût).
- Racine (`index.html`, `css/`, `js/`, `data/`) : autre version refaite (thème clair, Supabase, devis/factures), données plus anciennes.
- Deux sociétés : **BSD** (France, factures EJ…) et **NB Evolution** (Dubaï, factures NB…) ; vues Groupe / BSD / NB dans le dashboard.
- `outils/` : `rebuild_dashboard.py` (recalcul des agrégats), `exporter_json.py`, `construire_intragroupe.py` (factures BSD → NB depuis les registres).
- `donnees_sources/` : registres de factures, tarifs, catalogue, stock, relevés de charges. Voir son README pour les écarts connus avec le dashboard.
- Fichier Netlify : `python3 outils/construire_netlify.py --mot-de-passe …` (page chiffrée). Partage en ligne entre salariés : `PARTAGE-SUPABASE.md`.
- `site/` : version en ligne (Vercel) = dashboard chiffré. Après chaque modification : `EJ_MOT_DE_PASSE='…' EJ_MOT_DE_PASSE_LIMITE='…' python3 outils/construire_netlify.py site`, puis commit + push (Vercel redéploie). Ne jamais y mettre de version non chiffrée ni les codes d'accès.
- `site/natali/` : accès limité (Natali), autre mot de passe (`EJ_MOT_DE_PASSE_LIMITE`). Construit sans chiffres financiers internes (`outils/acces_limite.py`) et pages masquées (`js/role.js`). Sans `EJ_MOT_DE_PASSE_LIMITE`, cette page n'est pas mise à jour : toujours reconstruire les deux.
