#!/usr/bin/env node
/**
 * Update database paths in users.db for production deployment
 * This script updates paths from local Mac paths to server paths
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the users.db path from command line or use default
const usersDbPath = process.argv[2] || join(__dirname, '../data/users.db');

console.log(`Updating database paths in: ${usersDbPath}`);

const db = new Database(usersDbPath);

// Update paths to production server locations
const updates = [
  { username: 'OwenAdmin', path: '/home/ubuntu/app/data/users/admin/scenario_analysis.db' },
  { username: 'OwenExplorer', path: '/home/ubuntu/app/data/users/common/scenario_analysis.db' },
  { username: 'OwenUser', path: '/home/ubuntu/app/data/users/OwenUser/scenario_analysis.db' },
  // OwenViewer uses /dev/null, no update needed
];

const updateStmt = db.prepare('UPDATE users SET db_path = ? WHERE username = ?');

updates.forEach(({ username, path }) => {
  const result = updateStmt.run(path, username);
  if (result.changes > 0) {
    console.log(`✓ Updated ${username} -> ${path}`);
  } else {
    console.log(`✗ No user found with username: ${username}`);
  }
});

console.log('\nCurrent paths:');
const users = db.prepare('SELECT username, db_path FROM users ORDER BY id').all();
users.forEach(u => console.log(`  ${u.username}: ${u.db_path}`));

db.close();
console.log('\n✓ Database paths updated successfully');
