#!/usr/bin/env node
/**
 * Fix syntax errors from the refactoring
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const indexPath = path.join(__dirname, 'index.js');

console.log('Fixing syntax errors...\n');

let content = fs.readFileSync(indexPath, 'utf-8');

// Fix 1: Remove orphaned braces after const db = req.userDb
console.log('1. Removing orphaned braces after database assignment...');
content = content.replace(
  /(const db = req\.userDb \/\/ Connected by getUserDatabase middleware)\s*\n\s*\}\s*\n\s*\}\)/g,
  '$1'
);

// Fix 2: Remove any remaining dbPath references
console.log('2. Removing remaining dbPath references...');
content = content.replace(/\bdbPath\b/g, 'req.userDb');

// Fix 3: Remove standalone orphaned closing braces
console.log('3. Cleaning up standalone orphaned braces...');
const lines = content.split('\n');
const fixedLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  const nextLine = lines[i + 1] || '';

  // Check for orphaned closing braces after const db assignment
  if (line.includes('const db = req.userDb') &&
      nextLine.trim() === '}' &&
      lines[i + 2] && lines[i + 2].trim() === '})') {
    fixedLines.push(line);
    i += 3; // Skip the orphaned braces
    continue;
  }

  fixedLines.push(line);
  i++;
}

content = fixedLines.join('\n');

// Write fixed content
fs.writeFileSync(indexPath, content);

console.log('\n✓ Syntax fixes applied!\n');
console.log('Verifying syntax...');

// Test syntax
import { exec } from 'child_process';
exec('node --check ' + indexPath, (error, stdout, stderr) => {
  if (error) {
    console.error('✗ Syntax error still present:');
    console.error(stderr);
    process.exit(1);
  } else {
    console.log('✓ Syntax is now valid!');
  }
});
