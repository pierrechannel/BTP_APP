# Guide utilisateur — Gestion de chantier BTP

## 1. Se connecter et choisir son chantier

Connectez-vous avec le compte fourni par votre administrateur. Choisissez votre entreprise puis le chantier dans le sélecteur de l’espace de travail. Les listes et exports qui proposent un périmètre chantier suivent cette sélection. Choisissez tous les chantiers pour un document transversal.

Les boutons disponibles dépendent de votre rôle. Contactez votre administrateur si une opération nécessaire à votre travail n’est pas proposée.

Pour les présences, les bons de commande et le planning hebdomadaire, le bouton **Générer et visualiser le PDF** affiche le document dans une fenêtre d’aperçu. Vous pouvez ensuite **Télécharger le PDF**, l’**Ouvrir / imprimer**, ou **Modifier les paramètres** pour générer une autre édition.

### Vue d’ensemble d’un chantier

Ouvrez une fiche dans **Chantiers**. L’onglet **Vue d’ensemble** présente les indicateurs accessibles selon vos droits : avancement, tâches en retard, disponible budgétaire et incidents ouverts. Les alertes prioritaires proposent des liens vers les éléments à traiter. Les échéances sont calculées à la date de Bujumbura.

L’avancement correspond à la moyenne des tâches sans sous-tâches actives, hors tâches annulées et archivées. Les tâches terminées comptent pour 100 %. Cette moyenne n’est pas pondérée par durée ou coût ; sans tâche, l’indicateur affiche **Non renseigné**.

La situation financière distingue le montant du marché, le budget prévu, l’engagé (dépenses soumises), le consommé (validées et payées), le payé et le disponible. Les brouillons ne réduisent pas le disponible. L’activité récente affiche les rapports journaliers, photos et documents auxquels vous avez accès.

Les onglets **Lots**, **Données associées**, **Informations** et **Traçabilité** permettent de retrouver les autres données. L’onglet sélectionné est conservé dans l’adresse de la page, y compris après rechargement.

### Journal de chantier : rapports, photos et validation

La vue d’ensemble d’un rapport présente les travaux réalisés et les difficultés avant la galerie de photos. Les actions de soumission, correction, validation et téléchargement PDF sont regroupées en haut. La colonne de suivi affiche l’auteur et les dates à l’heure de Bujumbura. L’historique conserve chaque soumission, demande de correction avec son motif et validation. Pour les anciens rapports, seules les informations déjà enregistrées sont affichées ; les dates manquantes sont signalées.

Dans **Journal de chantier**, la liste chronologique propose une recherche et des filtres de période et de statut. Les indicateurs comptent les brouillons, rapports soumis et validés sur la période ; les réserves en retard sont calculées à ce jour pour le chantier sélectionné.

**Nouveau rapport** ouvre une page dédiée. Choisissez le chantier et la date, renseignez la météo, décrivez les travaux et les difficultés, puis ajoutez les photos du terrain (30 maximum, 10 Mo par photo). Les photos et leurs retraits sont sauvegardés avec le brouillon. Plusieurs rapports par chantier et par jour sont autorisés.

Depuis la fiche du rapport, **Soumettre** exige une description des travaux. Le rapport soumis et ses photos deviennent non modifiables. Un utilisateur habilité peut **Demander une correction**, avec un motif obligatoire : le rapport revient en brouillon. **Valider** protège le rapport et ses photos contre la modification et la suppression, y compris par suppression du chantier parent. La date et l’auteur de validation sont conservés. Un rapport validé ne revient pas en brouillon.

La galerie permet d’agrandir et de télécharger les photos. **Télécharger le PDF** exporte les observations, les informations de validation et les photos du rapport. Les accès dépendent des droits du module.

Dans **Relevés d’avancement**, le pourcentage doit être compris entre 0 et 100. Le relevé le plus récent par date met à jour la tâche du planning ; à date égale, le relevé créé le plus récemment est retenu. Un relevé historique ne remplace pas une mesure plus récente. La suppression d’un relevé recalcule l’avancement depuis le dernier relevé restant (0 % si aucun). Le rattachement d’un relevé existant à une autre tâche est interdit.

