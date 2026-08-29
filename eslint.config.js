// Lint config scoped to one job: catching the bugs that have actually broken
// this site. Three separate outages in frontend/app.js were the same shape --
// a binding read outside the block that declares it, or before it initialises,
// which throws at runtime and is invisible until the map goes blank.
// Style rules are deliberately absent; this is a correctness gate, not a
// formatter, so it stays quiet unless something is genuinely broken.
const browserGlobals = {
    console: 'readonly', document: 'readonly', window: 'readonly',
    fetch: 'readonly', navigator: 'readonly', location: 'readonly',
    localStorage: 'readonly', sessionStorage: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly',
    setInterval: 'readonly', clearInterval: 'readonly',
    requestAnimationFrame: 'readonly', alert: 'readonly',
    URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly',
    FormData: 'readonly', Event: 'readonly', CustomEvent: 'readonly',
    IntersectionObserver: 'readonly', AbortController: 'readonly',
    // Loaded from CDN script tags before our own bundles.
    L: 'readonly', echarts: 'readonly', lucide: 'readonly',
    // Declared by frontend/geo-bounds.js, which both maps load ahead of their
    // own bundle. Listed here so no-undef can still catch genuine typos in the
    // files that consume them.
    MYANMAR_BANDS: 'readonly', MYANMAR_ISLANDS: 'readonly',
    MYANMAR_VIEW_BOUNDS: 'readonly', isWithinMyanmar: 'readonly',
};

module.exports = [
    {
        files: ['frontend/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',   // plain <script> files, not modules
            globals: browserGlobals,
        },
        rules: {
            // The whole point of the config. functions:false because these files
            // legitimately rely on declaration hoisting -- handlers wired near the
            // top call functions defined hundreds of lines below, and that is
            // safe. const/let/class bindings are what bite.
            'no-use-before-define': ['error', {
                functions: false,
                variables: true,
                classes: true,
            }],
            // The isAirAlert bug read a name that was out of scope entirely.
            'no-undef': 'error',
            // Redeclaring a binding hides which one a line actually refers to.
            // builtinGlobals off: geo-bounds.js legitimately declares the shared
            // names listed above. Redeclaration within a scope is still caught.
            'no-redeclare': ['error', { builtinGlobals: false }],
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-unreachable': 'error',
            'no-const-assign': 'error',
            'no-self-assign': 'error',
        },
    },
];
