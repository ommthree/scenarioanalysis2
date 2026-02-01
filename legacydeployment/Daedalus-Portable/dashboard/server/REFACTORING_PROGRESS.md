# Refactoring Progress Report

## Summary

**Date:** 2025-11-14
**Total Routes:** 123
**Refactored:** 13
**Remaining:** 110

## Completed Refactorings

The following routes have been successfully refactored from sqlite3 callback style to better-sqlite3 synchronous style:

### Priority 1: Critical Data Display Routes

1. **`/api/scenarios/list` (GET)** - Line 5399
   - ✅ Refactored nested queries to sequential sync calls
   - ✅ Removed dbPath extraction
   - ✅ Uses req.userDb

2. **`/api/entities` (GET)** - Line 3349
   - ✅ Simple query refactored
   - ✅ Single db.all() converted to prepare().all()

### Priority 2: Basic Data Routes

3. **`/api/drivers` (GET)** - Line 2518
   - ✅ Simple query refactored

4. **`/api/entity-levels` (GET)** - Line 2535
   - ✅ Simple query refactored

5. **`/api/perils` (GET)** - Line 4397
   - ✅ Simple query with mapping logic refactored

### Priority 3: Statement Templates

6. **`/api/statement-templates` (GET)** - Line 1602
   - ✅ Simple query refactored

7. **`/api/statement-templates/:code` (GET)** - Line 1616
   - ✅ Single row query with JSON parsing refactored

8. **`/api/templates/list` (POST)** - Line 849
   - ✅ Query with complex mapping logic refactored

### Priority 4: Statement Mappings

9. **`/api/statements/get-hierarchical-mapping` (GET)** - Line 1121
   - ✅ Single row query with JSON parsing refactored

10. **`/api/statements/get-all-mappings` (GET)** - Line 1165
    - ✅ Query with array mapping refactored

11. **`/api/statements/types` (POST)** - Line 885
    - ✅ System table query refactored

## Routes Still Needing Refactoring

### High Priority User-Facing Routes (Simple Queries)

These should be refactored next as they're frequently used and have simple patterns:

#### GET Routes (48 remaining)
- `/api/staged-files/:fileType` - Line 1718
- `/api/staged-files/:fileId/preview` - Line 2041
- `/api/scenarios/staging-tables` - Line 2168
- `/api/scenarios/staging-columns` - Line 2225
- `/api/scenarios/staging-preview` - Line 2275
- `/api/scenarios/get-currencies` - Line 2324
- `/api/scenarios/unique-values` - Line 2594
- `/api/scenarios/get-scenario-mapping` - Line 2808
- `/api/locations/staging-preview` - Line 3006
- `/api/locations` - Line 3086
- `/api/locations/staging-full` - Line 3141
- `/api/locations/staging-tables` - Line 3183
- `/api/locations/get-location-mapping` - Line 3563
- `/api/mc-results` - Line 3626
- `/api/mc-timeseries` - Line 3803
- `/api/monte-carlo/distribution` - Line 3953
- `/api/damage-curves/staging-preview` - Line 4274
- `/api/damage-curves/staging-tables` - Line 4376
- `/api/damage-curves/get-damage-curve-mapping` - Line 4736
- `/api/validation-rules` - Line 5043
- `/api/scenarios/:scenarioId/drivers` - Line 5367
- `/api/scenarios/:scenarioId/results` - Line 5410
- `/api/management-actions` - Line 5449
- `/api/management-actions/:actionCode` - Line 5483
- `/api/action-entities` - Line 5709
- `/api/scenario-actions` - Line 5802
- `/api/management-actions/:actionCode/export` - Line 5869
- `/api/physical-perils` - Line 6128
- `/api/hazard-maps/get-hazard-map-mapping` - Line 6231
- `/api/hazard-maps/list-mappings` - Line 6278
- `/api/hazard-maps/get-scenarios` - Line 6311
- `/api/results/scenarios` - Line 7031
- `/api/results/periods` - Line 7067
- `/api/results/statement` - Line 7106
- `/api/results/entities` - Line 7249
- `/api/results/driver-decomposition` - Line 7283
- `/api/results/driver-mappings` - Line 7424
- `/api/results/mac-curve` - Line 7477
- `/api/results/roi-curve` - Line 7664
- `/api/results/mc-summary` - Line 7847
- `/api/results/mc-distribution` - Line 7903
- `/api/results/period-range` - Line 8268
- `/api/results/risk-line-items` - Line 8318
- `/api/results/what-if-values` - Line 8403
- `/api/runs/list` - Line 9050
- `/api/staging/list` - Line 9357
- `/api/staging/orphaned` - Line 9383
- `/api/staging/:stagingId` - Line 9413

