# EDL Brenguier

Application d'états des lieux (entrée / sortie) pour tablette Android, utilisable hors ligne :
saisie pièce par pièce, photos annotées, signatures et rapport PDF.

- **Type** : Progressive Web App (React, TypeScript, Vite)
- **Données** : stockées uniquement sur la tablette (IndexedDB). Aucune donnée n'est envoyée sur Internet.
- **Mise en ligne** : GitHub Pages, automatique à chaque envoi sur `main`

## Commandes utiles (sur le Mac)

| Commande | Rôle |
|---|---|
| `npm run dev` | Lance l'application en local pour tester |
| `npm run build` | Construit la version à mettre en ligne |
| `npm run preview` | Teste la version construite (dont le mode hors ligne) |

## Confidentialité

Les PDF présents dans ce dossier (exemples d'états des lieux réels) sont exclus de Git par `.gitignore`
et ne sont jamais mis en ligne.
