# Limites connues

Ce que l'application ne fait pas, ou fait avec des réserves. À connaître avant de l'utiliser au quotidien.

## Données et sauvegarde

- **Les données ne sont que sur l'appareil.** Pas de serveur, pas de synchronisation entre tablettes, ordinateur et téléphone. Une perte ou une panne de la tablette sans sauvegarde récente fait perdre les états des lieux. Sauvegardez régulièrement sur Google Drive (Paramètres).
- Effacer les données de Chrome pour ce site, ou désinstaller l'application, **efface tout**.
- La fiche du **lot n° 5 de Hyères** est intégrée au code de l'application, qui est public sur GitHub (choix fait pour éviter un envoi par e-mail). Les autres biens doivent passer par l'import Excel, qui reste sur l'appareil.

## Signature

- La signature est **manuscrite, tracée au doigt**, protégée par une empreinte SHA-256 qui prouve l'intégrité du document. Ce n'est **pas une signature électronique qualifiée** (au sens du règlement eIDAS) : c'est une signature simple, adaptée à un état des lieux établi contradictoirement en présence des parties. Remettez le PDF au locataire immédiatement.
- Un état des lieux signé ne peut plus être modifié ni « dé-signé » : en cas d'erreur, il faut en créer un nouveau.

## Visite commune (sortie + entrée)

- Le contrôle de confidentialité recherche les noms, prénoms, téléphones, e-mails et la nouvelle adresse saisis pour chaque locataire. Il ne peut pas reconnaître une information écrite autrement (par exemple un surnom ou un numéro mal recopié) : relisez les commentaires communs.
- Le contrôle anti-fuite des PDF lit le texte écrit dans le PDF et ses métadonnées. Il ne lit pas le contenu des **photos** (un nom sur une boîte aux lettres photographiée, par exemple) : vérifiez-les.
- Une photo prise pendant la visite figure dans les deux documents. Retirez-la de l'un d'eux avant sa signature si elle ne concerne qu'un locataire.
- Sans entrée précédente dans l'application, la sortie n'a pas de comparatif automatique. Le comparatif à partir d'un ancien PDF est prévu plus tard.

## Dictée et lecture des compteurs

- **La dictée vocale nécessite Internet** (reconnaissance vocale de Google dans Chrome). Hors ligne, utilisez le **micro du clavier Samsung** dans les zones de texte.
- L'analyse de la dictée reconnaît des phrases simples ; tout ce qui n'est pas compris est conservé en commentaire de la pièce.
- **La lecture automatique des index** fonctionne bien sur les écrans numériques nets et les compteurs à rouleaux propres. Elle est peu fiable sur les compteurs anciens, rayés ou photographiés de biais : tracer un cadre autour des chiffres, ou saisir l'index. Le chiffre proposé doit **toujours être vérifié**.

## Vétusté

- La **grille de vétusté** fournie est **indicative**. Elle doit être validée par le Groupe Brenguier (Paramètres), et idéalement annexée aux baux. Les montants calculés sont des estimations, sous réserve de devis ou de factures ; ce n'est pas un conseil juridique.

## Apparence et compatibilité

- La police de titre de la charte, **LT Remark**, n'est pas utilisée faute de licence web : une police libre proche (Gelasio) la remplace. Le texte utilise bien **Nunito**, police de la charte.
- Testé avec **Chrome sur Android** (tablette Samsung) et sur ordinateur. Safari (iPhone, iPad) n'a pas été testé.
- La première installation télécharge environ 17 Mo (moteur de lecture des compteurs compris).
- Un rapport avec beaucoup de photos peut peser plusieurs Mo (environ 150 à 250 Ko par photo).

## Non prévu à ce jour

- Pas de code PIN pour ouvrir l'application : le verrouillage de la tablette (code ou empreinte Android) protège l'accès.
- Le **code administrateur** (suppressions définitives, annulations) protège contre les fausses manœuvres ; ce n'est pas une gestion de comptes : toute personne qui le connaît peut agir, et « Code oublié » permet de le réinitialiser (avec trace au journal). Il est propre à chaque appareil.
- Une sauvegarde restaurée peut faire revenir un brouillon supprimé définitivement après la date de cette sauvegarde (la restauration n'efface jamais rien).
- Pas d'envoi automatique du PDF par e-mail : on passe par « Partager ».
- Pas de modèles de pièces personnalisables dans les Paramètres (les pièces se modifient dans chaque état des lieux ou dans la fiche du bien).
