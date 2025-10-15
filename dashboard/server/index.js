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
 * Save template to database
 * POST /api/templates/save
 * Body: template (JSON), dbPath
 */
app.post('/api/templates/save', express.json(), (req, res) => {
  console.log('Received template save request')

  try {
    const { template, dbPath } = req.body

    if (!template || !dbPath) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!template.template_code) {
      return res.status(400).json({ error: 'Template code is required' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Connect to database
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Insert or replace template
    const templateJson = JSON.stringify(template)

    // Validate required fields
    if (!template.template_code) {
      db.close()
      return res.status(400).json({ error: 'Template code is required' })
    }

    if (!template.industry) {
      db.close()
      return res.status(400).json({ error: 'Industry is required' })
    }

    console.log('Saving template:', {
      code: template.template_code,
      statement_type: template.statement_type,
      industry: template.industry,
      version: template.version
    })

    db.run(
      `INSERT OR REPLACE INTO statement_template
       (code, statement_type, industry, version, json_structure, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      [
        template.template_code,
        template.statement_type || 'unified',
        template.industry || 'GENERAL',
        template.version || '1.0.0',
        templateJson
      ],
      function(err) {
        db.close()

        if (err) {
          console.error('Insert error:', err)
          console.error('Template data:', template)
          return res.status(500).json({
            error: 'Failed to save template: ' + err.message,
            details: err.toString()
          })
        }

        res.json({
          success: true,
          message: `Template '${template.template_code}' saved successfully`,
          template_code: template.template_code
        })
      }
    )

  } catch (error) {
    console.error('Save error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * List available templates
 * POST /api/templates/list
 * Body: dbPath
 */
app.post('/api/templates/list', express.json(), (req, res) => {
  try {
    const { dbPath } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all('SELECT code, statement_type, json_structure FROM statement_template WHERE is_active = 1', [], (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to fetch templates: ' + err.message })
      }

      const templates = rows.map(row => {
        try {
          const template = JSON.parse(row.json_structure)
          return {
            template_code: row.code,
            template_name: template.template_name || row.code,
            statement_type: row.statement_type,
            line_items: template.line_items || []
          }
        } catch (parseError) {
          console.error(`Failed to parse template ${row.code}:`, parseError)
          return {
            template_code: row.code,
            template_name: row.code,
            statement_type: row.statement_type,
            line_items: []
          }
        }
      })

      res.json({ success: true, templates })
    })
  } catch (error) {
    console.error('List templates error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get statement types from staging tables
 * POST /api/statements/types
 * Body: dbPath
 */
app.post('/api/statements/types', express.json(), (req, res) => {
  try {
    const { dbPath } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'staging_statement_%'`,
      [],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to fetch statement types: ' + err.message })
        }

        const types = rows.map(row => row.name.replace('staging_statement_', ''))
        res.json({ success: true, types })
      }
    )
  } catch (error) {
    console.error('Get statement types error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get staging table columns and preview data
 * POST /api/statements/staging
 * Body: dbPath, statementType
 */
app.post('/api/statements/staging', express.json(), (req, res) => {
  try {
    const { dbPath, statementType } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!statementType) {
      return res.status(400).json({ error: 'Statement type is required' })
    }

    // Map statement types to staging table names
    const tableNameMap = {
      'pl': 'staging_statement_pnl',
      'pnl': 'staging_statement_pnl',
      'bs': 'staging_statement_balance_sheet',
      'balance_sheet': 'staging_statement_balance_sheet',
      'cf': 'staging_statement_cashflow',
      'cashflow': 'staging_statement_cashflow',
      'carbon': 'staging_statement_carbon'
    }

    const tableName = tableNameMap[statementType.toLowerCase()] || `staging_statement_${statementType}`

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get table info to find columns
    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to get table info: ' + err.message })
      }

      // Filter out internal columns
      const csvColumns = columns
        .map(col => col.name)
        .filter(name => !['_rowid', 'imported_at', 'is_mapped'].includes(name))

      // Get all rows - each row represents a line item
      db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to get data: ' + err.message })
        }

        // Return rows and columns (columns will be period columns like Period_0, Period_1, etc.)
        res.json({ success: true, rows: rows || [], columns: csvColumns })
      })
    })
  } catch (error) {
    console.error('Get staging data error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save column mapping
 * POST /api/statements/save-mapping
 * Body: dbPath, templateCode, statementType, mappings
 */
app.post('/api/statements/save-mapping', express.json(), (req, res) => {
  try {
    const { dbPath, templateCode, statementType, mappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!templateCode || !statementType || !mappings) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const mappingJson = JSON.stringify(mappings)

    db.run(
      `INSERT OR REPLACE INTO statement_mapping
       (template_code, statement_type, column_mapping, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [templateCode, statementType, mappingJson],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
        }

        res.json({
          success: true,
          message: `Mapping saved for ${templateCode} - ${statementType}`
        })
      }
    )
  } catch (error) {
    console.error('Save mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * List all entities
 * POST /api/entities/list
 * Body: dbPath
 */
app.post('/api/entities/list', express.json(), (req, res) => {
  try {
    const { dbPath } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all('SELECT * FROM entity WHERE is_active = 1 ORDER BY entity_id', [], (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to fetch entities: ' + err.message })
      }

      res.json({ success: true, entities: rows })
    })
  } catch (error) {
    console.error('List entities error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save entity (create or update)
 * POST /api/entities/save
 * Body: dbPath, entity
 */
app.post('/api/entities/save', express.json(), (req, res) => {
  try {
    const { dbPath, entity } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!entity || !entity.code || !entity.name) {
      return res.status(400).json({ error: 'Missing required entity fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const metadataJson = JSON.stringify(entity.json_metadata || {})

    if (entity.entity_id) {
      // Update existing entity
      db.run(
        `UPDATE entity
         SET code = ?, name = ?, parent_entity_id = ?, granularity_level = ?,
             base_currency = ?, json_metadata = ?
         WHERE entity_id = ?`,
        [entity.code, entity.name, entity.parent_entity_id, entity.granularity_level,
         entity.base_currency, metadataJson, entity.entity_id],
        function(err) {
          db.close()

          if (err) {
            return res.status(500).json({ error: 'Failed to update entity: ' + err.message })
          }

          res.json({ success: true, entity_id: entity.entity_id })
        }
      )
    } else {
      // Insert new entity
      db.run(
        `INSERT INTO entity (code, name, parent_entity_id, granularity_level, base_currency, json_metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entity.code, entity.name, entity.parent_entity_id, entity.granularity_level,
         entity.base_currency, metadataJson],
        function(err) {
          db.close()

          if (err) {
            return res.status(500).json({ error: 'Failed to create entity: ' + err.message })
          }

          res.json({ success: true, entity_id: this.lastID })
        }
      )
    }
  } catch (error) {
    console.error('Save entity error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Delete entity
 * POST /api/entities/delete
 * Body: dbPath, entityId
 */
app.post('/api/entities/delete', express.json(), (req, res) => {
  try {
    const { dbPath, entityId } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!entityId) {
      return res.status(400).json({ error: 'Entity ID is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Soft delete by setting is_active = 0
    db.run(
      'UPDATE entity SET is_active = 0 WHERE entity_id = ?',
      [entityId],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to delete entity: ' + err.message })
        }

        res.json({ success: true })
      }
    )
  } catch (error) {
    console.error('Delete entity error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get all statement templates
 * GET /api/statement-templates
 */
app.get('/api/statement-templates', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  db.all('SELECT code, statement_type, industry, version, is_active FROM statement_template WHERE is_active = 1 ORDER BY code', [], (err, rows) => {
    db.close()

    if (err) {
      return res.status(500).json({ error: err.message })
    }

    res.json(rows || [])
  })
})

/**
 * Get statement template by code with line items
 * GET /api/statement-templates/:code
 */
app.get('/api/statement-templates/:code', (req, res) => {
  const { code } = req.params
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  db.get('SELECT * FROM statement_template WHERE code = ?', [code], (err, template) => {
    db.close()

    if (err) {
      return res.status(500).json({ error: err.message })
    }

    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }

    // Parse JSON structure and return
    try {
      const jsonStructure = JSON.parse(template.json_structure || '{"line_items":[]}')
      res.json({
        code: template.code,
        statement_type: template.statement_type,
        industry: template.industry,
        version: template.version,
        lineItems: jsonStructure.line_items || []
      })
    } catch (e) {
      return res.status(500).json({ error: 'Invalid JSON structure in template' })
    }
  })
})

/**
 * Save statement template with line items
 * POST /api/statement-templates
 */
app.post('/api/statement-templates', (req, res) => {
  const { dbPath, template, lineItems } = req.body

  if (!dbPath || !template) {
    return res.status(400).json({ error: 'Database path and template required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  // Build JSON structure
  const jsonStructure = JSON.stringify({
    line_items: lineItems || []
  })

  // Insert or replace template with JSON structure
  db.run(
    `INSERT OR REPLACE INTO statement_template (code, statement_type, industry, version, json_structure, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [template.code, template.statement_type || 'unified', template.industry || 'GENERAL', template.version || '1.0', jsonStructure],
    function(err) {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to save template: ' + err.message })
      }

      res.json({ success: true })
    }
  )
})

/**
 * Delete statement template
 * DELETE /api/statement-templates/:code
 */
app.delete('/api/statement-templates/:code', (req, res) => {
  const { code } = req.params
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  // Soft delete by setting is_active = 0
  db.run('UPDATE statement_template SET is_active = 0 WHERE code = ?', [code], function(err) {
    db.close()

    if (err) {
      return res.status(500).json({ error: 'Failed to delete template: ' + err.message })
    }

    res.json({ success: true, deleted: this.changes })
  })
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
