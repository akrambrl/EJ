// Carnet d'adresses des clients, utilisé pour pré-remplir les devis, proformas et factures (onglet Devis & Factures).
// Les registres FACTURES_20XX.md ne contiennent pas les adresses : seules celles lues sur les factures réelles
// (donnees_sources/modeles_factures/) sont renseignées. Les autres se complètent dans l'onglet
// (Coordonnées › Adresses clients) ou ici. Format : "Nom exact du client": {pays, adresse (lignes séparées par \n), tvaClient}.
const CLIENTS = {
  "Arzum Group MMC": {pays:"Azerbaïdjan", adresse:"Gen. Shikhlinski 23/30\nAZ1015 Baku", tvaClient:""},
  "NPJ Trading Limited": {pays:"Angleterre", adresse:"The Little Barn, Network House, Bambers Green, Takeley\nBishop's Stortford CM22 6PF", tvaClient:"GB476837392"},
  "Oud House Ltd": {pays:"Israël", adresse:"Der El Assad\nPO Box 244", tvaClient:"515895978"},
  // Factures EJ2026019 et EJ2025048
  "MB Tressoria": {pays:"Lituanie", adresse:"MB TRESSORIA\nCompany code : 306718576\nJ. Tumo-Vaizganto g. 122A-2\nLT-2266 Taurage\nPhone : +37065514498\nEmail : a.preiksaityte@gmail.com", tvaClient:"LT100019677810"},
  "AL Muftah": {pays:"Qatar", adresse:"AL MUFTAH MARKETING AND SERVICES\nPO Box 875\nDoha", tvaClient:""},
  // Client de NB Evolution (facture NB2026008).
  "NB Evolution (Jamal)": {pays:"Irak", adresse:"JAMAL ALNAJAF COMPANY IRAQ\nNajaf City, Airport Street\nZip code 54001\nPhone number : 009647808714018", tvaClient:""},
  // Client de NB Evolution (proforma NB2026005). Sur les factures BSD → NB, l'acheteur reste NB Evolution (Dubaï) : voir clientInfo().
  "NB Evolution (Luxe Cosmetics LLC)": {pays:"Russie", adresse:"LUXE COSMETICS LLC\n119121, Moscow, lane 1st Truzhenikov, 12, building 2\nRussian Federation\nTaxpayer Identification number : 7734454177\nTax Registration Reason code : 770401001", tvaClient:""}
};
