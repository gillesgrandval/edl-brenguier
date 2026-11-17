# Guide d'utilisation

## L'essentiel en 6 étapes

1. **Nouvel état des lieux** : choisissez le bien dans le patrimoine (Ville → Type → Lot), ou saisissez un nouveau bien.
2. **Informations générales** : type (entrée, sortie, pré-état des lieux), parties, date, énergies.
3. **Pièce par pièce** : état de chaque élément, observations, photos.
4. **Compteurs, clés, détecteur, observations.**
5. **Récapitulatif et signatures**, puis « Signer et verrouiller ».
6. **Rapport PDF** : Ouvrir, Partager (e-mail au locataire) ou Enregistrer.

Tout est **enregistré automatiquement**, à chaque saisie. Rien ne se perd si la tablette se met en veille.

## Les écrans

En haut de l'écran :

- **États des lieux** : l'accueil, avec les visites **à réaliser** (triées par date) et la liste complète, avec une recherche et des filtres.
- **Patrimoine** : les fiches des biens.
- **⚙ Paramètres** : sauvegarde, exports, réglages.

## Préparer un état des lieux

**Depuis un bien du patrimoine** (le plus rapide) : « Nouvel état des lieux » → choisissez Ville, Type, puis Référence / lot (ou tapez une partie de l'adresse dans la recherche) → choisissez la date → « Préparer l'état des lieux ».

L'adresse, la surface, les pièces, les équipements connus, les annexes et les compteurs à relever sont repris automatiquement. Les équipements sont ajoutés **sans état** : ils sont à vérifier sur place.

**Bien absent du patrimoine** : « Créer la fiche du bien » (elle servira les fois suivantes), ou « Saisie libre ». Une saisie libre peut ensuite être ajoutée au patrimoine depuis son tableau de bord.

Un état des lieux préparé à l'avance peut avoir un type « à définir » et une heure « à fixer » : à compléter avant la signature.

## Le tableau de bord d'un état des lieux

Il montre ce qui reste à faire : pourcentage d'avancement, rappels (type à définir, relevés à effectuer), informations générales, pièces, rubriques, clôture.

- Touchez une pièce pour la saisir.
- Vous pouvez **ajouter, renommer ou réordonner** les pièces.
- Les modifications d'un état des lieux ne changent **pas** la fiche permanente du bien.

## Saisir une pièce

Chaque élément (sol, murs, porte, prises…) se remplit en quelques touches :

- **État** : NF neuf · TB très bon · BE bon / usage normal · EU usé · ME mauvais · HS hors service · NV absent / non vérifié.
- **Fonctionnement** pour les équipements : testé OK, défaillant, non testé.
- **Nature / matériau**, **observations** (rayures, taches, trous…), **localisation**, nombre de **trous de chevilles**, « à nettoyer ».
- **Photos** : bouton « Photo » (appareil photo) ou « Galerie ». Chaque photo est numérotée, horodatée et légendée.
- **Annoter** une photo : ouvrez-la → « Annoter » → flèche, cercle, rectangle, trait libre ou texte.

Raccourcis :

- **« Tout le reste en bon état »** : met « BE » sur tous les éléments non encore renseignés.
- **« Dicter la pièce »** : décrivez à voix haute ce que vous voyez (« les murs sont en bon état, une tache sur la porte côté fenêtre, deux trous dans le mur… »). L'application propose de remplir les éléments correspondants ; vous cochez ce qui est juste.
- Le **micro** à côté des zones de commentaire permet de dicter un texte.

## Compteurs

Pour chaque compteur : numéro (PDL pour l'électricité, PCE pour le gaz), **index** (HP / HC pour l'électricité), **date du relevé** (remplie automatiquement) et **photo de l'index**, obligatoire pour valider. « Pas de compteur / sans objet » s'il n'existe pas.

**Lecture automatique de l'index** : après la photo, l'application cherche les chiffres de l'index. La zone lue est encadrée en pointillés bleus.

- Si la lecture est sûre, l'index est prérempli ; sinon il est seulement **suggéré** (« 00663 ? »).
- Pour une lecture fiable, **tracez au doigt un cadre serré** autour des chiffres de l'index (sans le numéro de série ni « kWh »).
- Vérifiez toujours le chiffre avant de valider.

Un relevé manquant est signalé « À effectuer » sur l'accueil, sur le tableau de bord et au moment de signer.

## Clés, détecteur, observations

- **Clés** : nombre de chaque clé, badge, télécommande remis (ou restitués à la sortie).
- **Détecteur de fumée** : présent, fonctionnement testé.
- **Observations générales** et **remarques du locataire**.

## Signer

« Récapitulatif et signatures » (tableau de bord → Clôture) :

1. Le **récapitulatif** liste les points en attente. On peut signer malgré tout : ils figureront « non renseignés ».
2. **Remarques du locataire**, si besoin.
3. **« Fait à »** (prérempli) ; la date est ajoutée automatiquement.
4. **Chaque partie signe au doigt** dans son cadre. Locataire absent ou qui refuse : l'interrupteur prévu, avec une précision.
5. Cochez la déclaration, puis **« Signer et verrouiller »**.

Après signature, l'état des lieux est **verrouillé** : plus aucune modification possible. Une **empreinte SHA-256** (un code de 64 caractères) prouve que rien n'a été retouché ; elle figure sur le rapport PDF. En cas d'erreur après signature, il faut créer un nouvel état des lieux.

## Rapport PDF

Depuis le tableau de bord ou l'écran de signature : « Fabriquer le rapport PDF », puis :

- **Ouvrir** : pour le relire ;
- **Partager** : par e-mail au locataire, ou sur Google Drive ;
- **Enregistrer** : dans les fichiers de la tablette.

Avant signature, le PDF est un **projet** (mention « PROJET » sur chaque page). Il contient : page de garde, parties, compteurs, clés, chaque pièce (états en couleur, numéros de photos), signatures, mentions légales, empreinte, et l'annexe de toutes les photos.

**Bonne pratique** : envoyez le PDF signé au locataire par e-mail juste après la signature.

## État des lieux de sortie

1. Ouvrez l'**état des lieux d'entrée signé** → **« Préparer l'état des lieux de sortie »**.
2. Les mêmes pièces, éléments, locataires, compteurs et clés sont repris ; les constats repartent à zéro.
3. Pendant la visite, chaque élément affiche son **état à l'entrée** (pastille « Entrée : BE », en rouge si l'état s'est dégradé). Les compteurs montrent l'index d'entrée et la consommation ; les clés, le nombre remis à l'entrée.
4. **« Comparatif entrée / sortie »** : compteurs, clés et **dégradations**. Pour chacune : imputable ou non, date de pose ou de rénovation, coût de remise en état. L'application calcule la **vétusté**, la **part du locataire** et le **total estimé**.
5. Pensez à la **nouvelle adresse du locataire** (informations générales).

La vétusté suit la grille des Paramètres. Les montants sont des estimations, sous réserve de devis ou de factures.

## Patrimoine

- **Liste** avec recherche et filtres (ville, type, résidence, société).
- **Fiche d'un bien** : identification, adresse, caractéristiques, **composition** (pièces et équipements de la visite), compteurs à relever, historique de ses états des lieux, et « Préparer l'état des lieux ».
- **Importer depuis Excel** : un bien par ligne, une ligne d'en-têtes. L'application reconnaît les colonnes (modifiable), affiche un aperçu avec les erreurs, puis importe. Réimporter un fichier met à jour les biens **sans doublon**, et ne touche jamais aux états des lieux. Un modèle vide est téléchargeable.

## Paramètres

- **Sauvegarde complète** (.zip) et **restauration** (n'efface jamais rien).
- **Exports Excel** : liste des états des lieux, patrimoine (réimportable).
- **Opérateur par défaut**, **entités du groupe** (bailleurs), **grille de vétusté**, **mentions** ajoutées au rapport PDF.

## Conseils de terrain

- Batterie chargée, et une sauvegarde le soir.
- Photographiez d'abord la pièce entière (« Vue d'ensemble »), puis les défauts de près.
- Pour les compteurs, photo bien de face, sans reflet, chiffres nets.
- En sortie, remettez le PDF au locataire avant de partir.
