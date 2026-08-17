// copy-web.js — copies the web app files from the project root into ./web so
// electron-builder can package a self-contained .app. Run automatically by
// `npm run dist` / `npm run pack`.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(__dirname, 'web');
fs.mkdirSync(dest, { recursive: true });

const files = fs.readdirSync(root).filter((f) => /\.(html|jsx|js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ttf|json)$/i.test(f));
let n = 0;
for (const f of files) {
  fs.copyFileSync(path.join(root, f), path.join(dest, f));
  n++;
}
console.log(`Copied ${n} web file(s) into mac-app/web/`);
