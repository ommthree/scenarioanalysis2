# Quick Start: Refactoring Index.js Routes

## Step 1: Add Required Code to index.js (5 minutes)

### 1a. Add Import at top (after line 18)

```javascript
import Database from 'better-sqlite3'
```

### 1b. Add Session Imports (after line 28)

```javascript
import session from 'express-session'
import ConnectSqlite3 from 'connect-sqlite3'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import { getUserDatabase } from './middleware/database.js'
```

### 1c. Update CORS (replace line 33)

```javascript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}))
```

### 1d. Add Session Middleware (after line 35, before first route)

```javascript
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
  proxy: process.env.NODE_ENV === 'production'
}))

// Mount auth routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
```

---

## Step 2: Refactor Your First Route (15-30 minutes)

### Find a Simple Route

Look for a GET route with a simple query pattern. Example: `/api/entities`

### Apply the Pattern

**BEFORE:**
```javascript
app.get('/api/entities', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath parameter' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Database connection failed' })
    }
  })

  db.all('SELECT * FROM entity', [], (err, entities) => {
    db.close()
    if (err) {
      return res.status(500).json({ error: err.message })
    }
    res.json({ entities })
  })
})
```

**AFTER:**
```javascript
app.get('/api/entities', getUserDatabase, (req, res) => {
  try {
    const entities = req.userDb.prepare('SELECT * FROM entity').all()
    res.json({ entities })
  } catch (error) {
    console.error('Error fetching entities:', error)
    res.status(500).json({ error: error.message })
  }
})
```

### Key Changes:
1. Add `getUserDatabase` middleware after route path
2. Remove dbPath extraction and validation
3. Replace `db` with `req.userDb`
4. Convert callback to synchronous
5. Use try-catch for errors
6. Remove db.close()

---

## Step 3: Test Your Changes (10 minutes)

### 3a. Syntax Check
```bash
node --check index.js
```

### 3b. Start Server
```bash
npm start
```

### 3c. Test Authentication
```bash
# Login first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}' \
  -c cookies.txt

# Test your refactored route
curl -X GET http://localhost:3000/api/entities \
  -b cookies.txt
```

### Expected Results:
- ✅ Syntax check passes
- ✅ Server starts without errors
- ✅ Unauthenticated requests return 401
- ✅ Authenticated requests return data
- ✅ No "database is locked" errors
- ✅ No memory leaks (check with multiple requests)

---

## Step 4: Repeat for Next Route

Choose routes in this order:

### Priority 1: Simple Read Routes (easiest)
- `/api/drivers`
- `/api/entity-levels`
- `/api/perils`
- `/api/scenarios/list`
- All other simple `db.get()` or `db.all()` routes

### Priority 2: Simple Write Routes
- `/api/validation-rules` (POST)
- `/api/templates/save`
- Routes with single `db.run()` calls

### Priority 3: Complex Routes
- Upload routes with file processing
- Routes with multiple dependent queries
- Routes with `db.serialize()`
- Batch operations

---

## Quick Reference: Common Patterns

### Pattern 1: SELECT One Row
```javascript
// BEFORE
db.get('SELECT * FROM table WHERE id = ?', [id], (err, row) => {
  db.close()
  if (err) return res.status(500).json({error: err.message})
  res.json({data: row})
})

// AFTER
try {
  const row = req.userDb.prepare('SELECT * FROM table WHERE id = ?').get(id)
  res.json({data: row})
} catch (error) {
  res.status(500).json({error: error.message})
}
```

### Pattern 2: SELECT Multiple Rows
```javascript
// BEFORE
db.all('SELECT * FROM table', [], (err, rows) => {
  db.close()
  if (err) return res.status(500).json({error: err.message})
  res.json({data: rows})
})

// AFTER
try {
  const rows = req.userDb.prepare('SELECT * FROM table').all()
  res.json({data: rows})
} catch (error) {
  res.status(500).json({error: error.message})
}
```