Dans **Réserves**, utilisez **Prendre en charge**, **Résoudre**, **Rouvrir** et **Clôturer** selon l’état. La résolution renseigne automatiquement sa date ; rouvrir la réserve efface cette date. Une réserve clôturée n’est plus modifiable.

## 2. Créer un collaborateur

1. Ouvrez **Collaborateurs**, puis **Créer**.
2. Renseignez le prénom, le nom, le poste, l’adresse, le téléphone et, selon vos besoins, la date de naissance et les références de la pièce d’identité.
3. Choisissez le mode de rémunération : horaire, journalier ou forfait mensuel.
4. Saisissez le tarif correspondant et sa devise. Un tarif journalier ou mensuel est obligatoire lorsque ce mode est choisi. Un tarif nul est accepté.
5. Vérifiez le récapitulatif puis enregistrez.

Les anciens collaborateurs conservent leur tarif horaire. Les tarifs décrivent le contrat : ils ne déclenchent pas automatiquement une paie. Lors d’un changement de mode, renseignez le nouveau tarif.

## 3. Pointages et fiches de présence

Dans les pointages, choisissez le collaborateur, le chantier, la tâche éventuelle, la date et les heures normales et supplémentaires. Le cumul sur une journée ne peut pas dépasser 24 heures, tous chantiers confondus. Un pointage validé n’est plus modifiable.

Depuis la liste **Pointages**, le bouton de création ouvre une feuille pour tout le chantier :

1. Choisissez le chantier et la date. Le personnel dont l’affectation couvre cette journée apparaît automatiquement, sans doublon d’affectation.
2. Complétez les heures normales et supplémentaires ligne par ligne, comme sur une feuille papier. La touche Tab permet de passer au champ suivant. Les heures déjà enregistrées sont reprises ; les pointages validés ou archivés restent en lecture seule. Plusieurs pointages sur des tâches différentes restent sur des lignes distinctes.
3. Utilisez la recherche pour retrouver un nom ou un métier. Les compteurs et le total portent sur la feuille entière.
4. Cliquez sur **Enregistrer le pointage**. Seules les lignes modifiées sont enregistrées ; une ligne laissée vide ne crée pas de pointage ni d’absence. Si une ligne est refusée, aucune des modifications n’est enregistrée.

Pour changer de chantier ou de date après une saisie, enregistrez ou cliquez sur **Annuler les saisies**. Fermer une feuille modifiée demande de confirmer l’abandon. L’enregistrement conserve les pointages en brouillon ; leur validation reste une action distincte. La création depuis une fiche de collaborateur ou de tâche et la modification d’un pointage conservent le formulaire individuel.

- Pour un collaborateur : ouvrez sa fiche et cliquez sur **Fiche de présence PDF**.
- Pour tous les collaborateurs actifs : dans leur liste, cliquez sur **Présences de tous · PDF**.
- Dans la fenêtre, renseignez éventuellement les dates de début et de fin puis cliquez sur **Générer le PDF**. Les bornes sont incluses.

Le backend génère une fiche par collaborateur avec les dates, chantiers, heures, validations, nombre de jours pointés et totaux d’heures. Le document contient les brouillons et les pointages validés, identifiés séparément. Un jour sans pointage ne prouve pas une absence. Les fiches ne calculent pas de salaire ni de retenue.

## 4. Comprendre les habilitations

Une **habilitation métier** atteste une qualification ou une autorisation : conduite d’engins, travail en hauteur, habilitation électrique, etc.

Créez d’abord le type de certification dans **Certifications**, puis associez-le au collaborateur dans **Habilitations**, avec les dates de délivrance et d’expiration. La date d’expiration doit suivre ou égaler la délivrance. Sans expiration, aucune date de fin n’est définie. La saisie sert au suivi des qualifications ; elle ne constitue pas à elle seule une autorisation réglementaire.

Les **droits d’accès à l’application** sont distincts : ils sont attribués aux utilisateurs par leur rôle dans l’entreprise. Ils déterminent qui peut consulter, créer, modifier, supprimer ou valider dans chaque module. Le droit de suppression permet également d’archiver et de restaurer. Les habilitations métier ne donnent aucun de ces droits.

## 5. Saisir une dépense avec plusieurs lignes

