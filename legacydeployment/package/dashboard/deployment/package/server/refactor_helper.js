#!/usr/bin/env node

/**
 * Helper script to identify routes needing refactoring in index.js
 * This script scans for patterns and suggests refactorings
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const indexPath = path.join(__dirname, 'index.js')
const content = fs.readFileSync(indexPath, 'utf-8')
const lines = content.split('\n')

// Find all instances of "new sqlite3.Database(dbPath"
let count = 0
let routeInfo = []

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('new sqlite3.Database(dbPath')) {
    count++
    // Find the route definition above this line
    let routeLine = i
    for (let j = i - 1; j >= Math.max(0, i - 50); j--) {
      if (lines[j].match(/^app\.(get|post|put|delete)\('/)) {
        routeLine = j
        break
      }
    }

    const match = lines[routeLine].match(/^app\.(get|post|put|delete)\('([^']+)'/)
    if (match) {
      const [, method, route] = match
      routeInfo.push({
        line: i + 1,
        routeLine: routeLine + 1,
        method: method.toUpperCase(),
        route,
        openMode: lines[i].includes('READONLY') ? 'READ' : 'WRITE'
      })
    }
  }
}

console.log(`Found ${count} routes still needing refactoring:\n`)

// Group by method
const byMethod = {}
routeInfo.forEach(info => {
  if (!byMethod[info.method]) byMethod[info.method] = []
  byMethod[info.method].push(info)
})

Object.keys(byMethod).sort().forEach(method => {
  console.log(`\n${method} routes (${byMethod[method].length}):`)
  byMethod[method].forEach(info => {
    console.log(`  Line ${info.line}: ${info.route} (${info.openMode})`)
  })
})

console.log(`\n\nTotal: ${count} routes to refactor`)