### Pattern 3: INSERT with Last ID
```javascript
// BEFORE
db.run('INSERT INTO table VALUES (?)', [value], function(err) {
  if (err) {
    db.close()
    return res.status(500).json({error: err.message})
  }
  const id = this.lastID
  db.close()
  res.json({success: true, id})
})

// AFTER
try {
  const stmt = req.userDb.prepare('INSERT INTO table VALUES (?)')
  const result = stmt.run(value)
  res.json({success: true, id: result.lastInsertRowid})
} catch (error) {
  res.status(500).json({error: error.message})
}
```

### Pattern 4: Batch INSERT
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
  if (err) return res.status(500).json({error: err.message})
  res.json({success: true})
})

// AFTER
try {
  const stmt = req.userDb.prepare('INSERT INTO table VALUES (?, ?)')
  for (const record of records) {
    stmt.run(record.a, record.b)
  }
  res.json({success: true})
} catch (error) {
  res.status(500).json({error: error.message})
}
```

### Pattern 5: Multiple Dependent Queries
```javascript
// BEFORE
db.serialize(() => {
  db.run('INSERT INTO table1 VALUES (?)', [value], function(err) {
    if (err) {
      db.close()
      return res.status(500).json({error: err.message})
    }
    const id = this.lastID
    db.run('UPDATE table2 SET fk = ? WHERE id = ?', [id, otherId], (err) => {
      db.close()
      if (err) return res.status(500).json({error: err.message})
      res.json({success: true})
    })
  })
})

// AFTER
try {
  const stmt1 = req.userDb.prepare('INSERT INTO table1 VALUES (?)')
  const result = stmt1.run(value)
  const id = result.lastInsertRowid

  const stmt2 = req.userDb.prepare('UPDATE table2 SET fk = ? WHERE id = ?')
  stmt2.run(id, otherId)

  res.json({success: true})
} catch (error) {
  res.status(500).json({error: error.message})
}
```

---

## Troubleshooting

### Error: "Not authenticated"
- Ensure `getUserDatabase` middleware is added to route
- Check that session middleware is configured
- Verify user is logged in (check cookies)

### Error: "Database is locked"
- Usually means a connection wasn't closed
- With middleware, this shouldn't happen
- Check that you removed all `db.close()` calls

### Error: "prepare is not a function"
- You're still using sqlite3 instead of req.userDb
- Search for `new sqlite3.Database` and remove it

### Error: "Cannot read property 'all' of undefined"
- `req.userDb` is undefined
- Middleware not applied or user not authenticated

### Server won't start
- Run `node --check index.js` to find syntax errors
- Check that all imports are correct
- Verify session store directory exists

---

## Progress Tracking

Create a checklist as you refactor:

```
Data Upload Routes:
[ ] /api/statements/load
[ ] /api/scenarios/load
[ ] /api/scenarios/load-batch
[ ] /api/locations/load
[ ] /api/damage-curves/load
[ ] /api/damage-curves/load-batch
[ ] /api/hazard-maps/load
[ ] /api/correlation/load
[ ] /api/conversion/load
[ ] /api/management-actions/import

Query Routes:
[ ] /api/entities
[ ] /api/drivers
[ ] /api/entity-levels
[ ] /api/scenarios/list
[ ] /api/scenarios/:scenarioId/drivers
[ ] /api/scenarios/:scenarioId/results
[ ] /api/results/scenarios
[ ] /api/results/entities
... (45+ more)

Configuration Routes:
[ ] /api/templates/save
[ ] /api/templates/list
[ ] /api/validation-rules (GET)
[ ] /api/validation-rules (POST)
[ ] /api/validation-rules/:ruleId (PUT)
... (20+ more)
```

---

## Getting Help

If you get stuck:

1. Check `REFACTORING_GUIDE.md` for detailed patterns
2. Check `REFACTORING_SUMMARY.md` for analysis
3. Look at sqlite3 vs better-sqlite3 API differences
4. Test with simple routes first before complex ones
5. Commit frequently so you can rollback if needed

---

## Success!

After refactoring all routes:

- ✅ Security improved (no client-controlled database paths)
- ✅ Code cleaner (no callback hell)
- ✅ Performance better (synchronous operations)
- ✅ Bugs reduced (no forgotten db.close())
- ✅ Multi-tenancy works (automatic user isolation)

Good luck! 🚀
