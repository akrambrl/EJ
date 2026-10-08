# Dashboard Netlify (version de base)

Copie fidèle du site https://fastidious-profiterole-ec713c.netlify.app/ (récupérée le 07/10/2026),
découpée en fichiers pour pouvoir la modifier. Rendu vérifié identique à l'original (17 onglets × 3 années).

Lancer en local : `cd dashboard-netlify && python3 -m http.server 8000` puis http://localhost:8000

| Fichier | Contenu |
|---|---|
| `index.html` | Structure : en-tête, boutons d'année, KPI, onglets, tableaux |
| `css/style.css` | Style, charte du catalogue (crème, or, noir, Montserrat) |
| `js/app.js` | Code des onglets d'origine : graphiques, simulation, production… |
| `js/rebuild.js` | Recalcul de tous les agrégats (portage exact de `outils/rebuild_dashboard.py`) |
| `js/societes.js` | Deux sociétés (BSD, NB Evolution) : vues Groupe / BSD / NB, coordonnées, codes EAN |
| `js/nav.js`, `js/mobile.js` | Menu latéral masquable (société, année, rubriques Ventes / Produits / Finances / Commercial) et graphiques adaptés au mobile |
| `js/documents.js` | Onglet « Devis & Factures » : devis, proformas, factures des deux sociétés, PDF |
| `data/intragroupe.js` | 18 factures BSD → NB Evolution (ventes internes), générées par `outils/construire_intragroupe.py` |
| `data/depenses-nb.js` | Dépenses de NB Evolution (vide pour l'instant, même format que celles de BSD) |
| `simulateur-offres/` | Simulateur d'offres (paliers de remise et cadeaux), affiché dans son onglet |
| `data/salons.js`, `js/salons.js` | Calendrier des salons de la parfumerie par année (onglet Commercial › Calendrier des salons) : prochain salon, filtres, export agenda (.ics), ajout de salons gardé dans le navigateur. Dates à mettre à jour dans `data/salons.js`. |
| `data/clients.js` | Carnet d'adresses des clients (pays, adresse, n° TVA) pour pré-remplir les documents ; complétable dans Devis & Factures › Coordonnées › Adresses clients |
| `img/` | Logo et marbre noir (visuels VIP Black du catalogue) |
| `data/ventes.js` | `ALL` : ventes 2025 / 2026 / total, prix de revient, stock |
| `data/charges.js` | `CHARGES_DATA` : charges par fournisseur et par mois |
| `data/revenus.js` | `REVENUE_DATA` : revenus par source et par mois |
| `data/factures-fournisseurs.js` | `SUPPLIER_INVOICES` |
| `data/virements-en-attente.js` | `PENDING_TRANSFERS` |
| `data/charges-fixes.js` | `FIXED_CHARGES` : charges fixes mensuelles |
| `data/inventaire.js` | `INVENTAIRE_DATA` : inventaire flacons, bouchons, etc. |

Les fichiers `data/` sont chargés avant `js/app.js` (voir bas de `index.html`).

## Deux sociétés : BSD et NB Evolution

Sélecteur en haut de page (mémorisé) :

| Vue | Chiffre d'affaires | Coût | Dépenses |
|---|---|---|---|
| **Groupe** | ventes aux clients finaux (BSD hors NB + NB) — chiffres d'origine du dashboard | fabrication | BSD + NB |
| **BSD · France** | toutes les factures EJ…, y compris les ventes à NB Evolution (`data/intragroupe.js`) | fabrication | compte BRED (charges fixes, fournisseurs, virements) |
| **NB Evolution · Dubaï** | factures NB… à ses clients | prix d'achat facturé par BSD | `data/depenses-nb.js` (à compléter) |

Vérifié : dans chaque vue, la somme des clients, pays, mois, références, collections et factures est égale au CA.

## Devis, proformas et factures (onglet « Devis & Factures »)

- **Société** : BSD (factures `EJ2026xxx`, proformas `PF2026-xxx`, devis `DV2026-xxx`, TVA française)
  ou NB Evolution (factures et proformas dans la série `NB2026xxx`, devis `NBDV2026-xxx`, TVA des Émirats).
  Coordonnées, banque (BRED / WIO Bank), SIRET, licence : bouton « Coordonnées des sociétés ».
- **Mise en page** reprenant les factures d'origine (`donnees_sources/modeles_factures/`) : un tableau par
  collection (contenance, code EAN, prix unitaire, flacons et testeur par carton, prix carton, cartons, total),
  en français ou en anglais.
- **Testeurs** : valorisés pour la douane (1 € par défaut) puis déduits automatiquement par la remise :
  ils restent gratuits et n'entrent jamais dans le CA. Une remise commerciale (% ou montant) peut s'ajouter.
- **Ventes BSD → NB Evolution** (client « NB Evolution (…) ») : comptées dans la vue BSD, exclues de la vue Groupe.
  Une facture NB peut être reliée à la facture d'achat BSD correspondante : c'est alors son coût dans la vue NB.
- **Codes EAN** préremplis pour 45 références ; les autres se saisissent une fois et sont mémorisés.
- **Voir / PDF** : document A4 aux couleurs de la marque ; « Imprimer » puis « Enregistrer en PDF ».
- **Convertir** un devis en proforma ou en facture, une proforma en facture.
- **Les factures entrent dans les chiffres** : tous les agrégats sont recalculés dans le navigateur avec un
  portage exact de `outils/rebuild_dashboard.py` (vérifié : 0 écart sur 2025, 2026 et total).
- **Enregistrement** : dans le navigateur (`localStorage`, clés `ej_documents_v1` et `ej_documents_settings_v2`).
  « Sauvegarder » télécharge une copie ; « Exporter les données » produit `ventes.js` (et `intragroupe.js` s'il y a de nouvelles
  ventes BSD → NB) à remettre dans `data/` pour rendre les nouvelles factures permanentes (puis vérifier avec le script).

## Mettre en ligne sur Netlify

```bash
python3 outils/construire_netlify.py        # crée netlify-deploy/index.html (un seul fichier, tout intégré)
```
Glisser le dossier `netlify-deploy/` (ou un ZIP de `index.html`) sur https://app.netlify.com/drop.
Le fichier contient toutes les données confidentielles : activer une protection par mot de passe sur le site.
