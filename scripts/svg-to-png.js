const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgBuffer = fs.readFileSync(path.join(__dirname, '../src/logo.svg'));

sharp(svgBuffer)
  .resize(1024, 1024) // Create a large base image
  .png()
  .toFile(path.join(__dirname, '../src/logo.png'))
  .then(info => {
    console.log('Generated base PNG logo');
  })
  .catch(err => {
    console.error('Error generating base PNG logo:', err);
  }); 