#### POST Routes (46 remaining)
- `/api/statements/load` - Line 112 (Complex - file upload)
- `/api/scenarios/load` - Line 259 (Complex - file upload)
- `/api/scenarios/load-batch` - Line 359 (Complex - file upload)
- `/api/templates/save` - Line 779
- `/api/statements/staging` - Line 940
- `/api/statements/save-mapping` - Line 993
- `/api/statements/save-hierarchical-mapping` - Line 1042
- `/api/statements/save-mapped-data` - Line 1194
- `/api/entities/list` - Line 1392
- `/api/entities/save` - Line 1430
- `/api/entities/delete` - Line 1498
- `/api/statement-templates` - Line 1595
- `/api/staged-files` - Line 1670
- `/api/scenarios/save-mapping` - Line 2364
- `/api/drivers` - Line 2445
- `/api/scenarios/save-file-config` - Line 2638
- `/api/scenarios/save-scenario-mapping` - Line 2731
- `/api/locations/load` - Line 2914 (Complex - file upload)
- `/api/locations/save-mapping` - Line 3046
- `/api/locations/save-location-mapping` - Line 3279
- `/api/locations/ingest` - Line 3377
- `/api/damage-curves/load-batch` - Line 4063 (Complex - file upload)
- `/api/damage-curves/load` - Line 4186 (Complex - file upload)
- `/api/damage-curves/save-mapping` - Line 4340
- `/api/damage-curves/save-damage-curve-mapping` - Line 4485
- `/api/damage-curves/ingest` - Line 4580
- `/api/scenario-mappings/save` - Line 4798
- `/api/validation-rules` - Line 5090
- `/api/hazard-maps/load` - Line 5206 (Complex - file upload)
- `/api/management-actions` - Line 5542
- `/api/scenario-actions` - Line 5667
- `/api/action-entities` - Line 5742
- `/api/management-actions/import` - Line 5920 (Complex - file upload)
- `/api/action-transformations/save` - Line 6002
- `/api/action-triggers/save` - Line 6086
- `/api/hazard-maps/save-hazard-map-mapping` - Line 6169
- `/api/hazard-maps/save-scenario-mappings` - Line 6346
- `/api/ingest/statements` - Line 6407 (Complex - nested serialize)
- `/api/ingest/scenarios` - Line 6586 (Complex - nested serialize)
- `/api/validate-scenario` - Line 7389
- `/api/results/risk-dashboard` - Line 7998
- `/api/whatif/combinations` - Line 8365
- `/api/montecarlo/prepare` - Line 8437
- `/api/calculate` - Line 8648 (Complex - async calculations)
- `/api/runs/save` - Line 8918
- `/api/runs/restore` - Line 9089
- `/api/staging/cleanup` - Line 9469

#### DELETE Routes (7 remaining)
- `/api/statement-templates/:code` - Line 1635
- `/api/staged-files/:fileId` - Line 1764
- `/api/management-actions/:actionCode` - Line 5607
- `/api/action-entities` - Line 5772
- `/api/scenario-actions/:id` - Line 5838
- `/api/runs/:runId` - Line 9316
- `/api/staging/:stagingId` - Line 9444

#### PUT Routes (Remaining count TBD)
- Check for any PUT routes with old patterns

## Refactoring Patterns Applied

### Pattern 1: Simple GET (Single Query)
```javascript
// BEFORE
const { dbPath } = req.query
if (!dbPath) return res.status(400).json({ error: 'Missing dbPath' })
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) return res.status(500).json({ error: err.message })
})
db.all('SELECT * FROM table', [], (err, rows) => {
  db.close()
  if (err) return res.status(500).json({ error: err.message })
  res.json(rows)
})

// AFTER
try {
  const rows = req.userDb.prepare('SELECT * FROM table').all()
  res.json(rows)
} catch (error) {
  res.status(500).json({ error: 'Failed to fetch: ' + error.message })
}
```

### Pattern 2: Nested Queries
```javascript
// BEFORE
db.all('SELECT * FROM table1', [], (err, rows1) => {
  db.all('SELECT * FROM table2', [], (err, rows2) => {
    db.close()
    // process and respond
  })
})

// AFTER
try {
  const rows1 = req.userDb.prepare('SELECT * FROM table1').all()
  const rows2 = req.userDb.prepare('SELECT * FROM table2').all()
  // process and respond
} catch (error) {
  res.status(500).json({ error: error.message })
}
```

