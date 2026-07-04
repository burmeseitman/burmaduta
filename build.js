const fs = require('fs');
const path = require('path');

// 1. Ensure dist directory exists
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}

// 2. Copy all frontend files to dist
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
copyDir('frontend', 'dist');

// 3. Inject environment variables into app.js
const appJsPath = path.join('dist', 'app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

const apiBaseUrl = process.env.API_BASE_URL || 'https://api.example.com';
const apiKey = process.env.API_KEY || 'your_secret_api_key_here';

console.log('Injecting environment variables into app.js during build step...');

appJsContent = appJsContent.replace('__INJECT_API_BASE_URL__', apiBaseUrl);
appJsContent = appJsContent.replace('__INJECT_API_KEY__', apiKey);

fs.writeFileSync(appJsPath, appJsContent);

const mobileJsPath = path.join('dist', 'mobile.js');
if (fs.existsSync(mobileJsPath)) {
    let mobileJsContent = fs.readFileSync(mobileJsPath, 'utf8');
    mobileJsContent = mobileJsContent.replace('__INJECT_API_BASE_URL__', apiBaseUrl);
    mobileJsContent = mobileJsContent.replace('__INJECT_API_KEY__', apiKey);
    fs.writeFileSync(mobileJsPath, mobileJsContent);
    console.log('Injected environment variables into mobile.js');
}
console.log('Build completed successfully.');
