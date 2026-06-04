# 🔌 Brancher la sauvegarde en ligne + la connexion (Supabase)

Tant que ce n'est pas branché, l'outil fonctionne en **mode local** (les données restent
dans le navigateur de l'appareil utilisé). En branchant Supabase, tu obtiens :

- ✅ **Connexion** par email + mot de passe (tes données ne sont plus publiques)
- ✅ **Sauvegarde en ligne** : tes données te suivent sur tous tes appareils
- ✅ **Aucune perte** si tu changes d'ordinateur ou vides ton cache

> ⏱️ ~10 minutes. Aucune compétence technique requise, suis les étapes.

---

## Étape 1 — Créer un projet Supabase (gratuit)

1. Va sur **https://supabase.com** → *Start your project* → connecte-toi (GitHub ou email).
2. Clique **New project**, donne-lui un nom (ex. `emmanuelle-jane`), choisis une région
   (ex. *Europe West*), et un mot de passe de base de données (note-le, peu importe).
3. Attends ~1 min que le projet soit prêt.

## Étape 2 — Créer la table de données

1. Dans le menu de gauche, ouvre **SQL Editor** → *New query*.
2. Colle **tout** le bloc ci-dessous puis clique **Run** :

```sql
create table if not exists ej_data (
  user_id uuid references auth.users not null,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table ej_data enable row level security;

create policy "Données privées par utilisateur"
  on ej_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

(Sécurité : chaque utilisateur ne voit que **ses** données.)

## Étape 3 — Simplifier la connexion (optionnel mais conseillé)

Pour ne pas avoir à confirmer l'email à chaque compte :
- Menu **Authentication → Sign In / Providers → Email**
- Désactive **« Confirm email »** → *Save*.

(Sinon, après « Créer un compte », tu devras cliquer le lien reçu par email avant de te connecter.)

## Étape 4 — Récupérer tes 2 clés

1. Menu **Project Settings (⚙️) → API**.
2. Copie :
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - **anon public** (la longue clé `eyJ...`) — *c'est la clé publique, elle peut figurer dans le code sans danger.*

## Étape 5 — Coller les clés dans l'outil

Dans le fichier `index.html`, repère tout en haut (dans le `<head>`) la ligne :

```html
<script>window.EJ_CONFIG = { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" };</script>
```

Remplace par tes valeurs, par exemple :

```html
<script>window.EJ_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsIn..."
};</script>
```

Enregistre / pousse → Vercel redéploie. **Un écran de connexion apparaît** : clique
**« Créer un compte »** la 1re fois, puis connecte-toi. ✅

---

## Que se passe-t-il ensuite ?

- À la **connexion**, tes données en ligne sont chargées dans l'outil.
- À chaque **modification** (trésorerie, B2B, matières, catalogue…), c'est **sauvegardé
  automatiquement** dans ta base Supabase.
- Sur un **autre appareil**, connecte-toi avec le même compte → tu retrouves tout.

## Notes

- Les **chiffres de ventes** (CA, clients, factures) sont pour l'instant intégrés au fichier.
  L'étape suivante du projet sera de les faire **saisir directement** dans l'outil et de les
  stocker aussi dans Supabase (et donc de les protéger entièrement derrière la connexion).
- Le plan gratuit Supabase suffit largement pour démarrer.