1. Ouvrez le budget puis créez une dépense sur la ligne budgétaire voulue.
2. Renseignez la date et le fournisseur. La devise suit la ligne budgétaire.
3. Dans **Détails de la dépense**, cliquez sur **Ajouter une ligne** pour chaque article ou prestation.
4. Pour chaque ligne, renseignez un libellé, une quantité strictement positive et un prix unitaire positif ou nul. Le bouton **Retirer** enlève la ligne du formulaire.
5. Avec des détails, le serveur calcule le montant HT à partir de la somme quantité × prix. La taxe saisie sur la dépense s’ajoute à ce total pour former le TTC. Le montant HT saisi manuellement est alors remplacé par le calcul des lignes.
6. Sans détail, saisissez directement le montant HT. Vérifiez puis enregistrez.

Le calcul s’effectue dans la devise de la dépense ; aucune conversion automatique n’est appliquée. Les dépenses validées ou payées restent protégées contre les modifications.

### Joindre et consulter les reçus

Sur une **facture**, la zone **Fichier de la facture** permet également de joindre un PDF ou une image (JPG, PNG, WebP), jusqu’à 10 Mo. Le fichier est sauvegardé avec le formulaire. Il peut être remplacé en brouillon, puis consulté ou téléchargé depuis la fiche de facture selon vos droits. Le fichier est facultatif.

Dans le formulaire de dépense, utilisez **Justificatifs → Ajouter des justificatifs**, puis sélectionnez un ou plusieurs reçus ou factures scannées. Les formats acceptés sont PDF, JPG, PNG et WebP, avec une limite de **10 Mo par fichier et 20 fichiers par dépense**.

Cliquez sur **Enregistrer le brouillon** pour sauvegarder les fichiers. Avant cet enregistrement, ils portent la mention **À enregistrer**. **Retirer** prépare le retrait d’un fichier ; **Annuler les retraits** permet de revenir sur ce choix. Les ajouts et retraits ne sont autorisés qu’en brouillon.

Sur la fiche de dépense, **Consulter** ouvre l’aperçu et **Télécharger** récupère le fichier. Ces actions restent disponibles après validation selon vos droits d’accès. L’ajout d’un reçu ne crée aucune dépense supplémentaire et ne marque pas la dépense comme payée.

Les justificatifs sont conservés dans le stockage privé `private_receipts/`, séparé des médias publics. Ce dossier doit être inclus dans les sauvegardes avec la base de données.

## 6. Générer un bon de commande

Dans **Ressources → Commandes**, créez la commande, choisissez le chantier et le fournisseur, puis ajoutez les matériaux, quantités et prix dans ses lignes. Ouvrez la fiche de la commande et cliquez sur **Bon de commande · PDF**, puis sur **Générer le PDF**.

Le PDF contient la référence, le fournisseur, le chantier, la date, le statut, les articles et les totaux par devise. Les devises ne sont pas additionnées entre elles. Les taxes ne sont pas calculées sur ce document. Des emplacements sont prévus pour les signatures. Un PDF de commande en brouillon conserve ce statut.

## 7. Exporter le planning de la semaine

Dans **Planning**, cliquez sur **Planning de la semaine · PDF**. Choisissez une date de la semaine souhaitée ; sans date, la semaine actuelle est utilisée. Le document couvre le lundi au dimanche et suit le chantier sélectionné.

Le PDF liste les tâches dont les dates chevauchent la semaine, ainsi que les tâches avec des dates non renseignées. Il affiche le chantier, les dates prévues, le statut et l’avancement au moment de la génération.

## 8. Rapports, analyses et historique

Le **Tableau de bord des rapports** rassemble l’avancement, les retards, les incidents ouverts, les heures pointées, les dépenses à traiter et les éditions disponibles ou en échec. Les courbes montrent les dépenses mensuelles par devise et les éditions par mois de création, selon leur statut actuel. Les mois intermédiaires sans activité sont affichés à zéro.

Les filtres chantier et période ainsi que les raccourcis de dates s’appliquent aux analyses et à l’historique. Les dépenses suivent leur date, les présences leur journée de travail et les rapports leur date de création. Pour un chantier précis, les éditions retenues sont celles générées explicitement pour ce chantier ; les éditions globales restent dans la vue tous chantiers.

