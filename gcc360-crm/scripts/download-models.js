const fs = require('fs')
const path = require('path')
const axios = require('axios')

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/'
const MODELS_DIR = path.join(__dirname, '..', 'public', 'models')

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
]

async function downloadModels() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true })
  }

  for (const file of files) {
    const dest = path.join(MODELS_DIR, file)
    if (!fs.existsSync(dest)) {
      console.log(`Downloading ${file}...`)
      try {
        const response = await axios({
          method: 'GET',
          url: BASE_URL + file,
          responseType: 'stream'
        })
        const writer = fs.createWriteStream(dest)
        response.data.pipe(writer)
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve)
          writer.on('error', reject)
        })
        console.log(`Downloaded ${file}`)
      } catch (e) {
        console.error(`Error downloading ${file}:`, e.message)
      }
    } else {
      console.log(`${file} already exists.`)
    }
  }
}

downloadModels()
