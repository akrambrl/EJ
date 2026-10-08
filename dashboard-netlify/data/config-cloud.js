// Partage en ligne des données de l'équipe (js/cloud.js). Projet Supabase déjà utilisé par la version à la racine du dépôt.
// La clé « anon » est publique par conception : la sécurité vient des règles de la table (voir PARTAGE-SUPABASE.md).
// Laisser url vide pour rester en mode local. obligatoire: true = connexion exigée à l'ouverture.
window.EJ_CLOUD_CONFIG = {
  url: "https://furirpuapaowduaqqpbo.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1cmlycHVhcGFvd2R1YXFxcGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzI2NTcsImV4cCI6MjA5NjE0ODY1N30.jtwOnsCSt9_V2hoUQS7ULEot1pQy7qpIMDG66MGwjkM",
  table: "ej_partage",
  obligatoire: false
};
