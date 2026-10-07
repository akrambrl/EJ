# Dashboard Netlify (version de base)

Copie fidèle du site https://fastidious-profiterole-ec713c.netlify.app/ (récupérée le 07/10/2026),
découpée en fichiers pour pouvoir la modifier. Rendu vérifié identique à l'original (17 onglets × 3 années).

Lancer en local : `cd dashboard-netlify && python3 -m http.server 8000` puis http://localhost:8000

| Fichier | Contenu |
|---|---|
| `index.html` | Structure : en-tête, boutons d'année, KPI, onglets, tableaux |
| `css/style.css` | Style (thème sombre navy / jaune) |
| `js/app.js` | Tout le code : graphiques, onglets, simulation, production… |
| `data/ventes.js` | `ALL` : ventes 2025 / 2026 / total, prix de revient, stock |
| `data/charges.js` | `CHARGES_DATA` : charges par fournisseur et par mois |
| `data/revenus.js` | `REVENUE_DATA` : revenus par source et par mois |
| `data/factures-fournisseurs.js` | `SUPPLIER_INVOICES` |
| `data/virements-en-attente.js` | `PENDING_TRANSFERS` |
| `data/charges-fixes.js` | `FIXED_CHARGES` : charges fixes mensuelles |
| `data/inventaire.js` | `INVENTAIRE_DATA` : inventaire flacons, bouchons, etc. |

Les fichiers `data/` sont chargés avant `js/app.js` (voir bas de `index.html`).
