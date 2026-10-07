# Emmanuelle Jane Paris — Outil de gestion

Dashboard de gestion (ventes, clients, catalogue, trésorerie, stocks, commandes & factures…).
> Le dossier [`dashboard-netlify/`](dashboard-netlify/) contient séparément la version de base
> publiée sur Netlify (données plus récentes, thème sombre d'origine).

Site 100 % statique : aucun build, il suffit d'ouvrir `index.html` via un petit serveur.

## Lancer en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Où modifier quoi

| Fichier | Contenu |
|---|---|
| `index.html` | Structure des pages : menu latéral, onglets, tableaux, fenêtres |
| `css/style.css` | Tout le style (couleurs, mise en page, mobile) |
| `js/config.js` | Clés Supabase, taux $→€, coordonnées légales des sociétés (BSD, NB) |
| `data/ventes-historiques.js` | Données de ventes historiques par année (`ALL`) : KPI, clients, pays, mois, références… |
| `js/dashboard.js` | Rendu du dashboard : graphiques, KPI, objectifs, production, simulateur |
| `js/modules.js` | Modules de gestion éditables (trésorerie, matières, catalogue, arrivages…) + sauvegarde locale/Supabase |
| `js/commandes-factures.js` | Devis, bons de commande, factures, règlements, export comptable |
| `logo.png` | Logo affiché dans le menu |

Les scripts sont chargés dans cet ordre (voir bas de `index.html`) : `config` → `ventes-historiques` → `dashboard` → `modules` → `commandes-factures`.

## Sauvegarde des données

- Sans Supabase : les données saisies restent dans le navigateur (`localStorage`).
- Avec Supabase : voir [SETUP-SUPABASE.md](SETUP-SUPABASE.md).
