# Données sources (dossier de travail de l'ami)

Documents de référence venant du dossier de travail d'origine du dashboard.
Tous ont été comparés aux données de `dashboard-netlify/` (voir « Écarts constatés » plus bas).
Le guide d'origine est dans [`dashboard-netlify/CLAUDE.md`](../dashboard-netlify/CLAUDE.md).

| Fichier | Contenu | Correspondance dans le dashboard |
|---|---|---|
| `REGLES_TARIFAIRES.md` | Prix carton / bouteille et testers offerts par collection (+ exception BRUMES Russie) | `CARTON_INFO` dans `dashboard-netlify/js/app.js` |
| `STOCK_PRODUITS_FINIS.md` | Stock produits finis au 31/07/2026 par référence | `ALL.stock` dans `dashboard-netlify/data/ventes.js` (identique) |
| `BRUMES_couleurs_reference.md` | Couleurs des flacons BRUMES (codes hex), capots, familles olfactives | — (référence visuelle) |
| `Recap_Charges_2025.xlsx` | Relevé BRED 2025 classé par catégorie (1 396 opérations) | `dashboard-netlify/data/charges.js` 2025 (totaux identiques à l'euro près) |
| `FACTURES_2025.md`, `FACTURES_2026.md` | Registre manuel des factures clients (lignes, cartons, testers, CA, cadeaux) | `ALL[année].factures` |
| `FACTURES_DUBAI.md` | Contrepartie Dubaï (NB…) des factures NB Evolution, au prix plein, avec correspondance vers les n° EJ | voir écart n° 1 |
| `CATALOGUE_REFERENCES.md` | Orthographe officielle des références par collection | noms des `lines[].reference` |
| `Recap_Charges_2026.xlsx` | Relevé BRED 2026 (02/01 → 10/07/2026) classé par catégorie | `dashboard-netlify/data/charges.js` 2026 |
| `Catalogue_EJ.pdf` | Catalogue commercial (40 pages, Gotham / Proxima Nova, crème / or / noir) | Références : voir « Catalogue vs dashboard » ; charte reprise par le dashboard |
| `modeles_factures/` | Factures réelles servant de modèle : BSD EJ2026029 (Arzum), proforma NB2026012 (Oud House), proforma BSD EJ2025026 (NPJ Trading, photo) | Mise en page, coordonnées, banques et codes EAN des documents |
| `etiquettes/` | Planches d'étiquettes VIP Black 90 ml (11 réf.) et 50 ml (6 réf.) du 20/05/2026 : noms, notes, ingrédients, codes-barres | Codes EAN de `dashboard-netlify/js/societes.js` |
| `LISEZ-MOI.txt` | Mode d'emploi du dossier d'origine | — |

## Écarts constatés (07/10/2026) — non corrigés

1. **[Expliqué]** Ce n'est pas une erreur : le dashboard est la vue consolidée du groupe (BSD + NB Evolution).
   Les factures EJ du registre sont les ventes internes BSD → NB, désormais dans `dashboard-netlify/data/intragroupe.js`
   (vue BSD). Détail d'origine : **Factures NB Evolution au prix plein Dubaï.** Pour 18 commandes NB Evolution, le dashboard
   contient la version Dubaï (n° `NB…`, prix plein) au lieu de la version EJ du registre (n° `EJ…`,
   prix négocié −10 % à −18 %). Écart cumulé : **+224 753,60 € de CA** dans le dashboard
   (1 616 840,60 € contre 1 392 087,00 €). Le `CLAUDE.md` d'origine indique pourtant que
   `FACTURES_DUBAI.md` « sert à d'autres dashboards » (et son exemple EJ2026031 = 84 755,20 €,
   alors que le dashboard a NB2026009 = 103 360 €). À trancher avec l'auteur avant de corriger.
2. **Montants alignés sur l'encaissement réel** (le dashboard concorde avec les relevés bancaires,
   le registre est resté sur le montant facturé) : EJ2026007 (registre 1 432 € / dashboard 1 729 €),
   EJ2026018 (10 987 € / 10 142 €), EJ2026019 (1 583 € / 2 095 €), EJ2026022 (400 € / 467,99 €).
3. **Numérotation** : la vente PARFUM GLOBAL TRADE du 30/07/2026 (1 200 €) est `FR2026001` dans le
   registre et `EJ2026030` dans le dashboard.
4. **Factures présentes seulement dans le dashboard** : FA20260001 à FA20260004 (Jade Création),
   EJ2026012, EJ2026014, EJ2026017, EJ2026024 (avoir −1 512 €), EJ2026030.
