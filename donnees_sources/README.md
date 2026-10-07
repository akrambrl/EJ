# Données sources (dossier de travail de l'ami)

Documents de référence venant du dossier de travail d'origine du dashboard.
Tous ont été comparés aux données de `dashboard-netlify/` : ils concordent.

| Fichier | Contenu | Correspondance dans le dashboard |
|---|---|---|
| `REGLES_TARIFAIRES.md` | Prix carton / bouteille et testers offerts par collection (+ exception BRUMES Russie) | `CARTON_INFO` dans `dashboard-netlify/js/app.js` |
| `STOCK_PRODUITS_FINIS.md` | Stock produits finis au 31/07/2026 par référence | `ALL.stock` dans `dashboard-netlify/data/ventes.js` (identique) |
| `BRUMES_couleurs_reference.md` | Couleurs des flacons BRUMES (codes hex), capots, familles olfactives | — (référence visuelle) |
| `Recap_Charges_2025.xlsx` | Relevé BRED 2025 classé par catégorie (1 396 opérations) | `dashboard-netlify/data/charges.js` 2025 (totaux identiques à l'euro près) |
| `LISEZ-MOI.txt` | Mode d'emploi du dossier d'origine | Mentionne un `CLAUDE.md` (règles de modification) non encore récupéré |
