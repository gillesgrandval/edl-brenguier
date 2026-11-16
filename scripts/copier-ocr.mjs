// Copie le moteur de lecture d'index (Tesseract) dans public/ocr pour un fonctionnement hors ligne.
// Lancé automatiquement avant « npm run dev » et « npm run build ».
import { cpSync, mkdirSync, existsSync } from 'node:fs'

const dest = 'public/ocr'
mkdirSync(`${dest}/lang`, { recursive: true })
const fichiers = [
  ['node_modules/tesseract.js/dist/worker.min.js', `${dest}/worker.min.js`],
  // Variantes « LSTM » uniquement (moteur moderne) : la plus rapide disponible est choisie par la tablette.
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', `${dest}/tesseract-core-relaxedsimd-lstm.wasm.js`],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', `${dest}/tesseract-core-simd-lstm.wasm.js`],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', `${dest}/tesseract-core-lstm.wasm.js`],
  // Modèle « best_int » : compact (3 Mo) et précis sur les chiffres.
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', `${dest}/lang/eng.traineddata.gz`],
]
for (const [src, dst] of fichiers) {
  if (!existsSync(src)) throw new Error(`Fichier manquant : ${src} (lancez npm install)`)
  cpSync(src, dst)
}
console.log('Moteur de lecture d’index copié dans public/ocr')
