// Configuration : Supabase + coordonnées des sociétés (voir SETUP-SUPABASE.md)
window.EJ_CONFIG = {
  SUPABASE_URL: "https://furirpuapaowduaqqpbo.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmlycHVhcGFvd2R1YXFxcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzI2NTcsImV4cCI6MjA5NjE0ODY1N30.jtwOnsCSt9_V2hoUQS7ULEot1pQy7qpIMDG66MGwjkM",
  requireAuth: false, // PHASE DEV : accès libre sans compte. Mettre true pour sécuriser (connexion obligatoire).
  fxUSDtoEUR: 0.92,   // taux de conversion par défaut : 1 $ = X € (modifiable dans Réglages)
  // Coordonnées légales des sociétés (en-tête des documents). Modifiables dans Réglages.
  societes: {
    BSD: {
      code:"BSD", label:"BSD (France)", devise:"EUR", symbole:"€", tvaDefault:"fr20", prefDev:"DEV", prefCmd:"BC", prefFac:"EJ",
      nom:"PARFUMS EMMANUELLE JANE", forme:"SARL au capital de 100 000 €",
      adresse:"3 rue Robespierre", cp_ville:"94500 Champigny-sur-Marne", pays:"France",
      ident:"SIRET 532 707 684 00025", tva:"FR49532707684", rcs:"RCS Créteil 532 707 684", ape:"46.49Z",
      email:"", tel:""
    },
    NB: {
      code:"NB", label:"NB Evolution (Émirats)", devise:"USD", symbole:"$", tvaDefault:"none", prefDev:"NBD", prefCmd:"NBC", prefFac:"NBF",
      nom:"NB EVOLUTION", forme:"", adresse:"Dubai Silicon Oasis — DDP Building, A1", cp_ville:"Dubaï", pays:"United Arab Emirates",
      ident:"License No. 30537", tva:"", rcs:"", ape:"", email:"", tel:""
    }
  }
};
