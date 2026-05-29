const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;
const PUBLIC_DIR = path.join(__dirname);


// Serve root (home) page with live reload
app.get('/', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, 'root', 'index.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Home not found');
    const script = `
<script>
(() => {
  const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const socket = new WebSocket(protocol + location.host);
  socket.onmessage = () => location.reload();
})();
</script>`;
    const injected = data.includes('</body>')
      ? data.replace('</body>', script + '\n</body>')
      : data + script;
    res.setHeader('Content-Type', 'text/html');
    res.send(injected);
  });
});

// Serve HTML files with live reload
app.get('/*.html', (req, res, next) => {
  const filePath = path.join(PUBLIC_DIR, req.path);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return next();
    const script = `
<script>
(() => {
  const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
  const socket = new WebSocket(protocol + location.host);
  socket.onmessage = () => location.reload();
})();
</script>`;
    const injected = data.includes('</body>')
      ? data.replace('</body>', script + '\n</body>')
      : data + script;
    res.setHeader('Content-Type', 'text/html');
    res.send(injected);
  });
});

// Serve static files for everything else
app.use(express.static(PUBLIC_DIR));

// Serve blog pages dynamically
app.get('/blog/:blogname', (req, res, next) => {
  const blogName = req.params.blogname;
  const blogMdPath = path.join(PUBLIC_DIR, 'root', 'blog', `${blogName}.md`);
  const blogTemplatePath = path.join(PUBLIC_DIR, 'src', 'data', 'styles', 'blogTemplate.html');

  fs.readFile(blogMdPath, 'utf8', (err, mdContent) => {
    if (err) return res.status(404).send('Blog not found');
    fs.readFile(blogTemplatePath, 'utf8', (err, template) => {
      if (err) return res.status(500).send('Template not found');
      // Directly inject markdown (no escaping needed)
      const html = template.replace('BLOG_CONTENT_HERE', mdContent);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    });
  });
});

// WebSocket connection handler (important for debugging + structure)
wss.on('connection', (socket) => {
  socket.on('message', (msg) => {
    // optional: extend later (e.g. HMR commands)
  });
});

app.get('/api/library', (req, res) => {
  const libraryPath = path.join(PUBLIC_DIR, 'src/data/library');

  fs.readdir(libraryPath, (err, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }

    const images = files
      .filter(file => /\.(png|jpe?g|gif|webp|svg)$/i.test(file))
      .map(file => `/src/data/library/${file}`);

    res.json(images);
  });
});

chokidar.watch(PUBLIC_DIR, {
  ignored: /node_modules|\.git/,
  ignoreInitial: true,
}).on('all', (event, file) => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send('reload');
    }
  }
  console.log(`[live-reload] ${event}: ${file}`);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});