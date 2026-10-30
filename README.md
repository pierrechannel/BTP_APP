# Chantier Backend

Backend Django/DRF pour l'application de gestion de chantiers BTP "Chantier".

Guide des formulaires, présences, habilitations, commandes, rapports et archives :
[Guide utilisateur](GUIDE_UTILISATEUR.md).

## Demarrage local

Le developpement local utilise SQLite par defaut.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8005
```

Tests:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.dev.txt
.\.venv\Scripts\pytest
```

Frontend React admin:

```powershell
cd chantier_frontend
npm install
npm run dev
```

Tests frontend: `npm test` depuis `chantier_frontend`.

Couverture des fonctions backend, parcours commandes/lignes et verification UI:
[audit backend/frontend](chantier_frontend/docs/backend-frontend-coverage.md).

## Espace de travail et parcours metier

- Tableau de bord calcule par le serveur sur toutes les donnees, filtre par chantier,
  avec indicateurs limites aux modules autorises pour l'utilisateur.
- Listes avec recherche, pagination par curseur, vues cartes/tableau et filtres.
- Formulaires de creation et modification construits a partir des contraintes de l'API;
  les relations proposent des noms lisibles, les fichiers sont envoyes en multipart.
- Planning: creation, dependances, modification de l'avancement et transitions coherentes.
- Journal: brouillon, soumission et validation; une piece validee n'est plus modifiable.
- Budget: calcul du TTC cote serveur; validation des depenses et cycle des factures
  brouillon -> validee -> payee. Les montants d'une depense doivent utiliser la devise
  de sa ligne budgetaire; aucune conversion implicite n'est effectuee.
- Stocks: registre immuable d'entrees/sorties/transferts, soldes par depot et refus des
  sorties qui rendraient le stock negatif. Une correction utilise un mouvement inverse.
- QHSE: les inspections reprennent les points de controle de leur modele; la checklist
  et les observations sont enregistrables, puis le score est calcule a la cloture.
- Documents: dossiers, versions, upload, approbations et telechargements authentifies.
- Notifications: lecture des notifications personnelles et marquage comme lues.
- Console plateforme: compteurs globaux, controle reel de la connexion a la base,
  suivi des files et choix de l'entreprise pour les listes utilisateurs/audit.

Le proxy Vite laisse passer les requetes OPTIONS vers Django (`server.cors = false`):
elles fournissent les metadonnees des formulaires. Le navigateur contacte `/api`
sur la meme origine que l'interface, sans dependance a un port CORS particulier.

Le frontend est disponible sur `http://127.0.0.1:5175`. Son proxy `/api` contacte
le backend sur `http://127.0.0.1:8005`. Ces ports evitent les autres services locaux.
En production, configurer le reverse proxy `/api` ou `VITE_API_BASE_URL` au moment du build.

Compte demo cree par `seed_demo`:

- email: `admin@chantier.local`
- mot de passe: `ChangeMe123!`
- tenant: `Demo Burundi BTP`

API:

- `GET /api/v1/auth/me/`
- `POST /api/v1/auth/token/`
- `POST /api/v1/auth/token/refresh/`
- `POST /api/v1/auth/token/blacklist/`
- `/api/v1/projects/`
- `/api/docs/`

## Production

