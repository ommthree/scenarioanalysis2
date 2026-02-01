#!/usr/bin/env node
/**
 * Complete refactoring script to add getUserDatabase middleware
 * and migrate from dbPath to req.userDb
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const indexPath = path.join(__dirname, 'index.js');

console.log('='.repeat(70));
console.log('DAEDALUS API ROUTE REFACTORING');
console.log('='.repeat(70));
console.log('\nReading index.js...');

let content = fs.readFileSync(indexPath, 'utf-8');
const originalContent = content;
let modified = false;

// Stats
const stats = {
  importsAdded: 0,
  middlewareSetup: 0,
  routesRefactored: 0,
  dbPathRemoved: 0,
  dbConnectionsFixed: 0
};

// Step 1: Add session and auth imports if not present
console.log('\n' + '='.repeat(70));
console.log('STEP 1: Adding session and authentication setup');
console.log('='.repeat(70));

if (!content.includes('express-session')) {
  console.log('  Adding express-session import...');
  const importLine = "import WhatIfService from './whatif_service.js'";
  if (content.includes(importLine)) {
    content = content.replace(
      importLine,
      importLine + "\nimport session from 'express-session'\nimport ConnectSqlite3 from 'connect-sqlite3'"
    );
    stats.importsAdded++;
    modified = true;
  }
}

if (!content.includes('./routes/auth.js')) {
  console.log('  Adding auth routes import...');
  const importLine = "import WhatIfService from './whatif_service.js'";
  if (content.includes(importLine)) {
    content = content.replace(
      importLine,
      importLine + "\nimport authRoutes from './routes/auth.js'\nimport adminRoutes from './routes/admin.js'"
    );
    stats.importsAdded++;
    modified = true;
  }
}

if (!content.includes('./middleware/database.js')) {
  console.log('  Adding getUserDatabase middleware import...');
  const importLine = "import WhatIfService from './whatif_service.js'";
  if (content.includes(importLine)) {
    content = content.replace(
      importLine,
      importLine + "\nimport { getUserDatabase } from './middleware/database.js'"
    );
    stats.importsAdded++;
    modified = true;
  }
}

// Step 2: Add session configuration if not present
if (!content.includes('express-session') && !content.includes('app.use(session')) {
  console.log('  Adding session configuration...');
  const appSetup = 'app.use(express.urlencoded({ limit: \'50mb\', extended: true }))';
  if (content.includes(appSetup)) {
    const sessionConfig = `

// Session configuration for authentication
const SQLiteStore = ConnectSqlite3(session)

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '../../data')
  }),
  secret: process.env.SESSION_SECRET || 'daedalus-dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  proxy: process.env.NODE_ENV === 'production' // trust proxy in production
}))

// Mount auth routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
`;
    content = content.replace(appSetup, appSetup + sessionConfig);
    stats.middlewareSetup++;
    modified = true;
  }
}

// Step 3: Update CORS configuration to support credentials
if (content.includes('app.use(cors())')) {
  console.log('  Updating CORS configuration for credentials...');
  content = content.replace(
    'app.use(cors())',
    `app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))`
  );
  modified = true;
}

// Step 4: Add getUserDatabase middleware to all API routes
console.log('\n' + '='.repeat(70));
console.log('STEP 2: Adding getUserDatabase middleware to API routes');
console.log('='.repeat(70));

const lines = content.split('\n');
const newLines = [];
const routesToSkip = ['/api/auth/', '/api/admin/', '/api/health'];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Match route definitions
  const routeMatch = line.match(/^app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/);

  if (routeMatch) {
    const method = routeMatch[1];
    const routePath = routeMatch[2];

    // Skip certain routes
    const shouldSkip = routesToSkip.some(pattern => routePath.includes(pattern));

    if (!shouldSkip && !line.includes('getUserDatabase')) {
      // Add getUserDatabase after the route path
      const pathMatch = line.match(/^(app\.\w+\(['"`][^'"`]+['"`]\s*,\s*)/);
      if (pathMatch) {
        const prefix = pathMatch[1];
        const suffix = line.substring(prefix.length);
        newLines.push(prefix + 'getUserDatabase, ' + suffix);
        console.log(`  ✓ ${method.toUpperCase()} ${routePath}`);
        stats.routesRefactored++;
        modified = true;
        continue;
      }
    }
  }

  newLines.push(line);
}

content = newLines.join('\n');

// Step 5: Remove dbPath from routes
console.log('\n' + '='.repeat(70));
console.log('STEP 3: Removing dbPath references');
console.log('='.repeat(70));

// Remove dbPath from destructuring
const dbPathPatterns = [
  { pattern: /const\s+\{\s*([^}]+),\s*dbPath\s*\}\s*=\s*req\.(body|query)/g, replacement: 'const { $1 } = req.$2' },
  { pattern: /const\s+\{\s*dbPath\s*,\s*([^}]+)\s*\}\s*=\s*req\.(body|query)/g, replacement: 'const { $1 } = req.$2' },
  { pattern: /const\s+\{\s*dbPath\s*\}\s*=\s*req\.(body|query)/g, replacement: '// dbPath removed: handled by getUserDatabase middleware' },
];

dbPathPatterns.forEach(({ pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    console.log(`  Removing dbPath from destructuring: ${matches.length} occurrences`);
    content = content.replace(pattern, replacement);
    stats.dbPathRemoved += matches.length;
    modified = true;
  }
});

// Remove dbPath validation checks
[
  { pattern: /if\s*\(\s*!(?:file|statementType)\s*\|\|\s*!(?:statementType|file)\s*\|\|\s*!dbPath\s*\)/g, replacement: 'if (!file || !statementType)' },
  { pattern: /if\s*\(\s*!dbPath\s*\)\s+return\s+res\.status\(\d+\)\.json\([^)]+\)[^\n]*/g, replacement: '// dbPath validation removed: handled by getUserDatabase middleware' },
].forEach(({ pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    console.log(`  Removing dbPath validation: ${matches.length} occurrences`);
    content = content.replace(pattern, replacement);
    modified = true;
  }
});

