// Dépenses de NB Evolution (Dubaï) — même format que les fichiers de BSD :
//   FIXED_CHARGES_NB     ↔ data/charges-fixes.js          (charges fixes et salaires mensuels)
//   SUPPLIER_INVOICES_NB ↔ data/factures-fournisseurs.js  (factures fournisseurs à payer)
//   PENDING_TRANSFERS_NB ↔ data/virements-en-attente.js   (virements clients attendus)
// Les achats de NB Evolution auprès de BSD sont déjà comptés automatiquement (data/intragroupe.js).
// À compléter quand les relevés du compte WIO Bank seront disponibles.
const FIXED_CHARGES_NB = { updated: "", charges: [], salaires: [] };
const SUPPLIER_INVOICES_NB = { updated: "", soldes: [], total_eur: 0, total_goldrock_usd: 0, total_goldrock_eur: 0, months: [], goldrock: { status: "", lines: [] } };
const PENDING_TRANSFERS_NB = { updated: "", total: 0, items: [] };