Installer les dependances production avec PostgreSQL:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.prod.txt
```

Puis configurer `DATABASE_URL` avec une URL PostgreSQL.

## Corrections et contrats de securite

La console plateforme gere les entreprises et comptes via `/api/v1/auth/platform/tenants/`
et `/api/v1/auth/platform/users/`, reserves aux superadministrateurs. Les acces aux
entreprises et roles s'administrent via `platform/memberships/` et `platform/roles/`.
Ces endpoints ne dependent pas de l'entreprise active. Les listes sont paginees cote
serveur ; les changements sont journalises dans `platform/audit/`. La desactivation
d'un compte est globale ; suspendre une adhesion ne retire que l'acces a son entreprise.

- Les modifications des comptes utilisateurs globaux sont reservees au superadministrateur.
  Les administrateurs d'entreprise gerent les roles et adhesions de leur entreprise.
- Les suppressions des ressources metier utilisent `deleted_at`; les references vers une
  ressource supprimee sont refusees. Les descendants lies par CASCADE sont egalement
  marques comme supprimes, sans effacer leurs donnees. Les comptes, roles et adhesions ne sont pas des
  ressources metier et gardent leur comportement de suppression propre.
- Les reponses detaillees versionnees exposent `version` et `ETag`. Pour eviter d'ecraser
  une modification faite depuis la lecture, envoyer `If-Match: "<version>"` sur PATCH,
  PUT, DELETE et les actions POST de detail. Une version obsolete renvoie HTTP 409.
  L'en-tete reste facultatif pour les anciens clients; ceux-ci ne beneficient pas de
  la detection des modifications intervenues depuis leur derniere lecture.
- Les actions d'approbation exigent la permission `validate`, distincte de `crud`.
  Les workflows ne peuvent etre decides qu'une fois, par le reviseur designe.
- Les depenses et factures validees ou payees, ainsi que les pointages valides,
  ne peuvent pas etre supprimes, meme par suppression de leur chantier ou parent.
- La devise d'un budget avec des lignes, ou d'une ligne avec des depenses, est
  verrouillee, y compris lorsque ces enfants ont ete supprimes logiquement.
- Les pointages cumules d'un travailleur sont limites a 24 heures par jour sur
  tous les chantiers. Les taux horaires sont positifs ou nuls; les certifications
  sont valides entre leur delivrance et leur expiration, bornes incluses.
- Les verrous d'ecriture du tenant sont acquis apres authentification et controle
  des permissions de la vue. Les ecritures d'un meme tenant restent serialisees
  pour proteger les validations de graphes et les totaux en concurrence PostgreSQL.
- Un document partage par ACL est limite aux utilisateurs/roles autorises. Sans ACL,
  les permissions ordinaires du module s'appliquent. Le droit `read_shared` exige
  toujours un partage explicite. Proprietaire et administrateur conservent leur acces.
- Telecharger les fichiers par les endpoints authentifies
  `/api/v1/documents/versions/<id>/download/` et
  `/api/v1/reports/runs/<id>/download/`. Ne pas exposer directement le repertoire
  `media` ou le bucket prive sur un serveur web public.

### Synchronisation

POST `/api/v1/sync/mutations/` enregistre une mutation immuable. Un nouvel envoi du
meme `client_mutation_id` et du meme contenu renvoie la mutation existante; un contenu
different renvoie HTTP 409. POST `/<id>/mark-applied/` applique effectivement la mutation
et peut etre repete sans reappliquer les changements.

Ressources prises en charge: `planning.task` et `progress.daily_report`.
Operations: `create`, `update`, `upsert`, `delete`. Les modifications et suppressions
exigent `payload.expected_version`; les conflits renvoient HTTP 409. Les permissions
du module cible sont verifiees, en plus de celles du module sync. Les autres types
de ressources sont refuses explicitement.

### Rapports et execution

Les rapports generent un PDF A4 cote Django avec ReportLab (synthese, planning,
finances par devise, incidents, actions correctives et observations), avec pagination.
Le parametre optionnel `project` est un code projet ; `start_date`, `end_date` et
`observations` permettent de preciser le contenu. Le frontend affiche le PDF et le
telecharge via l'endpoint authentifie. Les anciens fichiers HTML/JSON restent lisibles
ou telechargeables ; une nouvelle generation produit toujours un PDF.
La generation est synchrone en local. En production, utiliser les settings dedies et
demarrer le worker depuis `chantier_backend`:

```powershell
$env:DJANGO_SETTINGS_MODULE = "config.settings.production"
celery -A config.celery:app worker --loglevel=info
```

La production exige une cle `DJANGO_SECRET_KEY` aleatoire d'au moins 32 caracteres,
`DJANGO_ALLOWED_HOSTS`, PostgreSQL et Redis. HTTPS est obligatoire. Appliquer les
migrations avec `python manage.py migrate --settings=config.settings.production`.

Les WebSockets et la facturation SaaS restent des fonctionnalites a developper;
leur presence dans la configuration ou dans un ecran ne constitue pas une integration.
