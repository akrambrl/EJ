> **Adaptation à ce dépôt** (ajoutée lors de la récupération) — le guide ci-dessous a été écrit pour
> le dossier d'origine, où tout tenait dans `dashboard_parfums_emmanuelle_jane.html`. Ici, ce fichier
> a été découpé à l'identique dans `dashboard-netlify/` :
>
> | Dans le guide | Dans ce dépôt |
> |---|---|
> | `dashboard_parfums_emmanuelle_jane.html` | `dashboard-netlify/index.html` + `css/` + `js/app.js` + `data/*.js` |
> | blob `ALL` | `dashboard-netlify/data/ventes.js` (indenté, lisible) |
> | `CHARGES_DATA`, `REVENUE_DATA`, `SUPPLIER_INVOICES`, `PENDING_TRANSFERS`, `FIXED_CHARGES`, `INVENTAIRE_DATA` | `dashboard-netlify/data/*.js` (un fichier par bloc) |
> | `CADEAUX_*`, `CARTON_INFO`, `PROD_COMPONENTS_PRICES` | `dashboard-netlify/js/app.js` |
> | `donnees_sources/`, `outils/` | `donnees_sources/`, `outils/` à la racine du dépôt |
>
> Recalcul : `python3 outils/rebuild_dashboard.py dashboard-netlify/data/ventes.js [--write]`
> (avec `--write`, `ALL` est réécrit sur une seule ligne ; le dashboard fonctionne pareil).
>
> Ajouts depuis la récupération : charte du catalogue (`css/style.css`, `img/`), onglet « Devis & Factures »
> (`js/documents.js`, qui recalcule les agrégats avec un portage JS exact de `rebuild_dashboard.py` — à garder
> synchronisé si le script change) et onglet « Simulateur d'offres » (`simulateur-offres/`). Voir `README.md`.

# Dashboard Emmanuelle Jane Paris — guide pour Claude

Ce dossier contient le tableau de bord des ventes d'Emmanuelle Jane Paris (parfums et brumes),
ainsi que toutes les données qui ont servi à le construire. Ce fichier explique à Claude
comment il est organisé et comment le modifier sans rien casser. **À lire avant toute modification.**

## Contenu du dossier

| Élément | Rôle |
|---|---|
| `dashboard_parfums_emmanuelle_jane.html` | **Le dashboard.** Un seul fichier HTML autonome (Chart.js via CDN). On l'ouvre dans un navigateur. Toutes les données sont embarquées dedans. |
| `donnees_sources/FACTURES_2025.md`, `FACTURES_2026.md` | Registre des factures clients, rédigé à la main : client, pays, date, lignes par référence, cartons, testers, CA, cadeaux. C'est la source d'origine des factures du dashboard. |
| `donnees_sources/FACTURES_DUBAI.md` | Version côté Dubaï des factures NB Evolution, au prix plein, avec la correspondance vers les numéros EJ. Ce fichier sert à d'autres dashboards ; il est fourni pour référence. |
| `donnees_sources/REGLES_TARIFAIRES.md` | Prix standard par collection et règles sur les testers. |
| `donnees_sources/CATALOGUE_REFERENCES.md` | Liste officielle des références par collection. **Les noms doivent être orthographiés exactement comme dans ce fichier.** |
| `donnees_sources/STOCK_PRODUITS_FINIS.md`, `BRUMES_couleurs_reference.md` | Stock compté et couleurs des brumes. |
| `donnees_sources/Recap_Charges_2025.xlsx`, `2026.xlsx` | Relevés BRED catégorisés (feuille « Détail »), utilisés pour les charges et revenus. |
| `donnees_json/` | Export lisible de chaque bloc de données du HTML. **Lecture seule**, régénérable avec `outils/exporter_json.py`. Modifier ces fichiers ne change PAS le dashboard. |
| `outils/rebuild_dashboard.py` | Recalcule tous les agrégats à partir des factures. Voir plus bas. |
| `outils/exporter_json.py` | Régénère `donnees_json/` à partir du HTML. |

## Architecture du HTML

Les données sont des constantes JavaScript dans le `<script>` principal. Le blob `ALL` est minifié
sur une seule ligne et pèse environ 700 Ko : **pour le localiser, il faut équilibrer les accolades,
pas compter les numéros de ligne**. La fonction `find_blob()` de `outils/rebuild_dashboard.py` le fait.

