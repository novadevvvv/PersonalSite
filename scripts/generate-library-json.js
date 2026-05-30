const fs = require('fs');
const path = require('path');

const libraryDir = path.join(__dirname, '../src/data/library');
const outputFile = path.join(__dirname, '../src/data/library.json');

fs.readdir(libraryDir, (err, files) => {
  if (err) throw err;
  const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
    .map(f => `src/data/library/${f}`);
  fs.writeFileSync(outputFile, JSON.stringify(images, null, 2));
  console.log(`Wrote ${images.length} images to library.json`);
});
