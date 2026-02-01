// Phase 2: Convert database operations from sqlite3 to better-sqlite3
// This script:
// 1. Removes dbPath extraction and validation
// 2. Replaces new sqlite3.Database(dbPath) with req.userDb
// 3. Removes db.close() calls
// 4. Converts async callback patterns to sync

import fs from 'fs';

const INDEX_FILE = '/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js';

// Read the file
let content = fs.readFileSync(INDEX_FILE, 'utf-8');

console.log('=== Phase 2: Converting Database Operations ===\n');

// Track changes
let changes = 0;

// 1. Remove dbPath from destructuring (but keep other fields)
// Pattern: const { foo, dbPath, bar } = req.body
const dbPathDestructurePattern = /const\s+{\s*([^}]*?)dbPath\s*,?\s*([^}]*?)}\s*=\s*req\.(body|query)/g;
content = content.replace(dbPathDestructurePattern, (match, before, after, source) => {
  changes++;
  // Clean up extra commas
  let fields = (before + after).split(',').map(f => f.trim()).filter(f => f && f !== 'dbPath');
  if (fields.length > 0) {
    return `const { ${fields.join(', ')} } = req.${source}`;
  } else {
    return `// dbPath no longer needed (using req.userDb)`;
  }
});

// Also handle standalone: const { dbPath } = req.body
content = content.replace(/const\s+{\s*dbPath\s*}\s*=\s*req\.(body|query)/g, '// dbPath no longer needed (using req.userDb)');
changes++;

// 2. Remove dbPath validation checks
content = content.replace(/if\s*\(!dbPath\)\s*{[^}]*return res\.status\(400\)\.json\({[^}]*error:\s*['"]Missing dbPath['"]\s*}\)[^}]*}/gs, '// dbPath validation removed (handled by middleware)');
content = content.replace(/if\s*\(![^)]*\|\|\s*!dbPath\)/g, (match) => {
  return match.replace(/\s*\|\|\s*!dbPath/, '').replace(/!dbPath\s*\|\|\s*/, '');
});
changes++;

// 3. Remove database existence checks (middleware handles this)
content = content.replace(/if\s*\(!fs\.existsSync\(dbPath\)\)\s*{[\s\S]*?error:\s*`Database not found[\s\S]*?}\)[\s\S]*?}/g, '// Database existence check removed (handled by middleware)');
changes++;

// 4. Replace new sqlite3.Database(dbPath, ...) patterns
// This is complex because of callbacks, so we'll handle specific patterns

// Pattern: const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, callback)
content = content.replace(/const\s+db\s*=\s*new\s+sqlite3\.Database\(dbPath,\s*sqlite3\.OPEN_READWRITE,\s*\([^)]*\)\s*=>\s*{[\s\S]*?}\)/g,
  '// Using req.userDb from middleware (no connection needed)');
changes++;

// Pattern: db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
content = content.replace(/db\s*=\s*new\s+sqlite3\.Database\(dbPath,\s*sqlite3\.OPEN_READWRITE\)/g,
  '// Using req.userDb from middleware');
changes++;

// 5. Replace db variable with req.userDb in method calls
// This is tricky and needs to be done carefully to avoid breaking things
// We'll do simple replacements for common patterns

// db.close() - just remove it
content = content.replace(/\s*db\.close\(\)\s*\n?/g, '// db.close() removed (middleware handles cleanup)\n');
content = content.replace(/if\s*\(db\)\s*db\.close\(\)/g, '// db cleanup handled by middleware');
changes++;

console.log(`Applied ${changes} transformation patterns\n`);

// Write the result
fs.writeFileSync(INDEX_FILE, content, 'utf-8');

console.log('✓ Phase 2 complete!');
console.log('✓ Removed dbPath extraction and validation');
console.log('✓ Removed database connection code');
console.log('✓ Removed db.close() calls');
console.log('\nNOTE: Manual review still needed for:');
console.log('  - Converting db.run/get/all callbacks to req.userDb.prepare().run/get/all()');
console.log('  - Converting db.serialize() to linear code');
console.log('  - Updating StagingService calls to use req.userDb');
console.log('  - Converting async/callback patterns to synchronous code');
