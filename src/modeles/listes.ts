import type { Categorie } from '../db/types'

/* Listes de saisie rapide (deviendront modifiables dans les Paramètres à l'étape 9). */

/** Natures / matériaux proposés selon la catégorie de l'élément. */
export const NATURES: Record<Categorie, string[]> = {
  revetement: ['Peinture', 'Papier peint', 'Toile de verre', 'Crépi', 'Carrelage', 'Faïence', 'Parquet', 'Stratifié', 'Moquette', 'Lino / PVC', 'Béton', 'Résine', 'Dalles', 'Lambris', 'Bois'],
  menuiserie: ['Bois', 'PVC', 'Aluminium', 'Métal', 'Simple vitrage', 'Double vitrage', 'Isoplane', 'Coulissant', 'Battant'],
  electricite: ['Standard', 'Encastré', 'Applique', 'Plafonnier', 'Spots', 'Néon / LED', 'Douille seule'],
  chauffage: ['Électrique', 'Eau chaude', 'Fonte', 'Aluminium', 'Aérotherme', 'Climatisation réversible', 'Plancher chauffant'],
  plomberie: ['Céramique', 'Acrylique', 'Fonte émaillée', 'Inox', 'Résine', 'Mitigeur', 'Mélangeur', 'Thermostatique'],
  equipement: ['Bois', 'Mélaminé', 'Stratifié', 'Inox', 'Verre', 'Vitrocéramique', 'Induction', 'Gaz', 'Électrique'],
  exterieur: ['Béton', 'Enrobé', 'Gravier', 'Pavés', 'Pelouse', 'Grillage', 'Bois', 'Métal', 'Pierre', 'Tuiles', 'Bac acier'],
  securite: ['Présent', 'Vérification à jour', 'Vérification périmée', 'Étiquette absente'],
}

/** Puces d'observation (les plus fréquentes en premier). */
export const OBSERVATIONS = [
  'Rayures',
  'Taches',
  'Trous',
  'Vis / chevilles restantes',
  'Fissures',
  'Éclats',
  'Impacts',
  'Traces',
  'Usure',
  'Décollement',
  'Peinture écaillée',
  'Humidité',
  'Moisissures',
  'Jaunissement',
  'Joint abîmé',
  'Fuite',
  'Cassé',
  'Déformé',
  'Manquant',
  'Arraché',
  'Ne ferme pas',
  'Sale',
]

export const LOCALISATIONS = [
  'Mur gauche',
  'Mur droit',
  'Mur face',
  "Mur d'entrée",
  'Côté fenêtre',
  'Côté porte',
  'Partie haute',
  'Partie basse',
  'Angle',
  'Au centre',
  'Ensemble',
]

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  revetement: 'Revêtement',
  menuiserie: 'Menuiserie',
  electricite: 'Électricité',
  chauffage: 'Chauffage',
  plomberie: 'Plomberie',
  equipement: 'Équipement',
  exterieur: 'Extérieur',
  securite: 'Sécurité',
}
