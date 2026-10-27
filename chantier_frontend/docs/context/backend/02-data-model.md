# Modele de donnees backend

## Principes communs

Toutes les donnees metier doivent suivre ces conventions:

- cle primaire `UUID`;
- colonne `tenant_id` obligatoire, sauf donnees globales explicitement partagees;
- `created_at`, `updated_at` en UTC;
- `created_by`, `updated_by` quand l'action provient d'un utilisateur;
- `deleted_at` pour suppression logique;
- `version` entier pour concurrence optimiste;
- indexes composites commencant par `tenant_id` pour les filtres frequents.

## Base model recommandee

```python
class TenantOwnedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey("accounts.Tenant", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    deleted_at = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True
```

## Relations cles

- `Tenant` 1-N `Project`
- `Project` 1-N `Lot`
- `Lot` N-1 sous-traitant, represente par un tenant partenaire ou un fournisseur
- `Project` 1-N `Task`
- `Task` N-N `Task` via `TaskDependency`
- `Task` N-1 `Lot`
- `Project` 1-1 `Budget`
- `Budget` 1-N `BudgetLine`
- `Expense` N-1 `BudgetLine`
- `Worker` 1-N `TimeEntry`
- `Worker` N-N `Certification`
- `Equipment` N-N `Project` via `EquipmentAssignment`
- `DailyReport` 1-N `Photo`
- `Photo` N-1 `Task` optionnel
- `Document` 1-N `DocumentVersion`
- `Document` N-1 `Folder` N-1 `Project`

## Argent et devises

Regles obligatoires:

- utiliser `DecimalField`, jamais `FloatField`;
- stocker la devise d'origine sur chaque montant;
- stocker le taux applique et la date du taux quand une conversion est validee;
- conserver le montant converti dans la devise du tenant ou du chantier si necessaire pour les rapports;
- ne jamais recalculer silencieusement une ecriture deja validee avec un nouveau taux.

Format recommande:

```python
amount = models.DecimalField(max_digits=18, decimal_places=2)
currency = models.CharField(max_length=3)
exchange_rate = models.DecimalField(max_digits=18, decimal_places=8, null=True, blank=True)
converted_amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
converted_currency = models.CharField(max_length=3, blank=True)
```

## Fichiers

Les fichiers sont stockes dans S3/MinIO. La base conserve:

- chemin objet;
- nom original;
- type MIME;
- taille;
- hash;
- statut antivirus;
- createur;
- rattachement metier;
- niveau de confidentialite;
- version documentaire si applicable.

L'API ne doit jamais exposer directement un chemin S3 permanent. Elle genere une URL signee apres controle des permissions.

## Suppression et retention

- Les suppressions utilisateur sont logiques par defaut.
- Les donnees financieres validees sont immuables.
- Les documents et journaux d'audit suivent des politiques de retention parametrables par tenant.
- Les donnees personnelles doivent pouvoir etre exportees, anonymisees ou supprimees selon les obligations RGPD applicables.

## Donnees globales vs donnees tenant

Global:

- liste ISO des devises;
- pays et jours feries de reference;
- permissions systeme disponibles;
- templates fournis par la plateforme, si explicitement marques publics.

Tenant:

- utilisateurs et memberships;
- roles personnalises;
- chantiers;
- catalogues;
- budgets;
- stocks;
- documents;
- messages;
- rapports.
