const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 0. Lint before building anything.
//
// Three separate outages in frontend/app.js came from the same mistake: a
// binding read outside the block that declares it, or before it initialises.
// Each threw at runtime inside a try/catch, so the page loaded, the console
// logged, and the map silently went blank. Nothing failed until a person
// looked at the site. The config catches that class at build time instead.
//
// A missing eslint is a warning rather than a failure, so a deploy environment
// that installs production dependencies only still builds. Lint errors
// themselves always abort.
function lint() {
    // Resolved as a file path: eslint 9 does not expose ./bin/eslint.js through
    // its package exports, so require.resolve cannot reach it.
    const eslintBin = path.join(__dirname, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (!fs.existsSync(eslintBin)) {
        console.warn('⚠️  eslint not installed - skipping lint. Run `npm install` to enable it.');
        return;
    }

    console.log('Linting frontend/ ...');
    const result = spawnSync(process.execPath, [eslintBin, 'frontend'], {
        stdio: 'inherit',
        cwd: __dirname,
    });

    if (result.status !== 0) {
        console.error('\n❌ Lint failed. These are runtime errors, not style notes - a page');
        console.error('   that trips one loads and then breaks silently. Build aborted.');
        process.exit(result.status || 1);
    }
    console.log('✅ Lint passed.');
}
lint();

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

const feedJsPath = path.join('dist', 'feed.js');
if (fs.existsSync(feedJsPath)) {
    let feedJsContent = fs.readFileSync(feedJsPath, 'utf8');
    feedJsContent = feedJsContent.replace('__INJECT_API_BASE_URL__', apiBaseUrl);
    feedJsContent = feedJsContent.replace('__INJECT_API_KEY__', apiKey);
    fs.writeFileSync(feedJsPath, feedJsContent);
    console.log('Injected environment variables into feed.js');
}

const commentsJsPath = path.join('dist', 'comments.js');
if (fs.existsSync(commentsJsPath)) {
    let commentsJsContent = fs.readFileSync(commentsJsPath, 'utf8');
    commentsJsContent = commentsJsContent.replace('__INJECT_API_BASE_URL__', apiBaseUrl);
    commentsJsContent = commentsJsContent.replace('__INJECT_API_KEY__', apiKey);
    fs.writeFileSync(commentsJsPath, commentsJsContent);
    console.log('Injected environment variables into comments.js');
}

// Inject the API origin into the HTML preconnect hints. Without this the browser
// only discovers the API host when app.js first calls fetch(), paying a cold
// DNS + TLS round trip at exactly the moment it is blocking the splash screen.
let apiOrigin;
try {
    apiOrigin = new URL(apiBaseUrl).origin;
} catch (e) {
    console.warn(`Could not parse API_BASE_URL (${apiBaseUrl}); skipping preconnect injection.`);
    apiOrigin = null;
}

if (apiOrigin) {
    for (const htmlFile of ['index.html', 'feed.html', 'mobile.html', 'comments.html']) {
        const htmlPath = path.join('dist', htmlFile);
        if (!fs.existsSync(htmlPath)) continue;
        let html = fs.readFileSync(htmlPath, 'utf8');
        if (!html.includes('__INJECT_API_ORIGIN__')) continue;
        html = html.split('__INJECT_API_ORIGIN__').join(apiOrigin);
        fs.writeFileSync(htmlPath, html);
        console.log(`Injected API origin ${apiOrigin} into ${htmlFile}`);
    }
}

console.log('Build completed successfully.');