5. **Charges 2026** : 3 catégories diffèrent légèrement entre `Recap_Charges_2026.xlsx` et le
   dashboard (Voyages −10 275,06 € / −11 235,15 € ; Téléphone −7 501,73 € / −7 509,72 € ;
   Fournitures −3 670,72 € / −3 677,71 €), probablement des opérations reclassées.

## Catalogue vs dashboard (07/10/2026)

Les **54 références** du catalogue (VIP 14, VIP Black 90 ml 11, VIP Black 50 ml 8, Brumes 15, Royal 6)
sont toutes présentes dans le dashboard. Seules l'orthographe diffère (le dashboard suit `CATALOGUE_REFERENCES.md`,
qu'il ne faut pas changer sans tout renommer, sinon doublons) :

| Collection | Catalogue PDF | Dashboard / CATALOGUE_REFERENCES.md |
|---|---|---|
| BRUMES | Butterfly **Garden** | Butterfly **Bloom** |
| BRUMES | Rose **Petals** | Rose **Pétale** |
| VIP BLACK | Cœur de **Sablé** | Cœur de **Sable** |
| VIP | Élixir | Elixir |
| VIP BLACK | Eclat Vert | Éclat Vert |
| 50ML | Vetiver | Vétiver |

Le catalogue appelle la collection 50ML « VIP Black 50 ml ». La seule « référence » en plus dans le dashboard
est « Lot de brumes (vente en lot) » (facture EJ2026030), qui n'est pas un produit.

## Points relevés sur les factures modèles (07/10/2026)

- **EAN Caramelia** : la proforma NB2026012 indique 3 760 120 372 826, qui n'est pas un EAN-13 valide (clé de
  contrôle). Le bon code est probablement 3 760 120 372 **9**26 — à vérifier avant de le saisir.
- **N° TVA de BSD** : la facture EJ2026029 indique « FR4953270768400025 » (SIRET complet). Le format officiel est
  **FR49532707684** (clé + SIREN), utilisé dans les documents du dashboard.
- **Testeurs BRUMES de la proforma NB2026012** : 15 références × 3 cartons, mais 42 testeurs comptés (45 attendus).
- **50 ml** : facturé 10 flacons à 130 € le carton sur EJ2026029, contre 11 flacons à 143 € dans les règles tarifaires
  (le nombre de flacons par carton est modifiable sur chaque ligne).

## Étiquettes et proforma EJ2025026 (08/10/2026)

- **Tous les produits** des planches d'étiquettes (VIP Black 90 ml : 11 ; 50 ml : 6) et de la proforma EJ2025026
  (VIP : 13 ; Brumes : 11 ; Royal : 6) sont dans le dashboard, avec la même orthographe (les étiquettes écrivent
  « COEUR DE SABLE », sans accent sur le E final, comme le dashboard).
- **Codes EAN** : 8 codes ajoutés grâce aux étiquettes (Éclat Vert, Cœur de Sable, Sublime, Ciel Blanc, Jardin Royal,
  Blais, Vétiver, Wild Cherry), tous valides. Les 54 références ont maintenant un code, sauf Caramelia (cf. plus haut).
- **Brumes : deux formats, deux codes EAN.** La proforma 2025 liste les brumes en **265 ml** avec des codes
  3 760 120 37x xxx différents de ceux du format **250 ml** (proforma NB2026012). L'inventaire contient bien des
  flacons des deux formats. Dans « Devis & Factures », chaque ligne de brume a un choix 250 ml / 265 ml qui met
  le bon code. Codes 265 ml connus pour 11 brumes (pas Vanilla Desire, Caramelia, Fruit d'Amour, Rose Pétale).
- **EJ2025026 (NPJ Trading, 10/07/2025)** : mêmes quantités que la facture du dashboard (4 cartons par référence),
  mais la proforma est au tarif **18 € / 4,90 € / 10,80 €** (VIP / Brumes / Royal) = **17 688,40 €**, alors que le
  dashboard et le registre comptent le tarif standard 16 € / 4 € / 9 € = **15 176,00 €** (écart 2 512,40 €).
  Par ailleurs, `REVENUE_DATA` ne montre que 874 € reçus de NPJ en 2025. À vérifier : montant réellement facturé
  et encaissé.
- **Concentration** : le catalogue présente Harmonie et Miel Royal comme des « Extrait de Parfum », mais leurs
  étiquettes indiquent « EAU DE PARFUM » (comme les 9 autres VIP Black). Les 50 ml sont bien « Extrait de Parfum ».
- **Contenance en onces** : les étiquettes 90 ml portent « 3.16 » ; 90 ml correspondent à 3,04 fl oz US
  (3,17 fl oz impériales). Les 50 ml ont été corrigées de 1.69 à 1.70 fl oz (en rouge sur la planche).
