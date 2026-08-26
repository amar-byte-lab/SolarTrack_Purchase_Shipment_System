const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC_DIR = path.join(__dirname, 'SolarPurchaseTracker');
const DIST_DIR = path.join(__dirname, 'dist');

// Helper to copy directory recursively (excluding source map files)
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name.endsWith('.map')) {
      console.log(`🚫 Excluding source map file from build: ${entry.name}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean and rebuild function
async function build() {
  console.log('🧹 Cleaning existing dist folder...');
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }

  console.log('📁 Copying all files from SolarPurchaseTracker to dist...');
  copyDirSync(SRC_DIR, DIST_DIR);

  const jsDir = path.join(DIST_DIR, 'js');
  if (!fs.existsSync(jsDir)) {
    console.log('⚠️ No application JS directory found.');
    return;
  }

  const files = fs.readdirSync(jsDir);
  console.log(`🚀 Processing ${files.length} application JS files...`);

  for (const file of files) {
    if (!file.endsWith('.js') || file.endsWith('.min.js')) continue;

    const filePath = path.join(jsDir, file);
    console.log(`📦 Minifying: js/${file}`);

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const minified = await minify(code, {
        ecma: 2020,
        compress: true,
        mangle: false, // keep variable names safe for inline handlers
      });

      if (!minified.error && minified.code) {
        fs.writeFileSync(filePath, minified.code, 'utf8');
      }
    } catch (err) {
      console.warn(`⚠️ Minification skipped for js/${file}: ${err.message}`);
    }
  }

  console.log('✅ Production build completed successfully in ./dist');
}

build();
