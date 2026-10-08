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
| `js/journal.js` | Page d'accueil « Journal de bord » : rappels automatiques (paiements clients, devis à relancer, fournisseurs, stock, inventaire mensuel, salons), routine jour / semaine / mois, tâches, notes et actualités de la parfumerie avec visuels : parfums de niche (marques suivies modifiables), nouveautés (Now Smell This, Nez, Bois de Jasmin), marché, Moyen-Orient… (Google Actualités et flux RSS via rss2json) ; saisies gardées dans le navigateur |
| `data/equipe.js`, `js/equipe.js` | Rubrique « Équipe » : un espace par salarié (Nassim, Mounir, Natali) avec ses missions, ses actions, et selon la mission : clients à relancer, nouveaux clients, devis en cours, projets parfums et flacons par étapes, stratégie par pays, salons, commandes à valider, stock à répartir, journal des décisions. Missions modifiables dans la page ; suivi gardé dans le navigateur (export / import JSON) |
| `js/plier.js` | Blocs repliables (appui sur le titre ; « Tout replier / déplier » par page), état gardé dans le navigateur ; sur mobile : blocs longs repliés par défaut, encadrés réduits à 2 lignes, 4 rappels visibles dans le journal |
| `js/registre.js` | Petits tableaux modifiables (registres) utilisés par les pages de gestion, gardés dans le navigateur (clés `ej_reg_…`), export CSV |
| `js/gestion.js` | Pages Trésorerie (prévision 6 mois, comptes, taux, import de relevés CSV), Créances clients (balance âgée, relances), Échéances fiscales (TVA, DSN, IS, CFE, comptes annuels, Émirats), Résultat & impôts, Objectifs & budget (objectifs, budget des charges, commissions), Fiches clients, Prospects, Approvisionnement (mois de stock, commandes fournisseurs), Expéditions, Conformité produits (CPNP, DIP, IFRA, FDS, enregistrements pays, lots) ; rappels pour le journal |
| `js/cloud.js`, `data/config-cloud.js` | Partage des saisies entre les membres de l'équipe via Supabase (connexion, envoi et réception automatiques). Mise en place : `PARTAGE-SUPABASE.md` à la racine |
| `js/theme.js` | Mode clair (beige, par défaut) / mode sombre : bouton soleil-lune dans l'en-tête, choix gardé sur l'appareil (`ej_theme`) ; couleurs dans les variables CSS (`:root` et `[data-theme="dark"]`) |
| `js/assistant.js` | Assistant (bouton doré en bas à droite) : réponses directes calculées sur les données (stock, factures, CA, clients, salons, créances, échéances, trésorerie, impôts, fournisseurs…) ; mode IA Claude facultatif avec une clé API Anthropic gardée dans le navigateur (modèle `claude-opus-5-5`, SDK `@anthropic-ai/sdk` via jsDelivr, outil `consulter_donnees`) |
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

## Mise en ligne protégée par mot de passe

```bash
python3 outils/construire_netlify.py --mot-de-passe "le mot de passe"     # ou variable EJ_MOT_DE_PASSE
```

Le fichier `netlify-deploy/index.html` est alors entièrement chiffré (AES-256-GCM, clé dérivée du mot de passe) : sans le mot de passe,
il ne contient aucune donnée lisible. Le navigateur le déchiffre après saisie du mot de passe (« Se souvenir de cet appareil » possible,
« Verrouiller cet appareil » en bas du menu). Ne jamais enregistrer le mot de passe dans le dépôt.