| Constante | Contenu | Onglets concernés |
|---|---|---|
| `ALL` | Clés `2025`, `2026`, `total`, `costs`, `stock`, `stock_ref_date` | Vue d'ensemble, Clients, Pays, Mois, Références, Factures, Cadeaux, Évolution, Prix de revient, Stock, Compare 25 vs 26 |
| `CHARGES_DATA` / `REVENUE_DATA` | Dépenses et recettes BRED par catégorie, fournisseur et mois (montants des charges négatifs, revenus positifs) | KPI « Bénéfice société (réel) » et détails des charges |
| `SUPPLIER_INVOICES` | Factures fournisseurs restant à payer, par mois | 🧾 Factures fournisseurs |
| `PENDING_TRANSFERS` | Virements clients attendus (liste manuelle) | 💸 Virements en attente |
| `FIXED_CHARGES` | Charges mensuelles fixes et salaires (moyennes) | 📌 Charges fixes mensuelles |
| `INVENTAIRE_DATA` | Stock des composants et emballages | 🧰 Inventaire |
| `CADEAUX_UNIT_COST` (+ `_NEW`, `CADEAUX_*_DETAIL`) | Prix de revient unitaire des cadeaux (sacs, mouillettes, catalogues, échantillons 2 ml) | 🎁 Cadeaux offerts |
| `CARTON_INFO`, `PROD_COMPONENTS_PRICES` | Conditionnement et prix des composants | 🛒 Simulation, 🏭 Production |

Les onglets Simulation et Production enregistrent les saisies de l'utilisateur dans le `localStorage`
du navigateur, sous les clés `ej_simulation_data` et `productionData_v1`. Ces saisies ne sont pas dans le fichier.

Un sélecteur d'année (`currentYear` = `'2025'`, `'2026'` ou `'total'`) pilote presque tous les onglets.
Les onglets Fournisseurs, Virements et Charges fixes sont des instantanés : ils ne dépendent pas de l'année.

### Schéma de `ALL[annee]`

- Indicateurs : `kpi_ca`, `kpi_cout`, `kpi_marge`, `kpi_marge_pct_known`, `kpi_ca_known`, `kpi_ca_unknown` (toujours 0), `kpi_btl`, `kpi_testers`, `kpi_factures`, `kpi_clients`, `kpi_pays`, `kpi_refs`
- Tableaux dérivés : `clients`, `pays`, `pays_client`, `mois` (12 mois en français, y compris les mois à 0), `refs`, `collections`, `petits` (les 3 plus petits clients), `client_top_products` (clé `"client|pays"`), `predictions` et `insights` (seulement en 2026 et total)
- **`factures`** : c'est la **source de vérité**. Tout le reste en est dérivé.

Format d'une facture :
```json
{"facture":"EJ2026031","date":"18/09/2026","client":"NB Evolution (Luxe Cosmetics LLC)","pays":"Russie",
 "btl":7180,"ca":84755.2,"cout":47526.78,"marge":37228.42,
 "lines":[{"collection":"VIP","reference":"Moon","mode":"carton","cartons":16,"btl":160,"testers":16,
           "prix":123.0,"ca":1968.0,"cout":1116.03,"marge":851.97}],
 "cadeaux":[{"article":"Sacs noirs","quantite":50}]}
```
- `mode` : `carton`, `unite`, `service` ou `remise`. Une remise est une ligne de collection `REMISE` avec un `ca` négatif.
- `btl` = bouteilles **payées**. `testers` = bouteilles offertes, qui ne rapportent rien mais coûtent leur fabrication.
- `prix` = prix du carton (ou prix unitaire en mode `unite`).
- `cout` d'une ligne = coût de fabrication unitaire × (btl + testers). Le coût ne dépend que des quantités, jamais du prix de vente.
- `cadeaux` est facultatif : quand il n'y a pas de cadeau, on omet la clé (pas de tableau vide). Les cadeaux n'entrent pas dans le CA.
- La facture apparaît **à la fois** dans `ALL['2025' ou '2026'].factures` et dans `ALL.total.factures`. Le script de recalcul reconstruit `total` lui-même.

## ⚠️ Règles d'or

1. **Ne jamais corriger à la main un KPI ou un tableau dérivé** (clients, pays, mois, refs, collections, total, insights…).
   On modifie uniquement `ALL['2025'|'2026'].factures[]`, puis on lance le script de recalcul.
   Corriger à la main a déjà provoqué des totaux faux et des clients absents des tableaux.
2. Contrôle obligatoire : la somme du CA de `clients`, `pays`, `pays_client`, `mois`, `refs`, `collections` et `factures` doit être égale à `kpi_ca`, pour 2025, 2026 et total. Le script fait ce contrôle et refuse d'écrire s'il trouve un écart.
3. `factures[]` est trié **de la plus récente à la plus ancienne**, comme un relevé bancaire. Le script le fait automatiquement.
4. Les noms de référence doivent être identiques à `CATALOGUE_REFERENCES.md` (« Fruit d'Amour », pas « Fruits d'Amour »). Sinon le dashboard crée des doublons.
5. Avant toute modification, garder une sauvegarde. Le script crée automatiquement un fichier `.bak` quand on utilise `--write`.
6. Ne rien modifier en dehors du blob concerné : le HTML, le CSS et le JS des autres onglets doivent rester identiques octet pour octet.

