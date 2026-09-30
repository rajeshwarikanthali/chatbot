const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[build-frontend] Installing frontend dependencies...');
execSync('npm --prefix frontend install', { stdio: 'inherit' });

console.log('[build-frontend] Building Vite frontend...');
execSync('npm --prefix frontend run build', { stdio: 'inherit' });

const srcDist = path.join(__dirname, 'frontend', 'dist');
const destDist = path.join(__dirname, 'dist');

console.log(`[build-frontend] Copying build output from ${srcDist} to ${destDist}...`);
if (fs.existsSync(destDist)) {
  fs.rmSync(destDist, { recursive: true, force: true });
}

fs.cpSync(srcDist, destDist, { recursive: true });
console.log('[build-frontend] Done! Frontend assets ready in ./dist');
