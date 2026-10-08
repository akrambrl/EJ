// Carnet d'adresses des clients, utilisé pour pré-remplir les devis, proformas et factures (onglet Devis & Factures).
// Les registres FACTURES_20XX.md ne contiennent pas les adresses : seules celles lues sur les factures réelles
// (donnees_sources/modeles_factures/) sont renseignées. Les autres se complètent dans l'onglet
// (Coordonnées › Adresses clients) ou ici. Format : "Nom exact du client": {pays, adresse (lignes séparées par \n), tvaClient}.
const CLIENTS = {
  "Arzum Group MMC": {pays:"Azerbaïdjan", adresse:"Gen. Shikhlinski 23/30\nAZ1015 Baku", tvaClient:""},
  "NPJ Trading Limited": {pays:"Angleterre", adresse:"The Little Barn, Network House, Bambers Green, Takeley\nBishop's Stortford CM22 6PF", tvaClient:"GB476837392"},
  "Oud House Ltd": {pays:"Israël", adresse:"Der El Assad\nPO Box 244", tvaClient:"515895978"}
};
