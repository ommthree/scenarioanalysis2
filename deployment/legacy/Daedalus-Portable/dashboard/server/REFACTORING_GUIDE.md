# Index.js Refactoring Guide: Per-User Database Isolation

## Overview

This guide documents the refactoring of `/Users/Owen/ScenarioAnalysis2/dashboard/server/index.js` to use the `getUserDatabase` middleware for per-user database isolation.

### Current State
- **File Size**: 10,545 lines
- **Total Endpoints**: 100+
- **Database Library**: sqlite3 (async, callback-based)
- **Auth Pattern**: Endpoints receive `dbPath` from `req.body` or `req.query`

### Target State
- **Database Library**: better-sqlite3 (synchronous)
- **Auth Pattern**: Middleware provides `req.userDb` based on session
- **Isolation**: Each user's database is automatically scoped by middleware

---

## Prerequisites Completed

### 1. Better-sqlite3 Import Added
```javascript
import Database from 'better-sqlite3'
```

### 2. StagingService Updated
The `StagingService` class has been updated with auto-detection to work with both sqlite3 and better-sqlite3:

```javascript
// Async methods automatically detect database type
await stagingService.dbRun(sql, params)  // Works with both
await stagingService.dbGet(sql, params)  // Works with both
await stagingService.dbAll(sql, params)  // Works with both
```

---

## Refactoring Pattern

### Step-by-Step Transformation

#### BEFORE:
```javascript
app.post('/api/some-route', upload.single('file'), async (req, res) => {
  const { someData, dbPath } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message })
    }
  })

  // Async callback-based operations
  db.run('INSERT INTO table VALUES (?)', [value], function(err) {
    if (err) {
      db.close()
      return res.status(500).json({ error: err.message })
    }

    db.get('SELECT * FROM table WHERE id = ?', [this.lastID], (err, row) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: err.message })
      }
      res.json({ success: true, data: row })
    })
  })
})
```

#### AFTER:
```javascript
app.post('/api/some-route', getUserDatabase, upload.single('file'), async (req, res) => {
  const { someData } = req.body  // No dbPath needed

  try {
    // Synchronous better-sqlite3 operations
    const stmt = req.userDb.prepare('INSERT INTO table VALUES (?)')
    const result = stmt.run(value)

    const row = req.userDb.prepare('SELECT * FROM table WHERE id = ?').get(result.lastInsertRowid)

    res.json({ success: true, data: row })
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: error.message })
  }
  // No db.close() - middleware handles cleanup
})
```

### Key Changes:

1. **Add Middleware**: Insert `getUserDatabase` into route definition
   - Before: `app.post('/api/route', upload.single('file'), async (req, res) =>`
   - After: `app.post('/api/route', getUserDatabase, upload.single('file'), async (req, res) =>`

2. **Remove dbPath**:
   - Remove from destructuring: `const { data } = req.body` (no dbPath)
   - Remove validation: Delete `if (!dbPath)` checks
   - Remove existence checks: Delete `if (!fs.existsSync(dbPath))` checks

3. **Replace Database Connection**:
   - Remove: `const db = new sqlite3.Database(dbPath, ...)`
   - Use: `req.userDb` (provided by middleware)

4. **Convert Async to Sync**:
   - sqlite3 pattern: `db.run(sql, params, function(err) { ... })`
   - better-sqlite3: `req.userDb.prepare(sql).run(...params)`

   - sqlite3 pattern: `db.get(sql, params, (err, row) => { ... })`
   - better-sqlite3: `const row = req.userDb.prepare(sql).get(...params)`

   - sqlite3 pattern: `db.all(sql, params, (err, rows) => { ... })`
   - better-sqlite3: `const rows = req.userDb.prepare(sql).all(...params)`

5. **Remove db.close()**:
   - The middleware's cleanup handler automatically closes the connection

6. **Wrap in try-catch**:
   - better-sqlite3 throws errors synchronously
   - Use try-catch instead of callback error handling

---

## Special Cases

### 1. Routes with StagingService

```javascript
// BEFORE
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
const stagingService = new StagingService(db)
// ... use stagingService
db.close()

// AFTER
const stagingService = new StagingService(req.userDb)
// ... use stagingService (auto-detects better-sqlite3)
// No close needed
```

### 2. Routes with db.serialize()

```javascript
// BEFORE
db.serialize(() => {
  db.run('DROP TABLE IF EXISTS temp')
  db.run('CREATE TABLE temp (...)', (err) => {
    // nested callbacks
  })
})

// AFTER
try {
  req.userDb.exec('DROP TABLE IF EXISTS temp')
  req.userDb.exec('CREATE TABLE temp (...)')
  // Linear code, no callbacks
} catch (error) {
  // handle error
}
```

### 3. Batch Insert Patterns

