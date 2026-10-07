# Dépôt EJ — dashboards Emmanuelle Jane Paris

- `dashboard-netlify/` : dashboard de référence (copie fidèle du fichier de travail d'origine, données à jour).
  **Lire `dashboard-netlify/CLAUDE.md` avant toute modification des données** (règles d'or, ajout de facture, modèle de coût).
- Racine (`index.html`, `css/`, `js/`, `data/`) : autre version refaite (thème clair, Supabase, devis/factures), données plus anciennes.
- Deux sociétés : **BSD** (France, factures EJ…) et **NB Evolution** (Dubaï, factures NB…) ; vues Groupe / BSD / NB dans le dashboard.
- `outils/` : `rebuild_dashboard.py` (recalcul des agrégats), `exporter_json.py`, `construire_intragroupe.py` (factures BSD → NB depuis les registres).
- `donnees_sources/` : registres de factures, tarifs, catalogue, stock, relevés de charges. Voir son README pour les écarts connus avec le dashboard.
