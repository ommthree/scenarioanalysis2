#!/usr/bin/env node
/**
 * Apply getUserDatabase middleware to all routes
 * This is a MINIMAL refactoring that only adds the middleware,
 * without touching internal database logic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = path.join(__dirname, 'index.js');

console.log('Applying getUserDatabase middleware refactoring...\n');

let content = fs.readFileSync(indexPath, 'utf-8');
let routeCount = 0;

// Step 1: Add imports (if not present)
if (!content.includes('./middleware/database.js')) {
  console.log('Adding imports...');
  content = content.replace(
    "import WhatIfService from './whatif_service.js'",
    `import WhatIfService from './whatif_service.js'
import session from 'express-session'
import ConnectSqlite3 from 'connect-sqlite3'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import { getUserDatabase } from './middleware/database.js'`
  );
}

// Step 2: Update CORS
if (content.includes('app.use(cors())')) {
  console.log('Updating CORS...');
  content = content.replace(
    'app.use(cors())',
    `app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))`
  );
}

// Step 3: Add session configuration
if (!content.includes('app.use(session')) {
  console.log('Adding session configuration...');
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
}

// Step 4: Add getUserDatabase to route definitions
console.log('Adding getUserDatabase to routes...');

const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Match route definitions: app.METHOD('/path', ...
  const match = line.match(/^(app\.(get|post|put|delete|patch))\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(.+)$/);

  if (match) {
    const [, appMethod, method, routePath, rest] = match;

    // Skip auth, admin, and health routes
    if (routePath.includes('/api/auth/') || routePath.includes('/api/admin/') || routePath === '/api/health') {
      newLines.push(line);
      continue;
    }

    // Skip if already has getUserDatabase
    if (line.includes('getUserDatabase')) {
      newLines.push(line);
      continue;
    }

    // Add getUserDatabase
    newLines.push(`${appMethod}('${routePath}', getUserDatabase, ${rest}`);
    routeCount++;
    continue;
  }

  newLines.push(line);
}

content = newLines.join('\n');

// Write the file
fs.writeFileSync(indexPath, content);

console.log(`\n✓ Successfully added getUserDatabase to ${routeCount} routes`);
console.log('\nRun "node --check index.js" to verify syntax.');