### Pattern 3: INSERT/UPDATE with lastID
```javascript
// BEFORE
db.run('INSERT INTO table VALUES (?)', [value], function(err) {
  if (err) {
    db.close()
    return res.status(500).json({ error: err.message })
  }
  const id = this.lastID
  db.close()
  res.json({ id })
})

// AFTER
try {
  const stmt = req.userDb.prepare('INSERT INTO table VALUES (?)')
  const result = stmt.run(value)
  res.json({ id: result.lastInsertRowid })
} catch (error) {
  res.status(500).json({ error: error.message })
}
```

### Pattern 4: db.serialize() with Multiple Operations
```javascript
// BEFORE
db.serialize(() => {
  db.run('DELETE FROM table1')
  db.run('INSERT INTO table1 VALUES (?)', [val1])
  db.run('INSERT INTO table2 VALUES (?)', [val2], (err) => {
    db.close()
    if (err) return res.status(500).json({ error: err.message })
    res.json({ success: true })
  })
})

// AFTER
try {
  req.userDb.prepare('DELETE FROM table1').run()
  req.userDb.prepare('INSERT INTO table1 VALUES (?)').run(val1)
  req.userDb.prepare('INSERT INTO table2 VALUES (?)').run(val2)
  res.json({ success: true })
} catch (error) {
  res.status(500).json({ error: error.message })
}
```

## Key Changes to Remember

1. **Remove dbPath extraction:**
   - Delete `const { dbPath } = req.query` or `req.body`
   - Delete validation: `if (!dbPath || !fs.existsSync(dbPath))`

2. **Use req.userDb instead of creating new connections:**
   - Replace `new sqlite3.Database(dbPath, ...)` with `req.userDb`

3. **Convert callbacks to synchronous:**
   - `db.all(sql, params, callback)` → `req.userDb.prepare(sql).all(...params)`
   - `db.get(sql, params, callback)` → `req.userDb.prepare(sql).get(...params)`
   - `db.run(sql, params, callback)` → `req.userDb.prepare(sql).run(...params)`

4. **Remove db.close():**
   - Middleware handles connection cleanup

5. **Use try-catch:**
   - Wrap all database operations in try-catch
   - Return error messages with context

6. **Handle lastID:**
   - Change `this.lastID` to `result.lastInsertRowid`

## Next Steps

### Immediate (Simple Routes)
1. Refactor remaining simple GET routes with single queries
2. Refactor simple POST/PUT/DELETE routes with single queries
3. Run syntax check after every 10-15 routes

### Medium Priority (Complex Write Operations)
1. Refactor routes with db.serialize() and multiple dependent queries
2. Refactor routes with batch INSERT operations
3. Refactor routes with complex transaction logic

### Lower Priority (File Upload Routes)
1. Refactor upload routes - these are more complex but follow similar patterns
2. Special attention to:
   - `/api/statements/load`
   - `/api/scenarios/load` and `/api/scenarios/load-batch`
   - `/api/locations/load`
   - `/api/damage-curves/load` and `/api/damage-curves/load-batch`
   - `/api/hazard-maps/load`
   - `/api/management-actions/import`

### Complex Routes Requiring Special Attention
1. `/api/calculate` - Line 8648 (async calculations, spawn child process)
2. `/api/ingest/statements` - Line 6407 (complex nested serialize)
3. `/api/ingest/scenarios` - Line 6586 (complex nested serialize)
4. `/api/results/risk-dashboard` - Line 7998 (complex async)

## Testing After Refactoring

After refactoring each batch of routes:

1. **Syntax Check:**
   ```bash
   node --check index.js
   ```

2. **Start Server:**
   ```bash
   npm start
   ```

3. **Test Routes:**
   - Login first to get session cookie
   - Test each refactored route
   - Verify data is returned correctly
   - Check for any errors in console

4. **Monitor for Issues:**
   - "database is locked" errors (shouldn't happen with better-sqlite3)
   - "prepare is not a function" (means still using old sqlite3)
   - Missing req.userDb (middleware not applied)

## Progress Tracking

To track progress, run:
```bash
grep -c "new sqlite3\.Database(dbPath" index.js
```

Target: 0 (currently: 110)

## Estimated Time to Complete

- Simple GET routes (48): ~2-3 hours
- Simple POST/PUT/DELETE routes (40): ~3-4 hours
- Complex routes with serialize (15): ~2-3 hours
- File upload routes (7): ~1-2 hours

**Total estimated: 8-12 hours of focused refactoring work**

## Automation Opportunities

Consider creating a script to automate simple patterns:
- Single query GET routes
- Simple POST routes with single INSERT
- DELETE routes with single query

The helper script at `refactor_helper.js` can identify routes - extend it to generate refactorings.
