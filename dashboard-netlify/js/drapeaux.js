/* Drapeaux des pays (emoji) : drapeau('Sénégal') → '🇸🇳 '. Noms tels qu'écrits dans les factures (français), plus quelques variantes.
   Rien si le pays est inconnu. Sur Windows, les drapeaux emoji s'affichent en lettres (ex. « SN ») : c'est une limite de Windows. */
(function(){
  const ISO = {
    'france':'FR', 'algerie':'DZ', 'angleterre':'GB', 'royaume uni':'GB', 'royaume-uni':'GB', 'uk':'GB', 'arabie saoudite':'SA', 'azerbaidjan':'AZ',
    'chypre':'CY', 'danemark':'DK', 'espagne':'ES', 'irak':'IQ', 'italie':'IT', 'lituanie':'LT', 'malte':'MT', 'nigeria':'NG', 'pays-bas':'NL', 'pays bas':'NL',
    'pologne':'PL', 'qatar':'QA', 'russie':'RU', 'senegal':'SN', 'usa':'US', 'etats-unis':'US', 'etats unis':'US', 'vietnam':'VN', 'viet nam':'VN',
    'emirats arabes unis':'AE', 'eau':'AE', 'dubai':'AE', 'israel':'IL', 'maroc':'MA', 'tunisie':'TN', 'liban':'LB', 'koweit':'KW', 'bahrein':'BH', 'oman':'OM',
    'jordanie':'JO', 'egypte':'EG', 'turquie':'TR', 'allemagne':'DE', 'belgique':'BE', 'suisse':'CH', 'portugal':'PT', 'grece':'GR', 'autriche':'AT',
    'irlande':'IE', 'suede':'SE', 'norvege':'NO', 'finlande':'FI', 'roumanie':'RO', 'bulgarie':'BG', 'hongrie':'HU', 'tchequie':'CZ', 'republique tcheque':'CZ',
    'ukraine':'UA', 'georgie':'GE', 'armenie':'AM', 'kazakhstan':'KZ', 'ouzbekistan':'UZ', 'chine':'CN', 'hong kong':'HK', 'japon':'JP', 'coree du sud':'KR',
    'inde':'IN', 'pakistan':'PK', 'indonesie':'ID', 'malaisie':'MY', 'singapour':'SG', 'thailande':'TH', 'canada':'CA', 'mexique':'MX', 'bresil':'BR',
    'cote d\'ivoire':'CI', 'cote divoire':'CI', 'cameroun':'CM', 'gabon':'GA', 'mali':'ML', 'ghana':'GH', 'afrique du sud':'ZA', 'kenya':'KE', 'libye':'LY', 'iran':'IR', 'syrie':'SY'
  };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’]/g, "'").trim();
  window.codePays = pays => ISO[norm(pays)] || '';   // code pays ISO (FR, QA…), utilisé par l'export facturation électronique
  window.drapeau = function(pays){
    const c = ISO[norm(pays)]; if(!c) return '';
    return String.fromCodePoint(...[...c].map(x => 0x1F1E6 + x.charCodeAt(0) - 65)) + ' ';
  };
})();