```javascript
// BEFORE
const stmt = db.prepare('INSERT INTO table VALUES (?, ?)')
for (const record of records) {
  stmt.run(record.a, record.b, (err) => {
    if (err) console.error(err)
  })
}
stmt.finalize((err) => {
  db.close()
  res.json({ success: true })
})

// AFTER
try {
  const stmt = req.userDb.prepare('INSERT INTO table VALUES (?, ?)')
  for (const record of records) {
    stmt.run(record.a, record.b)
  }
  res.json({ success: true })
} catch (error) {
  res.status(500).json({ error: error.message })
}
```

### 4. Query Parameter Routes (GET requests)

```javascript
// BEFORE
app.get('/api/some-data', (req, res) => {
  const { dbPath } = req.query
  if (!dbPath) return res.status(400).json({ error: 'Missing dbPath' })
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) return res.status(500).json({ error: err.message })
  })
  db.all('SELECT * FROM table', [], (err, rows) => {
    db.close()
    if (err) return res.status(500).json({ error: err.message })
    res.json({ data: rows })
  })
})

// AFTER
app.get('/api/some-data', getUserDatabase, (req, res) => {
  try {
    const rows = req.userDb.prepare('SELECT * FROM table').all()
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

---

## Routes That Should NOT Use getUserDatabase

These routes should be skipped:

- `/api/auth/*` - Authentication routes (use master DB)
- `/api/admin/*` - Admin routes (use master DB)
- `/api/health` - Health check (no DB needed)

### Special Handling Routes

These routes need custom logic:

- `/api/database/browse` - Should list only user's database directory
- `/api/database/backup` - Should backup only user's database
- `/api/database/backups` - Should list only user's backups
- `/api/database/restore` - Should restore only user's database

---

## API Differences: sqlite3 vs better-sqlite3

| Operation | sqlite3 (async) | better-sqlite3 (sync) |
|-----------|----------------|----------------------|
| Insert | `db.run(sql, params, function(err) { this.lastID })` | `db.prepare(sql).run(...params).lastInsertRowid` |
| Select One | `db.get(sql, params, (err, row) => {})` | `db.prepare(sql).get(...params)` |
| Select Many | `db.all(sql, params, (err, rows) => {})` | `db.prepare(sql).all(...params)` |
| Execute | `db.exec(sql, (err) => {})` | `db.exec(sql)` |
| Prepare | `const stmt = db.prepare(sql)` | `const stmt = db.prepare(sql)` |
| Last ID | `this.lastID` (in callback) | `result.lastInsertRowid` |
| Changes | `this.changes` (in callback) | `result.changes` |
| Close | `db.close()` | `db.close()` (not needed with middleware) |

---

## Recommended Refactoring Order

1. **Data Upload Routes** (highest priority):
   - `/api/statements/load`
   - `/api/scenarios/load`
   - `/api/locations/load`
   - `/api/damage-curves/load`
   - `/api/hazard-maps/load`

2. **Query Routes** (medium priority):
   - `/api/results/*`
   - `/api/scenarios/list`
   - `/api/entities`
   - `/api/drivers`

3. **Configuration Routes** (medium priority):
   - `/api/templates/*`
   - `/api/validation-rules`
   - `/api/management-actions`

4. **Staging/Admin Routes** (lower priority):
   - `/api/staging/*`
   - `/api/staged-files/*`
   - `/api/runs/*`

---

## Testing Checklist

After refactoring each route:

- [ ] Syntax check: `node --check index.js`
- [ ] Test authentication: Ensure middleware rejects unauthenticated requests
- [ ] Test happy path: Verify route works with valid user session
- [ ] Test error cases: Verify proper error handling
- [ ] Verify no memory leaks: Check that connections are closed
- [ ] Check logs: Ensure no "database is locked" errors

---

## Common Pitfalls

1. **Forgetting to add middleware**: Route still expects dbPath
2. **Using old variable name**: `db` instead of `req.userDb`
3. **Not removing db.close()**: Creates double-close errors
4. **Mixing async/await with sync**: Code structure confusion
5. **Not handling errors**: better-sqlite3 throws, must catch
6. **Orphaned callbacks**: Removing DB connection but leaving callback structure

---

## Progress Tracking

### Routes Modified: 2 / 100+

### Completed Routes:
1. ✅ `/api/statements/load` - Full refactoring with better-sqlite3
2. ✅ `/api/scenarios/load` - Full refactoring with StagingService

### Routes Needing Attention:
- 98+ routes still using old pattern
- See "Recommended Refactoring Order" above

---

## Support Files Modified

1. ✅ `staging_service.js` - Added sync methods with auto-detection
2. ✅ `middleware/database.js` - Already provides getUserDatabase

---

## Automation Note

Due to the file's size (10,545 lines) and complexity of async callback patterns, automated refactoring is error-prone. Manual refactoring with careful testing is recommended for each route or small group of related routes.

Consider breaking index.js into smaller route files after refactoring:
- `routes/statements.js`
- `routes/scenarios.js`
- `routes/locations.js`
- `routes/results.js`
etc.
