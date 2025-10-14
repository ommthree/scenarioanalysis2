import express from 'express'
import cors from 'cors'
import multer from 'multer'
import sqlite3 from 'sqlite3'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'

const app = express()
const upload = multer({ dest: '/tmp/uploads/' })

app.use(cors())
app.use(express.json())

/**
 * Load CSV statements into staging table
 * POST /api/statements/load
 * Body: statementType, dbPath
 * File: CSV file
 */
app.post('/api/statements/load', upload.single('file'), async (req, res) => {
  console.log('Received upload request:', {
    statementType: req.body.statementType,
    dbPath: req.body.dbPath,
    hasFile: !!req.file
  })

  try {
    const { statementType, dbPath } = req.body
    const file = req.file

    if (!file || !statementType || !dbPath) {
      console.log('Missing fields - file:', !!file, 'statementType:', statementType, 'dbPath:', dbPath)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Read and parse CSV
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Connect to existing database (READWRITE only, don't create)
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        // Clean up uploaded file
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Create staging table name
    const stagingTableName = `staging_statement_${statementType}`

    // Get columns from first record
    const columns = Object.keys(records[0])
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ')

    // Execute database operations
    db.serialize(() => {
      // Drop existing staging table
      db.run(`DROP TABLE IF EXISTS ${stagingTableName}`)

      // Create new staging table
      db.run(`CREATE TABLE ${stagingTableName} (
        _rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columnDefs},
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_mapped INTEGER DEFAULT 0
      )`, (err) => {
        if (err) {
          console.error('Create table error:', err)
          db.close()
          return res.status(500).json({ error: 'Failed to create staging table' })
        }

        // Insert records
        const placeholders = columns.map(() => '?').join(', ')
        const columnNames = columns.map(c => `"${c}"`).join(', ')
        const stmt = db.prepare(`INSERT INTO ${stagingTableName} (${columnNames}) VALUES (${placeholders})`)

        let inserted = 0
        for (const record of records) {
          const values = columns.map(col => record[col])
          stmt.run(values, (err) => {
            if (err) {
              console.error('Insert error:', err)
            } else {
              inserted++
            }
          })
        }

        stmt.finalize((err) => {
          db.close()

          // Clean up uploaded file
          fs.unlinkSync(file.path)

          if (err) {
            console.error('Finalize error:', err)
            return res.status(500).json({ error: 'Failed to insert data' })
          }

          res.json({
            success: true,
            message: `Successfully loaded ${records.length} rows into staging area. Ready for mapping.`,
            rowCount: records.length,
            tableName: stagingTableName
          })
        })
      })
    })

  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Load CSV scenarios into staging table
 * POST /api/scenarios/load
 * Body: scenarioName, dbPath
 * File: CSV file
 */
app.post('/api/scenarios/load', upload.single('file'), async (req, res) => {
  console.log('Received scenario upload request:', {
    scenarioName: req.body.scenarioName,
    dbPath: req.body.dbPath,
    hasFile: !!req.file
  })

  try {
    const { scenarioName, dbPath } = req.body
    const file = req.file

    if (!file || !scenarioName || !dbPath) {
      console.log('Missing fields - file:', !!file, 'scenarioName:', scenarioName, 'dbPath:', dbPath)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Read and parse CSV
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Connect to existing database
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Create staging table name with scenario name sanitized
    const sanitizedScenarioName = scenarioName.replace(/[^a-zA-Z0-9_]/g, '_')
    const stagingTableName = `staging_scenario_${sanitizedScenarioName}`

    // Get columns from first record
    const columns = Object.keys(records[0])
    const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ')

    // Execute database operations
    db.serialize(() => {
      // Drop existing staging table for this scenario
      db.run(`DROP TABLE IF EXISTS ${stagingTableName}`)

      // Create new staging table
      db.run(`CREATE TABLE ${stagingTableName} (
        _rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        ${columnDefs},
        imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_mapped INTEGER DEFAULT 0
      )`, (err) => {
        if (err) {
          console.error('Create table error:', err)
          db.close()
          return res.status(500).json({ error: 'Failed to create staging table' })
        }

        // Insert records
        const placeholders = columns.map(() => '?').join(', ')
        const columnNames = columns.map(c => `"${c}"`).join(', ')
        const stmt = db.prepare(`INSERT INTO ${stagingTableName} (${columnNames}) VALUES (${placeholders})`)

        let inserted = 0
        for (const record of records) {
          const values = columns.map(col => record[col])
          stmt.run(values, (err) => {
            if (err) {
              console.error('Insert error:', err)
            } else {
              inserted++
            }
          })
        }

        stmt.finalize((err) => {
          db.close()
          fs.unlinkSync(file.path)

          if (err) {
            console.error('Finalize error:', err)
            return res.status(500).json({ error: 'Failed to insert data' })
          }

          res.json({
            success: true,
            message: `Successfully loaded ${records.length} rows from ${scenarioName} into staging area.`,
            rowCount: records.length,
            tableName: stagingTableName
          })
        })
      })
    })

  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Load multiple CSV scenarios into numbered staging tables (batch mode)
 * POST /api/scenarios/load-batch
 * Body: dbPath, scenarioFiles (JSON array of {name, index})
 * Files: Multiple CSV files
 */
app.post('/api/scenarios/load-batch', upload.array('files'), async (req, res) => {
  console.log('Received batch scenario upload request:', {
    dbPath: req.body.dbPath,
    fileCount: req.files?.length || 0
  })

  try {
    const { dbPath } = req.body
    const files = req.files

    if (!files || files.length === 0 || !dbPath) {
      console.log('Missing fields - files:', files?.length || 0, 'dbPath:', dbPath)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      files.forEach(f => fs.unlinkSync(f.path))
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Connect to existing database
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        files.forEach(f => fs.unlinkSync(f.path))
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.serialize(() => {
      // First, drop all existing staging_scenario_* tables
      db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'staging_scenario_%'`, (err, tables) => {
        if (err) {
          console.error('Error listing tables:', err)
          db.close()
          files.forEach(f => fs.unlinkSync(f.path))
          return res.status(500).json({ error: 'Failed to list staging tables' })
        }

        // Drop each staging table synchronously
        const dropPromises = tables.map(table => {
          return new Promise((resolve, reject) => {
            db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        })

        // Wait for all drops to complete before processing files
        Promise.all(dropPromises).then(() => {
          // Now process each file
          let processedCount = 0
          let hasError = false

        files.forEach((file, idx) => {
          const scenarioNumber = idx + 1
          const stagingTableName = `staging_scenario_${scenarioNumber}`

          try {
            // Read and parse CSV
            const fileContent = fs.readFileSync(file.path, 'utf-8')
            const records = parse(fileContent, {
              columns: true,
              skip_empty_lines: true,
              trim: true
            })

            if (records.length === 0) {
              hasError = true
              processedCount++
              if (processedCount === files.length) {
                db.close()
                files.forEach(f => fs.unlinkSync(f.path))
                return res.status(400).json({ error: 'One or more CSV files are empty' })
              }
              return
            }

            // Get columns from first record
            const columns = Object.keys(records[0])
            const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ')

            // Create staging table
            db.run(`CREATE TABLE ${stagingTableName} (
              _rowid INTEGER PRIMARY KEY AUTOINCREMENT,
              ${columnDefs},
              imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              is_mapped INTEGER DEFAULT 0
            )`, (err) => {
              if (err) {
                console.error('Create table error:', err)
                hasError = true
                processedCount++
                if (processedCount === files.length) {
                  db.close()
                  files.forEach(f => fs.unlinkSync(f.path))
                  return res.status(500).json({ error: 'Failed to create staging tables' })
                }
                return
              }

              // Insert records
              const placeholders = columns.map(() => '?').join(', ')
              const columnNames = columns.map(c => `"${c}"`).join(', ')
              const stmt = db.prepare(`INSERT INTO ${stagingTableName} (${columnNames}) VALUES (${placeholders})`)

              for (const record of records) {
                const values = columns.map(col => record[col])
                stmt.run(values, (err) => {
                  if (err) {
                    console.error('Insert error:', err)
                    hasError = true
                  }
                })
              }

              stmt.finalize((err) => {
                if (err) {
                  console.error('Finalize error:', err)
                  hasError = true
                }

                processedCount++

                // If all files processed, send response
                if (processedCount === files.length) {
                  db.close()
                  files.forEach(f => fs.unlinkSync(f.path))

                  if (hasError) {
                    return res.status(500).json({ error: 'Some scenarios failed to load' })
                  }

                  res.json({
                    success: true,
                    message: `Successfully loaded ${files.length} scenario file(s) into staging area.`,
                    fileCount: files.length
                  })
                }
              })
            })
          } catch (error) {
            console.error('File processing error:', error)
            hasError = true
            processedCount++

            if (processedCount === files.length) {
              db.close()
              files.forEach(f => fs.unlinkSync(f.path))
              return res.status(500).json({ error: 'Failed to process files' })
            }
          }
        })
        }).catch(err => {
          console.error('Error dropping tables:', err)
          db.close()
          files.forEach(f => fs.unlinkSync(f.path))
          return res.status(500).json({ error: 'Failed to drop staging tables' })
        })
      })
    })

  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * List database files in a directory
 */
app.post('/api/database/browse', express.json(), (req, res) => {
  try {
    const { directory } = req.body
    const dirPath = directory || '/Users/Owen/ScenarioAnalysis2/data/database'

    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' })
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.endsWith('.db') || file.endsWith('.sqlite') || file.endsWith('.sqlite3'))
      .map(file => path.join(dirPath, file))

    res.json({ files })
  } catch (error) {
    console.error('Browse error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Dashboard API Server' })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Dashboard API server running on http://localhost:${PORT}`)
})
