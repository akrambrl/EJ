// Espaces personnels de l'équipe (rubrique « Équipe » du menu, js/equipe.js).
// Une fiche par salarié : rôle, missions (titre + responsabilités) et outils de suivi affichés.
// Outils disponibles : commercial (clients, relances, devis), pipeline (projets par étapes), pays (stratégie par marché),
// salons, decisions (journal des décisions), validations (commandes à valider, stock à répartir), actions (suivi d'actions).
// Les missions de Mounir et Natali sont à compléter (ici ou directement dans la page, bouton « Modifier les missions »).
const EQUIPE = [
  {id:'nassim', nom:'Nassim', role:'Direction · commercial, création & marketing', couleur:'#C9A456',
   missions:[
    {id:'commercial', titre:'Développement commercial & relation clients', outils:['commercial'], points:[
      'Gestion directe de la relation avec les clients et distributeurs',
      'Rendez-vous commerciaux et présentation des collections',
      'Négociation des prix, conditions commerciales et partenariats',
      'Développement de nouveaux clients et nouveaux marchés',
      'Suivi et fidélisation des clients existants',
      'Identification des besoins spécifiques de chaque marché',
      'Gestion des relations avec les distributeurs internationaux']},
    {id:'parfums', titre:'Création & développement des parfums', outils:['pipeline'],
     etapes:['Idée','Concentré / composition','Matières & profil olfactif','Nom','Validation finale','Lancé'], points:[
      'Sélection des nouveaux parfums à développer',
      'Travail sur les nouveaux concentrés et compositions',
      'Définition des orientations olfactives',
      'Sélection et validation des matières et des profils olfactifs',
      'Création et validation des noms des parfums',
      'Développement de nouvelles collections',
      'Validation finale des références avant lancement']},
    {id:'packaging', titre:'Création des flacons & packaging', outils:['pipeline'],
     etapes:['Concept','Formes, matières & finitions','Design flacon, capot, boîte','Prototype / échantillon','Validé'], points:[
      'Réflexion et création des nouveaux concepts de flacons',
      'Choix des formes, matières, couleurs et finitions',
      'Direction artistique des nouvelles collections',
      'Travail sur les designs de flacons, capots, boîtes et packagings',
      'Validation finale des prototypes et échantillons']},
    {id:'marketing', titre:'Stratégie marketing internationale', outils:['pays','salons'], points:[
      'Définition de la stratégie marketing globale de la marque',
      'Élaboration d’une stratégie spécifique pour chaque pays',
      'Adaptation du positionnement selon les marchés',
      'Définition des campagnes et outils commerciaux',
      'Développement de l’image et du positionnement premium de la marque',
      'Définition des actions pour les salons, événements et lancements']},
    {id:'direction', titre:'Direction & décisions', outils:['validations','decisions'], points:[
      'Définition des priorités de l’entreprise',
      'Dispatching des quantités entre les différents clients',
      'Validation des commandes importantes',
      'Choix des nouveaux marchés à développer',
      'Choix des nouveaux produits et collections',
      'Supervision de Mounir et Natali',
      'Validation des décisions stratégiques, commerciales et créatives']}
   ]},
  {id:'mounir', nom:'Mounir', role:'Missions à renseigner', couleur:'#9FC3D9',
   missions:[
    {id:'missions', titre:'Missions de Mounir', outils:['actions'], points:['À compléter : cliquer sur « Modifier les missions »']}
   ]},
  {id:'natali', nom:'Natali', role:'Missions à renseigner', couleur:'#D7B6E0',
   missions:[
    {id:'missions', titre:'Missions de Natali', outils:['actions'], points:['À compléter : cliquer sur « Modifier les missions »']}
   ]}
];
