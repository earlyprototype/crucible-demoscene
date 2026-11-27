// Package the static dashboard with the same r128 scripts used by the live page.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'architecture-dashboard');
const output = path.join(root, 'dist', 'architecture-dashboard');
const three = path.dirname(require.resolve('three/package.json'));
const libraries = new Map([
    ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'build/three.min.js'],
    ['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js', 'examples/js/controls/OrbitControls.js']
]);

let html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
fs.mkdirSync(path.join(output, 'vendor'), { recursive: true });
for (const [url, file] of libraries) {
    if (!html.includes(url)) throw new Error(`Check the dashboard dependency for ${file}`);
    const destination = 'vendor/' + path.basename(file);
    fs.copyFileSync(path.join(three, file), path.join(output, destination));
    html = html.replace(url, destination);
}
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(output, 'vendor', 'LICENSE'));
for (const asset of ['assets/css/architecture.css', 'assets/css/animations.css', 'assets/js/3d-architecture.js']) {
    const destination = path.join(output, asset);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(source, asset), destination);
}
fs.writeFileSync(path.join(output, 'index.html'), html);
console.log('Built dist/architecture-dashboard');
