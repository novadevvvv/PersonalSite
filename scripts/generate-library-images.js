// Generates a JSON file with all image filenames in the library folder
const fs = require('fs');
const path = require('path');

const libraryDir = path.join(__dirname, '../src/data/library');
const outputJson = path.join(__dirname, '../src/data/library/library-images.json');

const exts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

fs.readdir(libraryDir, (err, files) => {
  if (err) throw err;
  const images = files.filter(f => exts.includes(path.extname(f).toLowerCase()));
  fs.writeFileSync(outputJson, JSON.stringify(images, null, 2));
  console.log(`Wrote ${images.length} images to library-images.json`);
});
