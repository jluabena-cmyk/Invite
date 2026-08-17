const fs = require('fs');
const path = require('path');

const buildGradlePath = path.resolve('./android/app/build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.error('build.gradle not found at', buildGradlePath);
  process.exit(1);
}

const content = fs.readFileSync(buildGradlePath, 'utf8');
const EXCLUDE_PATH = 'META-INF/versions/9/OSGI-INF/MANIFEST.MF';

if (content.includes(EXCLUDE_PATH)) {
  console.log('Packaging exclusion already present — skipping patch.');
  process.exit(0);
}

const PACKAGING_BLOCK = `\n    packaging {\n        resources {\n            excludes += ['${EXCLUDE_PATH}']\n        }\n    }`;

const patched = content.replace(/^(android \{)/m, `$1${PACKAGING_BLOCK}`);

if (patched === content) {
  console.error('Could not find "android {" block in build.gradle — patch failed.');
  process.exit(1);
}

fs.writeFileSync(buildGradlePath, patched);
console.log('✓ Patched android/app/build.gradle with packaging exclusion for:', EXCLUDE_PATH);
