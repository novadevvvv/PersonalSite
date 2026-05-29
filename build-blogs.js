// build-blogs.js
// Converts all markdown files in root/blog/ to static HTML using blogTemplate.html
const fs = require('fs');
const path = require('path');
const marked = require('marked');

const blogDir = path.join(__dirname, 'root', 'blog');
const templatePath = path.join(__dirname, 'src', 'data', 'styles', 'blogTemplate.html');

const template = fs.readFileSync(templatePath, 'utf8');

fs.readdirSync(blogDir).forEach(file => {
  if (file.endsWith('.md')) {
    const mdPath = path.join(blogDir, file);
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    const htmlContent = template.replace('BLOG_CONTENT_HERE', mdContent.replace(/`/g, '\`').replace(/\$/g, '\$'));
    // Save as .html
    const outPath = path.join(blogDir, file.replace(/\.md$/, '.html'));
    fs.writeFileSync(outPath, htmlContent);
    console.log(`Generated ${outPath}`);
  }
});
