# Securite et multi-tenant

## Modele multi-tenant v1

Modele retenu pour la v1:

- base partagee;
- schema partage;
- colonne `tenant_id` sur toutes les donnees metier;
- contexte tenant resolu par middleware;
- managers/querysets filtres par tenant;
- tests automatiques d'isolation.

Evolution possible:

- Row-Level Security PostgreSQL en defense en profondeur;
- schemas separes;
- base dediee pour grands comptes.

## Regles d'isolation

- Aucune requete ne retourne de donnees d'un autre tenant.
- Aucune mutation ne peut rattacher une ressource a un tenant non courant.
- Les foreign keys entre objets tenant doivent pointer vers le meme tenant.
- Les permissions projet limitent l'acces au perimetre affecte.
- En cas d'acces a une ressource hors tenant, repondre `404` pour ne pas reveler son existence.

## Permissions

Roles metier:

- Admin tenant;
- Conducteur de travaux;
- Chef de chantier;
- Ouvrier;
- Client;
- Sous-traitant;
- Super-admin plateforme, hors roles metier tenant.

Les permissions doivent etre declaratives:

```text
role x resource x action x scope
```

Scopes recommandes:

- tenant;
- chantier;
- lot;
- own;
- read_only;
- shared_documents.

Les checks doivent vivre cote API et etre reutilisables par DRF, services, taches Celery et WebSockets.

## Authentification

Exigences:

- email + mot de passe;
- longueur minimale 12;
- blocage temporaire apres echecs repetes;
- reset par lien a usage unique et duree limitee;
- JWT court + refresh token avec rotation;
- blacklist a la deconnexion;
- 2FA TOTP configurable, obligatoire possible pour Admin;
- audit des connexions, echecs et changements de droits.

## Audit

Journaliser:

- connexion reussie et echouee;
- invitation et changement de role;
- changement de tenant courant;
- acces refuse significatif;
- validation financiere;
- suppression ou archivage;
- generation d'URL de fichier sensible.

Chaque entree d'audit doit contenir:

- tenant;
- utilisateur;
- action;
- ressource;
- identifiant de ressource;
- adresse IP si disponible;
- user agent;
- correlation id;
- horodatage UTC.

## Fichiers et documents

- Analyser les fichiers avec antivirus avant mise a disposition.
- Verifier les permissions avant toute URL signee.
- Utiliser des URLs expirantes.
- Masquer les chemins internes.
- Versionner les documents.
- Conserver l'historique des validations.

## Donnees personnelles et RGPD

Prevoir:

- export des donnees personnelles;
- rectification;
- suppression ou anonymisation quand possible;
- consentement explicite pour geolocalisation;
- consentement et information pour photos identifiantes;
- retention configurable;
- masquage des donnees personnelles dans les logs;
- procedure de notification de violation de donnees.

## Headers et durcissement

Configurer:

- CORS restrictif;
- CSRF si cookies utilises;
- `X-Content-Type-Options`;
- `X-Frame-Options` ou `frame-ancestors`;
- `Referrer-Policy`;
- HTTPS obligatoire en production;
- secrets via variables d'environnement;
- rate limiting sur auth et endpoints sensibles.