// Remove dbPath from console.log statements
content = content.replace(/,\s*dbPath:\s*req\.body\.dbPath/g, '');
content = content.replace(/dbPath:\s*req\.body\.dbPath,\s*/g, '');

// Step 6: Replace database connections
console.log('\n' + '='.repeat(70));
console.log('STEP 4: Replacing database connections');
console.log('='.repeat(70));

// Replace sqlite3.Database with req.userDb
const dbConnectionPattern = /const\s+db\s*=\s*new\s+sqlite3\.Database\s*\(\s*dbPath\s*(?:,\s*[^,)]+)?(?:,\s*\([^)]*\)\s*=>\s*\{[^}]*\}\s*)?\)/g;
const dbMatches = content.match(dbConnectionPattern);
if (dbMatches) {
  console.log(`  Replacing sqlite3.Database connections: ${dbMatches.length} occurrences`);
  content = content.replace(dbConnectionPattern, 'const db = req.userDb // Connected by getUserDatabase middleware');
  stats.dbConnectionsFixed += dbMatches.length;
  modified = true;
}

// Remove db.close() calls
const closePattern = /\s*db\.close\(\s*\)/g;
const closeMatches = content.match(closePattern);
if (closeMatches) {
  console.log(`  Removing db.close() calls: ${closeMatches.length} occurrences`);
  content = content.replace(closePattern, ' // Database cleanup handled by middleware');
  modified = true;
}

// Write modified content
if (modified) {
  console.log('\n' + '='.repeat(70));
  console.log('Writing refactored index.js...');
  console.log('='.repeat(70));

  // Create backup
  const backupPath = indexPath + '.backup';
  fs.writeFileSync(backupPath, originalContent);
  console.log(`  Backup saved to: ${backupPath}`);

  // Write new content
  fs.writeFileSync(indexPath, content);
  console.log(`  Updated: ${indexPath}`);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('REFACTORING SUMMARY');
  console.log('='.repeat(70));
  console.log(`Imports added: ${stats.importsAdded}`);
  console.log(`Middleware setup: ${stats.middlewareSetup}`);
  console.log(`Routes refactored: ${stats.routesRefactored}`);
  console.log(`dbPath references removed: ${stats.dbPathRemoved}`);
  console.log(`Database connections fixed: ${stats.dbConnectionsFixed}`);
  console.log('='.repeat(70));
  console.log('\n✓ Refactoring complete!');
  console.log('\nNOTE: Some routes may still use sqlite3 callback-style code.');
  console.log('These will continue to work but should be converted to better-sqlite3 sync API.');
} else {
  console.log('\n✓ No changes needed - file is already refactored!');
}

console.log('\n' + '='.repeat(70));
