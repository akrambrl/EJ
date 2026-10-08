# Partager le dashboard entre Nassim, Mounir et Natali (Supabase)

Sans ce réglage, chaque personne garde ses saisies dans son navigateur : devis et factures créés, journal, espaces Équipe, trésorerie, fiches clients, etc.
Une fois branché, tout le monde se connecte avec son e-mail et voit les mêmes données sur ordinateur et sur téléphone.

Le projet Supabase est celui déjà utilisé par la version à la racine du dépôt (`js/config.js`). Son adresse et sa clé publique sont déjà dans
`dashboard-netlify/data/config-cloud.js`. Il reste à créer la table et les comptes, une seule fois (environ 10 minutes).

## 1. Créer la table partagée

Supabase → votre projet → **SQL Editor** → *New query*. Collez tout le bloc ci-dessous, **remplacez les 3 e-mails**, puis **Run** :

```sql
-- Données partagées de l'équipe : une ligne par bloc de données (documents, journal, registres…)
create table if not exists ej_partage (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- La date de mise à jour est donnée par le serveur (indépendante de l'horloge des appareils)
create or replace function ej_partage_maj() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists ej_partage_maj on ej_partage;
create trigger ej_partage_maj before insert or update on ej_partage for each row execute function ej_partage_maj();

-- Liste des personnes autorisées
create table if not exists ej_membres (email text primary key);
insert into ej_membres (email) values
  ('nassim@emmanuellejane.com'),
  ('mounir@exemple.com'),
  ('natali@exemple.com')
on conflict do nothing;

-- Vrai si la personne connectée fait partie de l'équipe
create or replace function ej_est_membre() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ej_membres where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table ej_partage enable row level security;
alter table ej_membres enable row level security;   -- aucune règle : invisible depuis le dashboard

create policy "equipe lit"      on ej_partage for select to authenticated using (ej_est_membre());
create policy "equipe ajoute"   on ej_partage for insert to authenticated with check (ej_est_membre());
create policy "equipe modifie"  on ej_partage for update to authenticated using (ej_est_membre()) with check (ej_est_membre());
create policy "equipe supprime" on ej_partage for delete to authenticated using (ej_est_membre());
```

## 2. Créer les comptes

1. **Authentication → Users → Add user → Create new user** : e-mail et mot de passe pour chaque personne (cocher *Auto Confirm User*).
2. **Authentication → Sign In / Providers** : désactiver **Allow new users to sign up**, pour que personne d'autre ne puisse créer de compte.

Pour ajouter ou retirer quelqu'un plus tard : ajouter ou supprimer son e-mail dans la table `ej_membres` (Table Editor).

## 3. Se connecter

En bas du menu du dashboard : **Se connecter pour partager**. À la première connexion, les saisies déjà faites sur cet appareil sont envoyées en ligne.
Ensuite, chaque modification part automatiquement. Les changements faits par les autres arrivent dans la minute (bandeau « Données mises à jour — Actualiser »).

Pour obliger tout le monde à se connecter : `obligatoire: true` dans `dashboard-netlify/data/config-cloud.js`, puis reconstruire le fichier Netlify.

## Ce qui est partagé

Devis, proformas, factures, avoirs et bons de livraison créés dans le dashboard, réglages des documents, journal de bord, espaces Équipe,
salons ajoutés, production, grille du simulateur d'offres, et toutes les pages de gestion (trésorerie, créances, échéances fiscales, objectifs,
fiches clients, prospects, commandes fournisseurs, expéditions, conformité).
Restent propres à chaque appareil : l'affichage (menu, blocs repliés), les caches d'actualités, la simulation de commande.

Si deux personnes modifient le même bloc au même moment, la dernière modification enregistrée l'emporte.