## Ajouter une facture (procédure)

1. Ajouter la facture dans `donnees_sources/FACTURES_20XX.md`, sur le modèle des factures existantes.
2. Dans le HTML, extraire `ALL` (`find_blob(html, "ALL")`) et ajouter l'objet facture à `ALL['20XX'].factures`.
   - Prix : se référer à `REGLES_TARIFAIRES.md`. Les remises négociées sont fréquentes, notamment −10 %, −14 % ou −18 % pour NB Evolution. **Demander le prix plutôt que de le deviner.**
   - Testers : en général 1 par carton. **Exception : 2 testers par carton pour les BRUMES vendues en Russie.** Pour le 50ML, le nombre de bouteilles payées par carton a varié (10, 11 ou 12) : **toujours demander**.
   - Coût par bouteille d'une référence : reprendre le ratio `cout/(btl+testers)` de la **dernière** facture qui contient cette référence, ou partir de `ALL.costs[collection].refs[].cost_per_bottle_fabrication`.
3. Réécrire le HTML, puis lancer :
   ```bash
   python3 outils/rebuild_dashboard.py dashboard_parfums_emmanuelle_jane.html            # vérification seule
   python3 outils/rebuild_dashboard.py dashboard_parfums_emmanuelle_jane.html --write    # recalcul + écriture
   ```
   Le script recalcule tous les KPI et tableaux pour 2025, 2026 et total, ainsi que les prédictions (date de référence = aujourd'hui, modifiable avec `--today JJ/MM/AAAA`) et les 5 insights.
4. Ouvrir le dashboard dans un navigateur pour vérifier qu'il n'y a pas d'erreur dans la console et que les chiffres ont bien changé.

## Modèle de coût (`ALL.costs`)

- Pour chaque collection : `components[]` (flacon, capot, étui, frette, jus…), `tester_ratio` (unités physiques ÷ unités vendues : VIP et VIP BLACK 11/10, ROYAL 14/13, BRUMES 24/23, 50ML 12/11), `transport_eur` (0,10 € par bouteille physique) et `goldrock_markup_eur` (+10 % sur flacon, capot, étui et frette, affiché comme une ligne « Goldrock » à part).
- `refs[].cost_per_bottle_fabrication` = coût brut d'une bouteille physique.
  `refs[].cost_per_bottle` = prix de revient par bouteille **vendue** = (fabrication + transport) × tester_ratio.
  **Attention :** si on ajoute un coût, il faut partir de `cost_per_bottle_fabrication`. Ne jamais remultiplier par le tester_ratio une valeur qui l'inclut déjà.
- ROYAL est « provisional » : il n'a pas de détail des composants, seulement un forfait `total_fixed`.
- Coût du jus : (concentration % × volume ml) × prix au kg ÷ 1000.
- Cadeaux : coût unitaire défini dans `CADEAUX_UNIT_COST`. Pour changer un prix, il suffit de modifier cette constante ; pas besoin de tout recalculer. L'onglet Cadeaux additionne aussi le coût de fabrication des testers.

## Particularités connues des données

- La facture **EJ2025037** est datée du 16/03/2026 mais se trouve dans `ALL['2025']`. Son numéro a été corrigé (EJ2026037 → EJ2025037), mais elle n'a pas été déplacée.
- Il reste une faute de frappe sur le numéro « EJ20250044 », qui devait probablement être « EJ2025004 ». Elle n'a pas été corrigée.
- Dans l'ancienne version, `collections` excluait parfois la ligne `REMISE`. Le script l'inclut pour que la somme des collections soit égale au CA. C'est un écart volontaire et minime.
- Collections hors parfum présentes dans les factures : `CONCENTRÉ` (vente de concentré en gros), `TRANSPORT`, `COFFRET`, `SERVICE`, `AVOIR`, `REMISE`.
- `CHARGES_DATA` et `REVENUE_DATA` datent de juillet 2026. Pour les mettre à jour, il faut reprendre les feuilles « Détail » des fichiers Recap_Charges, regrouper par catégorie, puis par fournisseur, puis par mois. Pour « Frais bancaires & financiers », regrouper par type d'opération.

## Mise en ligne

Le fichier est autonome : on peut l'ouvrir en local ou le déposer tel quel sur Netlify, GitHub Pages, etc.,
sous le nom `index.html`.