Les boutons **Disponibles**, **En attente** et **En échec** ouvrent l’historique avec le statut correspondant. Vous pouvez ensuite rechercher un modèle ou une référence. Les sections inférieures montrent les tâches les plus en retard, les dépenses par catégorie et les dernières dépenses. Les accès aux fiches dépendent des droits du module concerné.

- **Analyses et détails** présente les indicateurs, les tâches par statut, la courbe des dépenses mensuelles, les finances par devise et les détails par chantier.
- **Générer un rapport** ouvre une fenêtre où choisir le modèle, le chantier, la période et les observations. Les paramètres sélectionnés servent aussi au tableau analytique.
- Cliquez sur le bouton de génération dans cette fenêtre. Vous êtes dirigé vers l’édition créée. Son statut indique si elle est en attente, terminée ou en échec. Une édition en attente est actualisée automatiquement.
- **Historique des rapports** donne accès aux éditions enregistrées. Ouvrez une édition terminée pour consulter et télécharger son document.
- Les utilisateurs autorisés peuvent créer un modèle depuis la fenêtre de génération.

La période filtre les dépenses et les incidents. Le planning retient les tâches chevauchant la période et les dates non renseignées. Le budget prévu reste l’enveloppe totale ; le solde est calculé après les dépenses TTC validées ou payées de la période. Le forfait mensuel d’un collaborateur ne crée aucune dépense automatiquement.

Le PDF de chantier inclut aussi le détail des dépenses validées et payées (articles, HT, taxe, TTC), ainsi qu’une courbe mensuelle par devise.

La génération des rapports de chantier utilise le service de tâches du serveur. Si une édition échoue, vérifiez les paramètres puis contactez l’administrateur pour vérifier ce service. Les nouveaux exports de présence, planning hebdomadaire et commande sont générés directement par le backend lors du téléchargement.

## 9. Archiver et restaurer

Dans les listes proposant les archives, utilisez l’icône **Archiver** sur la ligne souhaitée (ou le bouton sur la carte d’un chantier). L’élément disparaît de la liste active, sans suppression de son contenu.

Cliquez sur **Afficher les archives** pour retrouver les éléments archivés, puis sur **Restaurer** pour les rendre à nouveau disponibles dans leur liste. Les modifications se font après restauration. L’archivage et la restauration demandent le droit de suppression du module.

L’archivage porte sur l’élément choisi : il ne cascade pas vers ses enfants et ne supprime pas ses relations. Il conserve les historiques, les mouvements de stock et les calculs financiers. Les rapports et indicateurs historiques peuvent donc encore prendre ces éléments en compte. La suppression existante reste une opération distincte avec ses propres protections.

## 10. Bonnes pratiques

Vérifiez le chantier et la devise avant d’enregistrer. Relisez les documents avant de les transmettre. Conservez les pièces d’identité dans les accès prévus par votre organisation. En cas de conflit de version, actualisez la fiche et reprenez votre modification à partir des données à jour.

## Mise à jour technique (administrateur)

### Tableau de bord plateforme

Le superadministrateur accède à **Vue plateforme** pour consulter les entreprises, les comptes et les chantiers de toute la plateforme. Le sélecteur **Période d’activité** propose 7, 30 ou 90 jours. La courbe permet de choisir les événements d’audit, les nouveaux comptes, les nouvelles entreprises ou les nouveaux chantiers.

Le tableau des entreprises est classé par activité sur la période puis par nombre de chantiers, dans une sélection des dix premières entreprises. **Gérer** ouvre les utilisateurs de l’entreprise choisie. L’activité récente affiche les derniers événements toutes périodes confondues et permet d’ouvrir le journal de l’entreprise.

Les compteurs globaux, les statuts des chantiers et les files de traitement représentent la situation actuelle. Ils ne suivent pas la période d’activité ni l’entreprise sélectionnée dans la barre supérieure. **Consulter l’état du système** ouvre le détail de la connexion à la base et des files de synchronisation et de rapports. Ce contrôle n’est pas une mesure de disponibilité historique.

### Migrations

Après installation de cette version, appliquer les migrations avant de redémarrer les services :

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

Les nouveaux champs de collaborateur et les lignes de dépense sont conservés en base de données. Aucun tarif existant n’est converti automatiquement.
