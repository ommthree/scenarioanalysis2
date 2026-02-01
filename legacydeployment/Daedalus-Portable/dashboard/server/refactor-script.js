// Automated refactoring script for index.js
// Converts routes from dbPath-based to getUserDatabase middleware

import fs from 'fs';
import path from 'path';

const INDEX_FILE = '/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js';

// Read the file
let content = fs.readFileSync(INDEX_FILE, 'utf-8');
const lines = content.split('\n');

// Track modifications
const modifications = [];

// Pattern 1: Add getUserDatabase middleware to routes that use dbPath
const routePatterns = [
  // Routes with dbPath in body that need middleware
  /^(app\.(post|get|put|delete)\('\/api\/[^']+',\s+)(upload\.[^,]+,\s+)?async\s+\(req,\s+res\)\s+=>/,
  /^(app\.(post|get|put|delete)\('\/api\/[^']+',\s+)(express\.json\(\),\s+)?async\s+\(req,\s+res\)\s+=>/,
  /^(app\.(post|get|put|delete)\('\/api\/[^']+',\s+)(express\.json\(\),\s+)?\(req,\s+res\)\s+=>/,
];

// Routes that should NOT get getUserDatabase (auth/admin/health)
const excludeRoutes = [
  '/api/auth',
  '/api/admin',
  '/api/health',
  '/api/database/browse', // Special handling
  '/api/database/backup',  // Special handling
  '/api/database/backups', // Special handling
  '/api/database/restore'  // Special handling
];

// Helper to check if line contains dbPath extraction
function hasDbPathExtraction(startLine, endLine) {
  for (let i = startLine; i < Math.min(endLine, lines.length); i++) {
    if (lines[i].includes('const { dbPath }') ||
        lines[i].includes('const {dbPath}') ||
        lines[i].includes('= req.body.dbPath') ||
        lines[i].includes('= req.query.dbPath')) {
      return true;
    }
  }
  return false;
}

// Helper to check if route should be excluded
function shouldExcludeRoute(routePath) {
  return excludeRoutes.some(excluded => routePath.includes(excluded));
}

console.log('Starting refactoring...\n');
console.log('Total lines:', lines.length);

// First pass: Identify routes that need middleware
const routesToModify = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Check if this is a route definition
  const routeMatch = line.match(/app\.(post|get|put|delete)\('(\/api\/[^']+)'/);
  if (routeMatch) {
    const routePath = routeMatch[2];

    // Skip excluded routes
    if (shouldExcludeRoute(routePath)) {
      console.log(`Skipping excluded route: ${routePath}`);
      continue;
    }

    // Check if this route uses dbPath in the next 50 lines
    if (hasDbPathExtraction(i, i + 50)) {
      // Check if middleware is already applied
      if (!line.includes('getUserDatabase')) {
        routesToModify.push({
          lineNum: i,
          routePath: routePath,
          originalLine: line
        });
        console.log(`Found route to modify: ${routePath} (line ${i + 1})`);
      } else {
        console.log(`Already has middleware: ${routePath} (line ${i + 1})`);
      }
    }
  }
}

console.log(`\nFound ${routesToModify.length} routes to modify\n`);

// Second pass: Apply modifications
// We need to process in reverse order to maintain line numbers
for (let i = routesToModify.length - 1; i >= 0; i--) {
  const route = routesToModify[i];
  const lineNum = route.lineNum;
  const line = lines[lineNum];

  // Parse the route definition to insert middleware in the right place
  let newLine = line;

  // Case 1: app.post('/path', upload.X, async (req, res) =>
  if (line.includes('upload.')) {
    newLine = line.replace(
      /(app\.\w+\('[^']+',\s+)(upload\.[^,]+,\s+)(async\s+\(req,\s+res\)\s+=>)/,
      '$1getUserDatabase, $2$3'
    );
  }
  // Case 2: app.post('/path', express.json(), async (req, res) =>
  else if (line.includes('express.json()')) {
    newLine = line.replace(
      /(app\.\w+\('[^']+',\s+)(express\.json\(\),\s+)(async\s+\(req,\s+res\)\s+=>)/,
      '$1getUserDatabase, $2$3'
    );
  }
  // Case 3: app.post('/path', async (req, res) =>
  else if (line.match(/app\.\w+\('[^']+',\s+async\s+\(req,\s+res\)\s+=>/)) {
    newLine = line.replace(
      /(app\.\w+\('[^']+',\s+)(async\s+\(req,\s+res\)\s+=>)/,
      '$1getUserDatabase, $2'
    );
  }
  // Case 4: app.get('/path', (req, res) =>
  else if (line.match(/app\.\w+\('[^']+',\s+\(req,\s+res\)\s+=>/)) {
    newLine = line.replace(
      /(app\.\w+\('[^']+',\s+)(\(req,\s+res\)\s+=>)/,
      '$1getUserDatabase, $2'
    );
  }

  if (newLine !== line) {
    lines[lineNum] = newLine;
    modifications.push({
      lineNum: lineNum + 1,
      routePath: route.routePath,
      before: line.trim(),
      after: newLine.trim()
    });
  }
}

console.log('Modified route definitions:\n');
modifications.forEach(mod => {
  console.log(`Line ${mod.lineNum}: ${mod.routePath}`);
  console.log(`  Before: ${mod.before.substring(0, 100)}...`);
  console.log(`  After:  ${mod.after.substring(0, 100)}...`);
  console.log('');
});

// Write the modified content
content = lines.join('\n');
fs.writeFileSync(INDEX_FILE, content, 'utf-8');

console.log(`\n✓ Refactoring complete!`);
console.log(`✓ Modified ${modifications.length} routes`);
console.log(`✓ Updated file: ${INDEX_FILE}`);

// Print summary
console.log('\n=== SUMMARY ===');
console.log(`Routes modified: ${modifications.length}`);
console.log('Next steps:');
console.log('1. Remove dbPath extraction and validation in each route');
console.log('2. Replace sqlite3.Database(dbPath) with req.userDb');
console.log('3. Remove db.close() calls');
console.log('4. Convert async sqlite3 operations to sync better-sqlite3');
