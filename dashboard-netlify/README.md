# Dashboard Netlify (version de base)

Copie fidèle du site https://fastidious-profiterole-ec713c.netlify.app/ (récupérée le 07/10/2026),
découpée en fichiers pour pouvoir la modifier. Rendu vérifié identique à l'original (17 onglets × 3 années).

Lancer en local : `cd dashboard-netlify && python3 -m http.server 8000` puis http://localhost:8000

| Fichier | Contenu |
|---|---|
| `index.html` | Structure : en-tête, boutons d'année, KPI, onglets, tableaux |
| `css/style.css` | Style, charte du catalogue (crème, or, noir, Montserrat) |
| `js/app.js` | Code des onglets d'origine : graphiques, simulation, production… |
| `js/documents.js` | Onglet « Devis & Factures » : devis, proformas, factures, PDF, recalcul des chiffres |
| `simulateur-offres/` | Simulateur d'offres (paliers de remise et cadeaux), affiché dans son onglet |
| `img/` | Logo et fond (couverture du catalogue) |
| `data/ventes.js` | `ALL` : ventes 2025 / 2026 / total, prix de revient, stock |
| `data/charges.js` | `CHARGES_DATA` : charges par fournisseur et par mois |
| `data/revenus.js` | `REVENUE_DATA` : revenus par source et par mois |
| `data/factures-fournisseurs.js` | `SUPPLIER_INVOICES` |
| `data/virements-en-attente.js` | `PENDING_TRANSFERS` |
| `data/charges-fixes.js` | `FIXED_CHARGES` : charges fixes mensuelles |
| `data/inventaire.js` | `INVENTAIRE_DATA` : inventaire flacons, bouchons, etc. |

Les fichiers `data/` sont chargés avant `js/app.js` (voir bas de `index.html`).

## Devis, proformas et factures (onglet « Devis & Factures »)

- **Nouveau devis / proforma / facture** : client (pays, adresse, n° TVA retenus d'une fois sur l'autre),
  lignes par collection et référence du catalogue, vente au carton ou à l'unité, testeurs calculés
  automatiquement (1 par carton, 2 pour les BRUMES vers la Russie), remise, cadeaux offerts.
  Le bouton « Appliquer la grille du simulateur d'offres » reprend le palier atteint (remise, testeurs, cadeaux).
- **Numérotation** : `DV2026-001`, `PF2026-001`, et pour les factures la suite des `EJ2026xxx`
  (en tenant compte des numéros déjà utilisés dans les registres).
- **TVA** proposée selon le pays : export hors UE exonéré (art. 262 I CGI), livraison intracommunautaire
  exonérée (art. 262 ter I CGI, n° TVA du client requis), France 20 %.
- **Voir / PDF** : document A4 aux couleurs de la marque ; « Imprimer » puis « Enregistrer en PDF ».
- **Convertir** un devis en proforma ou en facture, une proforma en facture.
- **Les factures entrent dans les chiffres** : tous les agrégats sont recalculés dans le navigateur avec un
  portage exact de `outils/rebuild_dashboard.py` (vérifié : 0 écart sur 2025, 2026 et total).
- **Enregistrement** : dans le navigateur (`localStorage`, clés `ej_documents_v1` et `ej_documents_settings_v1`).
  « Sauvegarder » télécharge une copie ; « Exporter data/ventes.js » produit le fichier de données à jour
  à remettre dans `data/` pour rendre les nouvelles factures permanentes (puis vérifier avec le script).
- **Coordonnées de la société** : modifiables dans l'onglet ; renseigner l'IBAN avant d'envoyer une facture.
