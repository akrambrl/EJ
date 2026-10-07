# Outils

## `rebuild_dashboard.py`

Script de ton ami pour recalculer **tous** les chiffres du dashboard (KPI, clients, pays,
pays × client, mois, références, collections, petits clients, top produits par client,
prédictions de recommande et « remarques intelligentes ») à partir de la seule liste
`ALL[année].factures[]`.

Code source d'origine (vérifié : il correspond exactement au fichier compilé
`rebuild_dashboard.cpython-310.pyc` fourni).

**Règle d'or :** on ne modifie que `ALL["2025"].factures` / `ALL["2026"].factures`
(ajout ou correction d'une facture), puis on lance le script. Jamais de modification
à la main des KPI, clients, pays, mois, références…

```bash
# Vérifier (n'écrit rien)
python3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js

# Recalculer et enregistrer (crée une sauvegarde .bak à côté)
python3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js --write

# Date de référence pour les prédictions (par défaut : aujourd'hui)
python3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js --write --today 07/10/2026
```

Le script fonctionne sur n'importe quel fichier contenant `const ALL = {...}` :
`dashboard-netlify/data/ventes.js`, `data/ventes-historiques.js`, ou un `index.html` tout-en-un.

Une facture ressemble à ceci (le `ca` de la facture doit être égal à la somme des `ca` des lignes,
sinon le script refuse d'écrire) :

```json
{"facture": "EJ-2026-036", "date": "15/10/2026", "client": "Nom du client", "pays": "France",
 "btl": 120, "ca": 1500.0, "cout": 600.0, "marge": 900.0,
 "lines": [{"collection": "VIP", "reference": "Nom du parfum", "mode": "carton",
            "cartons": 2, "btl": 120, "testers": 6, "ca": 1500.0, "cout": 600.0, "marge": 900.0}]}
```

À savoir : avec `--write`, l'objet `ALL` est réécrit sur **une seule ligne** (format compact
d'origine). Le dashboard fonctionne pareil ; c'est seulement moins lisible dans l'éditeur.

## `exporter_json.py`

Exporte chaque bloc de données (`ALL`, `CHARGES_DATA`, `REVENUE_DATA`, `SUPPLIER_INVOICES`,
`PENDING_TRANSFERS`, `FIXED_CHARGES`, `INVENTAIRE_DATA`, coûts des cadeaux, `CARTON_INFO`,
`PROD_COMPONENTS_PRICES`) en fichiers JSON lisibles. Lecture seule.

Il attend un dashboard en **un seul fichier** HTML. Avec la version découpée, les données sont
déjà lisibles dans `dashboard-netlify/data/`, mais on peut quand même l'utiliser en assemblant
les fichiers :

```bash
cat dashboard-netlify/data/*.js dashboard-netlify/js/app.js > /tmp/dashboard.js
python3 outils/exporter_json.py /tmp/dashboard.js donnees_json
```
