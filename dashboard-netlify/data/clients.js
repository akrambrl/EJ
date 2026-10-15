// Carnet d'adresses des clients, utilisé pour pré-remplir les devis, proformas et factures (onglet Devis & Factures).
// Les registres FACTURES_20XX.md ne contiennent pas les adresses : seules celles lues sur les factures réelles
// (donnees_sources/modeles_factures/) sont renseignées. Les autres se complètent dans l'onglet
// (Coordonnées › Adresses clients) ou ici. Format : "Nom exact du client": {pays, adresse (lignes séparées par \n), tvaClient, regime facultatif (export/intra/fr) si le pays ne suffit pas}.
const CLIENTS = {
  "Arzum Group MMC": {pays:"Azerbaïdjan", adresse:"Gen. Shikhlinski 23/30\nAZ1015 Baku", tvaClient:""},
  "NPJ Trading Limited": {pays:"Angleterre", adresse:"The Little Barn, Network House, Bambers Green, Takeley\nBishop's Stortford CM22 6PF", tvaClient:"GB476837392"},
  "Oud House Ltd": {pays:"Israël", adresse:"Der El Assad\nPO Box 244", tvaClient:"515895978"},
  // Fiche « Clients — informations complétées » du 15/10/2026
  "Passion Parfum": {pays:"Sénégal", adresse:"Passion Parfums – Parfum Trade Africa\nHLM 4\nDakar\nNINEA : 012582955", tvaClient:""},
  "PARFUM GLOBAL TRADE": {pays:"France", adresse:"7 rue Heurtault\n93300 Aubervilliers", tvaClient:""},
  "NB Evolution (GCC Partners)": {pays:"Émirats Arabes Unis", adresse:"Creative Tower, PO Box 4422\nFujairah\nUnited Arab Emirates", tvaClient:""},
  "STF Perfumeria": {pays:"Espagne", adresse:"STF Perfumería de Autor SL\nC/ Felipe de Sanclemente 8, esc. 1, planta 4\n50001 Zaragoza\nLivraison : Sergio Echevarría, Av. América 3, ppal izq., 50007 Zaragoza", tvaClient:"ESB26825893"},
  "JADE CREATION": {pays:"Algérie", adresse:"57A, Zone d'activité côté nouvelle zone urbaine\nBeni Merad / Blida 09003\nRC : 13B0987927-09/00 · NIF : 001316098792788", tvaClient:""},
  "FIRM RHEDS": {pays:"Pays-Bas", adresse:"Lommerbaan 127\n2728 JC Zoetermeer\nKvK : 68458983", tvaClient:"NL001715494B20"},
  "MR STEVE BEUSSE": {pays:"Vietnam", adresse:"Công ty CP Vimoximex Group\nSố 2 – 76/4 Phố Vĩnh Hưng, P. Vĩnh Hưng\nHà Nội", tvaClient:""},
  "ALFA GROUP SRLS": {pays:"Italie", adresse:"Viale Nicolò Biondo 22/C\n41012 Carpi (MO)", tvaClient:""},
  "Gazzaz": {pays:"Arabie Saoudite", adresse:"King Abdulaziz Street, Al Balad 16666\nJeddah 21474", tvaClient:""},
  "Chaloub Trading": {pays:"Nigéria", adresse:"Number 17, Block 30, Dutse PE Model Market\nBy Army Estate Extension 3, Kubwa\nAbuja", tvaClient:""},
  "Davidson Distributors LLC": {pays:"USA", adresse:"357 N Royal Poinciana Blvd, Suite 108\nMiami Springs, Florida 33166\nEIN : 33-4056670", tvaClient:""},
  // Girne (Chypre du Nord) : hors du territoire TVA de l'UE → traité comme un export, pas une livraison intracommunautaire
  "Mads Cosmetics": {pays:"Chypre", adresse:"Mads Cosmetics Ltd\nZiya Rızkı Street n°181\nGirne (Chypre du Nord)", tvaClient:"", regime:"export"},
  "Cielomed": {pays:"Malte", adresse:"Cielomed Enterprises Ltd\nTriq Tax-Xemx, Ul Qamar\nFgura FGR 1972", tvaClient:""},
  "Al Fawanis Company": {pays:"Arabie Saoudite", adresse:"Al Fawanis Company for Gifts & Perfumes\n4th floor, Al Musbah Building, Khaskia\nAl Balad District, Jeddah 22233", tvaClient:""},
  "Global Brands Distribution": {pays:"Belgique", adresse:"Drinkstraat 7\n2140 Borgerhout (Antwerpen)", tvaClient:"BE1000539954"},
  "Akkona": {pays:"Pologne", adresse:"Ul. Smocza 27\n01-048 Warszawa", tvaClient:"PL5213515794"},
  "Khiyat Cospara": {pays:"France", adresse:"14 rue de la Poterie\n77130 Montereau-Fault-Yonne", tvaClient:""},
  "Perfumeparadise Aps": {pays:"Danemark", adresse:"Buddinge Hovedgade 18, 2. tv\n2860 Søborg", tvaClient:""},
  "DV Menswear": {pays:"USA", adresse:"8101 Interstate 30\nLittle Rock, Arkansas 72209", tvaClient:""},
  // Factures EJ2026019 et EJ2025048
  "MB Tressoria": {pays:"Lituanie", adresse:"MB TRESSORIA\nCompany code : 306718576\nJ. Tumo-Vaizganto g. 122A-2\nLT-2266 Taurage\nPhone : +37065514498\nEmail : a.preiksaityte@gmail.com", tvaClient:"LT100019677810"},
  "AL Muftah": {pays:"Qatar", adresse:"AL MUFTAH MARKETING AND SERVICES\nPO Box 875\nDoha", tvaClient:""},
  // Client de NB Evolution (facture NB2026008).
  "NB Evolution (Jamal)": {pays:"Irak", adresse:"JAMAL ALNAJAF COMPANY IRAQ\nNajaf City, Airport Street\nZip code 54001\nPhone number : 009647808714018", tvaClient:""},
  // Client de NB Evolution (proforma NB2026005). Sur les factures BSD → NB, l'acheteur reste NB Evolution (Dubaï) : voir clientInfo().
  "NB Evolution (Luxe Cosmetics LLC)": {pays:"Russie", adresse:"LUXE COSMETICS LLC\n119121, Moscow, lane 1st Truzhenikov, 12, building 2\nRussian Federation\nTaxpayer Identification number : 7734454177\nTax Registration Reason code : 770401001", tvaClient:""}
};
