// Chiffre le fichier de patrimoine du groupe pour le livrer avec l'application.
//
//   node scripts/chiffrer-patrimoine.mjs ["EDL patrimoine/patrimoine-opera.json"]
//
// La phrase secrète est demandée ici, sans s'afficher, et n'est enregistrée nulle part.
// Seul le résultat chiffré (src/patrimoine/patrimoineGroupe.json) est publié avec l'application.

import fs from 'node:fs'
import readline from 'node:readline'
import { chiffrer, dechiffrer, phraseSuffisante } from '../src/patrimoine/chiffrement.ts'

const source = process.argv[2] ?? 'EDL patrimoine/patrimoine-opera.json'
const cible = 'src/patrimoine/patrimoineGroupe.json'

function demander(question) {
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stdout.write(question)
      else if (s.includes('\n')) process.stdout.write('\n')
      else process.stdout.write('•')
    }
    rl.question(question, (r) => {
      rl.close()
      ok(r)
    })
  })
}

const contenu = JSON.parse(fs.readFileSync(source, 'utf8'))
if (contenu.format !== 'edl-brenguier-patrimoine' || !Array.isArray(contenu.biens)) throw new Error(`${source} n'est pas un fichier de patrimoine.`)
console.log(`\n${contenu.biens.length} fiches de biens à chiffrer (${source}).`)
console.log("Choisissez une phrase secrète d'au moins 4 mots (24 caractères minimum), par exemple 5 mots sans lien entre eux.")
console.log("Elle sera demandée une fois sur chaque tablette. Notez-la en lieu sûr : elle n'est enregistrée nulle part.\n")

let phrase
for (;;) {
  phrase = await demander('Phrase secrète : ')
  const defaut = phraseSuffisante(phrase)
  if (defaut) {
    console.log(`  ${defaut} Recommencez.`)
    continue
  }
  if ((await demander('Retapez-la pour confirmer : ')) === phrase) break
  console.log('  Les deux saisies sont différentes. Recommencez.')
}

const version = new Date().toISOString().slice(0, 10)
const paquet = await chiffrer(contenu, phrase, version, contenu.biens.length)
// Contrôle : le paquet se relit avec la phrase, et ne contient aucun texte en clair.
const relu = await dechiffrer(paquet, phrase)
if (JSON.stringify(relu) !== JSON.stringify(contenu)) throw new Error('Contrôle de relecture échoué.')
const publie = JSON.stringify(paquet)
for (const b of contenu.biens.slice(0, 20)) if (publie.includes(b.adresse)) throw new Error('Texte en clair détecté : abandon.')
fs.writeFileSync(cible, publie)
console.log(`\nTerminé : ${cible} (${Math.round(publie.length / 1024)} Ko, chiffré). Vous pouvez fermer cet onglet.`)
