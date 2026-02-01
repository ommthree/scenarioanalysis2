#!/usr/bin/env node
// CLI tool to create the first admin user

import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdmin() {
  console.log('\n=== Daedalus Admin User Creation ===\n');

  // Get username
  const username = await question('Enter admin username: ');
  if (!username || username.length < 3) {
    console.error('Error: Username must be at least 3 characters');
    rl.close();
    process.exit(1);
  }

  // Get email (optional)
  const email = await question('Enter admin email (optional): ');

  // Get password
  const password = await question('Enter admin password (min 8 characters): ');
  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    rl.close();
    process.exit(1);
  }

  const confirmPassword = await question('Confirm password: ');
  if (password !== confirmPassword) {
    console.error('Error: Passwords do not match');
    rl.close();
    process.exit(1);
  }

  rl.close();

  try {
    // Connect to master database
    const dbPath = path.join(__dirname, '../../data/users.db');
    if (!fs.existsSync(dbPath)) {
      console.error(`Error: Master database not found at ${dbPath}`);
      console.error('Please run: sqlite3 data/users.db < scripts/create_users_table.sql');
      process.exit(1);
    }

    const db = new Database(dbPath);

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      console.error(`Error: User '${username}' already exists`);
      process.exit(1);
    }

    // Hash password
    console.log('\nHashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user directory and database
    const userDir = path.join(__dirname, '../../data/users', username);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const userDbPath = path.join(userDir, 'scenario_analysis.db');

    // Copy schema to create new database
    const schemaPath = path.join(__dirname, '../../data/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Creating admin database...');
      const userDb = new Database(userDbPath);
      const schema = fs.readFileSync(schemaPath, 'utf8');
      userDb.exec(schema);
      userDb.close();
    } else {
      console.warn(`Warning: Schema file not found at ${schemaPath}`);
      console.warn('Creating empty database...');
      const userDb = new Database(userDbPath);
      userDb.close();
    }

    // Insert admin user
    console.log('Creating admin user...');
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role, db_path)
      VALUES (?, ?, ?, 'admin', ?)
    `).run(username, email || null, passwordHash, userDbPath);

    db.close();

    console.log('\n✅ Admin user created successfully!');
    console.log(`\nUsername: ${username}`);
    console.log(`Email: ${email || '(not set)'}`);
    console.log(`Role: admin`);
    console.log(`Database: ${userDbPath}`);
    console.log(`\nYou can now login at http://localhost:5173/login`);

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdmin();
