#!/usr/bin/env node
/**
 * Minimal, safe refactoring:
 * 1. Add imports and session setup
 * 2. Add getUserDatabase middleware to route definitions ONLY
 * 3. Do NOT modify database connection logic (leave for manual conversion)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

console.log('Starting minimal, safe refactoring...\n');

let content = fs.readFileSync(indexPath, 'utf-8');
const original = content;

// Step 1: Add imports
console.log('Step 1: Adding imports...');
if (!content.includes('./middleware/database.js')) {
  content = content.replace(
    "import WhatIfService from './whatif_service.js'",
    `import WhatIfService from './whatif_service.js'
import session from 'express-session'
import ConnectSqlite3 from 'connect-sqlite3'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import { getUserDatabase } from './middleware/database.js'`
  );
  console.log('  ✓ Imports added');
}

// Step 2: Update CORS
console.log('\nStep 2: Updating CORS...');
if (content.includes('app.use(cors())')) {
  content = content.replace(
    'app.use(cors())',
    `app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))`
  );
  console.log('  ✓ CORS updated');
}

// Step 3: Add session configuration
console.log('\nStep 3: Adding session configuration...');
if (!content.includes('app.use(session')) {
  const insertPoint = 'app.use(express.urlencoded({ limit: \'50mb\', extended: true }))';
  content = content.replace(
    insertPoint,
    `${insertPoint}

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
app.use('/api/admin', adminRoutes)`
  );
  console.log('  ✓ Session configuration added');
}

// Step 4: Add getUserDatabase to ALL route definitions
console.log('\nStep 4: Adding getUserDatabase to route definitions...');

const routePattern = /^(app\.(get|post|put|delete|patch)\s*\(\s*['"`](?!\/api\/auth\/|\/api\/admin\/|\/api\/health)([^'"`]+)['"`]\s*,\s*)(?!getUserDatabase)/gm;

let routeCount = 0;
content = content.replace(routePattern, (match, prefix) => {
  routeCount++;
  return prefix + 'getUserDatabase, ';
});

console.log(`  ✓ Added getUserDatabase to ${routeCount} routes`);

// Step 5: Verify syntax before writing
console.log('\nStep 5: Writing file...');
fs.writeFileSync(indexPath + '.new', content);

// Test the new file
try {
  import('child_process').then(({ execSync }) => {
    try {
      execSync(`node --check "${indexPath}.new"`, { encoding: 'utf-8' });
      console.log('  ✓ Syntax validation passed!');

      // Create backup and write new file
      fs.writeFileSync(indexPath + '.pre-refactor-backup', original);
      fs.writeFileSync(indexPath, content);
      fs.unlinkSync(indexPath + '.new');

      console.log('\n' + '='.repeat(60));
      console.log('SUCCESS!');
      console.log('='.repeat(60));
      console.log(`Routes modified: ${routeCount}`);
      console.log('Backup saved to: index.js.pre-refactor-backup');
      console.log('\nNOTE: Routes now have getUserDatabase middleware, but still');
      console.log('use dbPath internally. req.userDb is available but not yet used.');
      console.log('This allows testing the middleware without breaking existing code.');
      console.log('='.repeat(60));
    } catch (error) {
      console.error('✗ Syntax error detected!');
      console.error(error.message);
      fs.unlinkSync(indexPath + '.new');
      process.exit(1);
    }
  });
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
