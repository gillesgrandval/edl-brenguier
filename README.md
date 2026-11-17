# EDL Brenguier

Application d'états des lieux (entrée, sortie, pré-état des lieux) du Groupe Brenguier, pour tablette Android, utilisable **hors ligne** : patrimoine immobilier, saisie pièce par pièce, photos annotées, dictée, lecture des compteurs, signatures, rapport PDF, comparatif de sortie avec vétusté.

**Adresse :** https://gillesgrandval.github.io/edl-brenguier/

## Guides

- [Guide d'installation](GUIDE_INSTALLATION.md) — installer l'application sur la tablette, mises à jour, sauvegardes
- [Guide d'utilisation](GUIDE_UTILISATEUR.md) — du patrimoine au rapport PDF signé
- [Limites connues](LIMITES.md)

Ces guides sont aussi lisibles dans l'application (bouton **?**), même hors ligne.

## Technique

- **Type** : Progressive Web App (React, TypeScript, Vite), installable et entièrement hors ligne
- **Données** : stockées uniquement sur l'appareil (IndexedDB). Aucune donnée n'est envoyée sur Internet, sauf la dictée vocale (reconnaissance de Google dans Chrome).
- **Mise en ligne** : GitHub Pages, automatique à chaque envoi sur `main` (tests puis construction)
- **Charte** : couleurs et polices centralisées dans `src/styles/theme.css` et `src/theme/charte.ts`

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'application en local pour tester |
| `npm test` | Lance les tests automatiques |
| `npm run build` | Construit la version à mettre en ligne |
| `npm run preview` | Teste la version construite (dont le mode hors ligne) |

## Confidentialité

Ne sont **jamais** publiés (exclus par `.gitignore`) : les PDF d'exemples, le dossier `exemples/` (photos de compteurs, fichiers de test), le dossier `Charte Graphique/` (polices sous licence), les sauvegardes.
