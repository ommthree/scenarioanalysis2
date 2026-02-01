import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const indexPath = path.join(__dirname, 'index.js');

console.log('Reading index.js...');
let content = fs.readFileSync(indexPath, 'utf-8');
const originalContent = content;

// Track statistics
const stats = {
  routesRefactored: 0,
  dbPathReferencesRemoved: 0,
  sqlite3ToSyncConversions: 0,
  dbCloseCallsRemoved: 0,
  validationChecksRemoved: 0
};

// Routes to skip (already handled by separate files)
const skipPatterns = [
  /\/api\/auth\//,
  /\/api\/admin\//
];

function shouldSkipRoute(routeLine) {
  return skipPatterns.some(pattern => pattern.test(routeLine));
}

// Helper function to find the end of a route handler
function findRouteEnd(lines, startIdx) {
  let braceCount = 0;
  let inRoute = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];

    // Count braces
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        inRoute = true;
      } else if (char === '}') {
        braceCount--;
        if (inRoute && braceCount === 0) {
          return i;
        }
      }
    }
  }

  return -1;
}

// Process the file
console.log('Analyzing routes...');

const lines = content.split('\n');
const newLines = [...lines];

// Track which lines need modification
const modifications = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Match route definitions
  const routeMatch = line.match(/^app\.(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/);

  if (routeMatch) {
    const method = routeMatch[1];
    const path = routeMatch[2];

    // Skip auth and admin routes
    if (shouldSkipRoute(path)) {
      console.log(`Skipping ${method.toUpperCase()} ${path} (handled separately)`);
      continue;
    }

    // Skip health check route (doesn't use database)
    if (path === '/api/health') {
      console.log(`Skipping ${method.toUpperCase()} ${path} (no database access)`);
      continue;
    }

    // Find the route end
    const routeEnd = findRouteEnd(lines, i);
    if (routeEnd === -1) {
      console.warn(`Could not find end of route: ${path}`);
      continue;
    }

    // Get the full route block
    const routeBlock = lines.slice(i, routeEnd + 1).join('\n');

    // Check if this route uses dbPath
    const usesDbPath = /\bdbPath\b/.test(routeBlock);
    const usesDatabase = /new Database\(/.test(routeBlock) || /new sqlite3\.Database\(/.test(routeBlock);

    if (!usesDbPath && !usesDatabase) {
      console.log(`Skipping ${method.toUpperCase()} ${path} (no database access)`);
      continue;
    }

    console.log(`\nRefactoring ${method.toUpperCase()} ${path}...`);

    // Check if getUserDatabase is already in the middleware chain
    if (/getUserDatabase/.test(line)) {
      console.log(`  Already has getUserDatabase middleware`);
      continue;
    }

    // Add getUserDatabase to middleware chain
    let newLine = line;

    // Find where to insert getUserDatabase
    // Pattern 1: app.method('/path', handler)
    // Pattern 2: app.method('/path', middleware, handler)
    // Pattern 3: app.method('/path', middleware1, middleware2, handler)

    // Insert getUserDatabase after the path, before other middleware
    const pathEndMatch = line.match(/^(app\.\w+\(['"`][^'"`]+['"`]\s*,\s*)/);
    if (pathEndMatch) {
      const prefix = pathEndMatch[1];
      const suffix = line.substring(prefix.length);
      newLine = prefix + 'getUserDatabase, ' + suffix;

      modifications.push({
        lineIdx: i,
        oldLine: line,
        newLine: newLine,
        type: 'add-middleware'
      });

      stats.routesRefactored++;
      console.log(`  Added getUserDatabase middleware`);
    }
  }
}

// Apply modifications (in reverse order to preserve line numbers)
for (let i = modifications.length - 1; i >= 0; i--) {
  const mod = modifications[i];
  newLines[mod.lineIdx] = mod.newLine;
}

// Now handle dbPath removal and database connection changes
let modifiedContent = newLines.join('\n');

// Track line-by-line for more complex transformations
console.log('\n\nPhase 2: Removing dbPath references and converting database connections...');

// Pattern replacements with detailed tracking
const patterns = [
  {
    // Remove dbPath from destructuring with other properties
    pattern: /const\s+\{([^}]*),\s*dbPath\s*\}\s*=\s*req\.(body|query)/g,
    replacement: 'const { $1 } = req.$2',
    description: 'Remove dbPath from destructuring with other properties'
  },
  {
    // Remove dbPath from destructuring (only dbPath)
    pattern: /const\s+\{\s*dbPath\s*\}\s*=\s*req\.(body|query)/g,
    replacement: '// dbPath handled by getUserDatabase middleware',
    description: 'Remove standalone dbPath destructuring'
  },
  {
    // Remove dbPath validation checks
    pattern: /if\s*\(\s*!dbPath\s*\)\s*(?:return\s*)?res\.status\(\d+\)\.json\([^)]*\)[^\n]*/g,
    replacement: '// dbPath validation handled by getUserDatabase middleware',
    description: 'Remove dbPath validation'
  },
  {
    // Replace sqlite3 Database instantiation
    pattern: /const\s+db\s*=\s*new\s+sqlite3\.Database\s*\(\s*dbPath[^)]*\)/g,
    replacement: 'const db = req.userDb // Connected by getUserDatabase middleware',
    description: 'Replace sqlite3 Database connection'
  },
  {
    // Replace better-sqlite3 Database instantiation
    pattern: /const\s+db\s*=\s*new\s+Database\s*\(\s*dbPath\s*\)/g,
    replacement: 'const db = req.userDb // Connected by getUserDatabase middleware',
    description: 'Replace better-sqlite3 Database connection'
  },
  {
    // Remove db.close() calls
    pattern: /\s*db\.close\(\s*\)[^\n]*/g,
    replacement: ' // Database cleanup handled by middleware',
    description: 'Remove db.close() calls'
  }
];

patterns.forEach(({ pattern, replacement, description }) => {
  const matches = modifiedContent.match(pattern);
  if (matches) {
    console.log(`  ${description}: ${matches.length} occurrences`);
    modifiedContent = modifiedContent.replace(pattern, replacement);

    if (description.includes('dbPath')) stats.dbPathReferencesRemoved += matches.length;
    if (description.includes('close')) stats.dbCloseCallsRemoved += matches.length;
    if (description.includes('validation')) stats.validationChecksRemoved += matches.length;
  }
});

// Write the modified content
console.log('\n\nWriting modified index.js...');
fs.writeFileSync(indexPath, modifiedContent, 'utf-8');

// Print statistics
console.log('\n\n=== REFACTORING SUMMARY ===');
console.log(`Routes refactored: ${stats.routesRefactored}`);
console.log(`dbPath references removed: ${stats.dbPathReferencesRemoved}`);
console.log(`db.close() calls removed: ${stats.dbCloseCallsRemoved}`);
console.log(`Validation checks removed: ${stats.validationChecksRemoved}`);
console.log('\nRefactoring complete!');

// Verify the file is valid JavaScript
console.log('\n\nVerifying JavaScript syntax...');
try {
  await import('./index.js');
  console.log('✓ JavaScript syntax is valid');
} catch (error) {
  console.error('✗ Syntax error detected:', error.message);
  console.error('\nRestoring original content...');
  fs.writeFileSync(indexPath, originalContent, 'utf-8');
  console.error('Original content restored. Please review the errors above.');
  process.exit(1);
}

console.log('\n✓ All done!');
