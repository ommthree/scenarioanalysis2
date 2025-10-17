import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Load environment variables from api-keys.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: '../../env/api-keys.env' })

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

    // Parse all files first and collect their metadata
    const filesData = []
    for (let i = 0; i < files.length; i++) {
      try {
        const fileContent = fs.readFileSync(files[i].path, 'utf-8')
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        })

        if (records.length === 0) {
          files.forEach(f => fs.unlinkSync(f.path))
          return res.status(400).json({ error: `File ${files[i].originalname} is empty` })
        }

        filesData.push({
          fileName: files[i].originalname,
          filePath: files[i].path,
          records,
          columns: Object.keys(records[0])
        })
      } catch (error) {
        files.forEach(f => fs.unlinkSync(f.path))
        return res.status(400).json({ error: `Failed to parse ${files[i].originalname}: ${error.message}` })
      }
    }

    db.serialize(() => {
      // Find the next available table number
      db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'staging_scenario_%'`, [], (err, tables) => {
        if (err) {
          console.error('Error listing tables:', err)
          db.close()
          files.forEach(f => fs.unlinkSync(f.path))
          return res.status(500).json({ error: 'Failed to list staging tables' })
        }

        // Find highest existing table number
        let maxTableNum = 0
        for (const table of tables) {
          const match = table.name.match(/^staging_scenario_(\d+)$/)
          if (match) {
            const num = parseInt(match[1])
            if (num > maxTableNum) maxTableNum = num
          }
        }

        // Process each file
        let fileIdx = 0
        const insertNextFile = () => {
          if (fileIdx >= filesData.length) {
            // All done
            db.close()
            files.forEach(f => fs.unlinkSync(f.path))
            return res.json({
              success: true,
              message: `Successfully loaded ${files.length} scenario file(s) into staging area.`,
              fileCount: files.length
            })
          }

          const fileData = filesData[fileIdx]
          const tableNum = maxTableNum + fileIdx + 1
          const stagingTableName = `staging_scenario_${tableNum}`
          const columnDefs = fileData.columns.map(col => `"${col}" TEXT`).join(', ')

          // Create table for this file
          db.run(`CREATE TABLE ${stagingTableName} (
            _rowid INTEGER PRIMARY KEY AUTOINCREMENT,
            ${columnDefs},
            imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_mapped INTEGER DEFAULT 0
          )`, (err) => {
            if (err) {
              console.error('Create table error:', err)
              db.close()
              files.forEach(f => fs.unlinkSync(f.path))
              return res.status(500).json({ error: 'Failed to create staging table' })
            }

            // Create staged_file entry with table number as file_id
            db.run(
              `INSERT INTO staged_file (file_id, file_name, file_type, row_count) VALUES (?, ?, ?, ?)`,
              [tableNum, fileData.fileName, 'scenario', fileData.records.length],
              function(err) {
                if (err) {
                  console.error('Failed to create staged_file entry:', err)
                  db.close()
                  files.forEach(f => fs.unlinkSync(f.path))
                  return res.status(500).json({ error: 'Failed to record staged file' })
                }

                // Insert records
                const placeholders = fileData.columns.map(() => '?').join(', ')
                const columnNames = fileData.columns.map(c => `"${c}"`).join(', ')
                const stmt = db.prepare(`INSERT INTO ${stagingTableName} (${columnNames}) VALUES (${placeholders})`)

                for (const record of fileData.records) {
                  const values = fileData.columns.map(col => record[col])
                  stmt.run(values, (err) => {
                    if (err) {
                      console.error('Insert error:', err)
                    }
                  })
                }

                stmt.finalize((err) => {
                  if (err) {
                    console.error('Finalize error:', err)
                    db.close()
                    files.forEach(f => fs.unlinkSync(f.path))
                    return res.status(500).json({ error: 'Failed to insert data' })
                  }

                  fileIdx++
                  insertNextFile()
                })
              }
            )
          })
        }

        insertNextFile()
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
 * Save hierarchical statement mapping
 * POST /api/statements/save-hierarchical-mapping
 * Body: dbPath, templateCode, statementType, companyId, hierarchicalMappings, csvFileName
 */
app.post('/api/statements/save-hierarchical-mapping', express.json(), (req, res) => {
  try {
    const { dbPath, templateCode, statementType, companyId, hierarchicalMappings, csvFileName, columnConfig } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!templateCode || !statementType || !companyId || !hierarchicalMappings) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const mappingData = {
      hierarchical_mappings: hierarchicalMappings,
      column_config: columnConfig || null
    }
    const mappingJson = JSON.stringify(mappingData)

    db.run(
      `INSERT OR REPLACE INTO statement_mapping
       (template_code, statement_type, company_id, column_mapping, csv_file_name, created_at, last_updated)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [templateCode, statementType, companyId, mappingJson, csvFileName || null],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to save hierarchical mapping: ' + err.message })
        }

        res.json({
          success: true,
          message: `Hierarchical mapping saved for ${templateCode} - ${statementType}`
        })
      }
    )
  } catch (error) {
    console.error('Save hierarchical mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get saved hierarchical mapping
 * GET /api/statements/get-hierarchical-mapping
 * Query params: dbPath, templateCode, statementType
 */
app.get('/api/statements/get-hierarchical-mapping', (req, res) => {
  try {
    const { dbPath, templateCode, statementType } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!templateCode || !statementType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.get(
      `SELECT company_id, column_mapping, csv_file_name, last_updated
       FROM statement_mapping
       WHERE template_code = ? AND statement_type = ?`,
      [templateCode, statementType],
      (err, row) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve mapping: ' + err.message })
        }

        if (!row) {
          return res.json({ success: true, mapping: null })
        }

        try {
          const mappingData = JSON.parse(row.column_mapping)
          res.json({
            success: true,
            mapping: {
              companyId: row.company_id,
              hierarchicalMappings: mappingData.hierarchical_mappings,
              columnConfig: mappingData.column_config || null,
              csvFileName: row.csv_file_name,
              lastUpdated: row.last_updated
            }
          })
        } catch (parseErr) {
          return res.status(500).json({ error: 'Failed to parse mapping data' })
        }
      }
    )
  } catch (error) {
    console.error('Get hierarchical mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get all saved mappings for a statement type
 * GET /api/statements/get-all-mappings
 * Query: dbPath, statementType
 */
app.get('/api/statements/get-all-mappings', (req, res) => {
  try {
    const { dbPath, statementType } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!statementType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT template_code, statement_type, company_id, column_mapping, csv_file_name, last_updated
       FROM statement_mapping
       WHERE statement_type = ?
       ORDER BY last_updated DESC`,
      [statementType],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve mappings: ' + err.message })
        }

        if (!rows || rows.length === 0) {
          return res.json({ success: true, mappings: [] })
        }

        try {
          const mappings = rows.map(row => {
            const mappingData = JSON.parse(row.column_mapping)
            return {
              templateCode: row.template_code,
              statementType: row.statement_type,
              companyId: row.company_id,
              hierarchicalMappings: mappingData.hierarchical_mappings,
              columnConfig: mappingData.column_config || null,
              csvFileName: row.csv_file_name,
              lastUpdated: row.last_updated
            }
          })
          res.json({ success: true, mappings })
        } catch (parseErr) {
          return res.status(500).json({ error: 'Failed to parse mapping data' })
        }
      }
    )
  } catch (error) {
    console.error('Get all mappings error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save mapped statement data to result tables
 * POST /api/statements/save-mapped-data
 * Body: { dbPath, templateCode, statementType, companyId, hierarchicalMappings, scenarioId, periodId }
 */
app.post('/api/statements/save-mapped-data', express.json(), (req, res) => {
  try {
    const { dbPath, templateCode, statementType, companyId, hierarchicalMappings, scenarioId, periodId } = req.body

    console.log('=== save-mapped-data called ===')
    console.log('statementType:', statementType)
    console.log('companyId:', companyId)
    console.log('hierarchicalMappings count:', hierarchicalMappings?.length)
    console.log('scenarioId:', scenarioId, 'periodId:', periodId)

    if (!dbPath || !fs.existsSync(dbPath)) {
      console.log('ERROR: Invalid database path')
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!templateCode || !statementType || !companyId || !hierarchicalMappings || !scenarioId || !periodId) {
      console.log('ERROR: Missing required fields:', { templateCode, statementType, companyId, hierarchicalMappings: !!hierarchicalMappings, scenarioId, periodId })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // First, look up the template_id from statement_template
    console.log('Looking up template_id for:', templateCode)
    db.get(
      `SELECT template_id FROM statement_template WHERE code = ?`,
      [templateCode],
      (err, templateRow) => {
        if (err) {
          console.log('ERROR looking up template:', err.message)
          db.close()
          return res.status(500).json({ error: 'Failed to look up template: ' + err.message })
        }

        if (!templateRow) {
          console.log('ERROR: Template not found:', templateCode)
          db.close()
          return res.status(400).json({ error: 'Template not found: ' + templateCode })
        }

        const statementId = templateRow.template_id
        console.log('Found statement_id:', statementId)

        // Determine staging table and result table based on statement type
        const tableMap = {
          'pnl': { staging: 'staging_statement_pnl', result: 'pl_results' },
          'balance_sheet': { staging: 'staging_statement_bs', result: 'bs_result' },
          'carbon': { staging: 'staging_statement_carbon', result: 'carbon_result' },
          'cashflow': { staging: 'staging_statement_cf', result: 'cf_result' }
        }

        const tables = tableMap[statementType]
        if (!tables) {
          db.close()
          return res.status(400).json({ error: 'Invalid statement type' })
        }

        // Now get all staging data
        console.log('Querying staging table:', tables.staging)
        db.all(`SELECT * FROM ${tables.staging}`, [], (err, stagingRows) => {
      if (err) {
        console.log('ERROR reading staging data:', err.message)
        db.close()
        return res.status(500).json({ error: 'Failed to read staging data: ' + err.message })
      }

      console.log('Staging rows found:', stagingRows?.length)

      if (!stagingRows || stagingRows.length === 0) {
        console.log('ERROR: No staging data found')
        db.close()
        return res.status(400).json({ error: 'No staging data found' })
      }

      // Process each hierarchical mapping
      const insertPromises = []
      console.log('Processing hierarchical mappings...')
      for (const mapping of hierarchicalMappings) {
        const { entity_path, line_item_code, csv_row_index } = mapping

        // Get the target entity (last in path)
        const targetEntityId = entity_path[entity_path.length - 1]

        // Get the CSV row data
        const csvRow = stagingRows[csv_row_index]
        if (!csvRow) {
          console.log('WARNING: csv_row_index', csv_row_index, 'not found in staging rows')
          continue
        }

        // Extract value from the "Initial Value" column
        // The staging tables have columns: _rowid, "Line Item", "Initial Value", imported_at, is_mapped
        let value = null
        if (csvRow['Initial Value'] !== undefined && csvRow['Initial Value'] !== null) {
          value = parseFloat(csvRow['Initial Value'])
        }

        if (value === null || isNaN(value)) {
          console.log('WARNING: Could not extract value from row', csv_row_index, 'Initial Value:', csvRow['Initial Value'])
          continue
        }

        console.log('Mapping:', line_item_code, '=', value, 'from row', csv_row_index)

        // Insert into appropriate result table
        let insertSql
        let insertParams

        if (statementType === 'pnl') {
          // P&L has specific schema with statement_id
          insertSql = `
            INSERT OR REPLACE INTO ${tables.result}
            (entity_id, scenario_id, period_id, statement_id, code, value, calculation_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `
          insertParams = [targetEntityId, scenarioId, periodId, statementId, line_item_code, value]
        } else if (statementType === 'carbon') {
          insertSql = `
            INSERT OR REPLACE INTO ${tables.result}
            (entity_id, scenario_id, period_id, template_code, line_item_code, value, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `
          insertParams = [targetEntityId, scenarioId, periodId, templateCode, line_item_code, value]
        } else {
          // For BS, CF - they use JSON structure, skip for now
          // TODO: Implement JSON-based storage for BS and CF
          continue
        }

        insertPromises.push(new Promise((resolve, reject) => {
          db.run(insertSql, insertParams, (err) => {
            if (err) reject(err)
            else resolve()
          })
        }))
      }

      // Execute all inserts
      console.log('Executing', insertPromises.length, 'insert operations...')
      Promise.all(insertPromises)
        .then(() => {
          console.log('SUCCESS: All inserts completed')
          db.close()
          res.json({
            success: true,
            message: `Saved ${insertPromises.length} mapped data records`,
            recordCount: insertPromises.length
          })
        })
        .catch((error) => {
          console.log('ERROR in inserts:', error.message)
          db.close()
          res.status(500).json({ error: 'Failed to save mapped data: ' + error.message })
        })
    })
      }
    )
  } catch (error) {
    console.error('Save mapped data error:', error)
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
 * Record a staged file after successful load
 * POST /api/staged-files
 * Body: { dbPath, fileName, fileType, rowCount }
 */
app.post('/api/staged-files', express.json(), (req, res) => {
  try {
    const { dbPath, fileName, fileType, rowCount } = req.body

    if (!dbPath || !fileName || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.run(
      `INSERT INTO staged_file (file_name, file_type, row_count, is_valid)
       VALUES (?, ?, ?, 1)`,
      [fileName, fileType, rowCount || 0],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to record staged file: ' + err.message })
        }

        res.json({
          success: true,
          fileId: this.lastID,
          message: 'Staged file recorded'
        })
      }
    )
  } catch (error) {
    console.error('Record staged file error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get staged files by type
 * GET /api/staged-files/:fileType
 * Query params: dbPath
 */
app.get('/api/staged-files/:fileType', (req, res) => {
  try {
    const { fileType } = req.params
    const { dbPath } = req.query

    if (!dbPath) {
      return res.status(400).json({ error: 'Missing dbPath parameter' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT file_id, file_name, file_type, row_count, uploaded_at, is_valid
       FROM staged_file
       WHERE file_type = ?
       ORDER BY uploaded_at DESC`,
      [fileType],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to retrieve staged files: ' + err.message })
        }

        res.json({ success: true, files: rows || [] })
      }
    )
  } catch (error) {
    console.error('Get staged files error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Delete a staged file record
 * DELETE /api/staged-files/:fileId
 * Query params: dbPath
 */
app.delete('/api/staged-files/:fileId', (req, res) => {
  try {
    const { fileId } = req.params
    const { dbPath } = req.query

    if (!dbPath) {
      return res.status(400).json({ error: 'Missing dbPath parameter' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.run(
      `DELETE FROM staged_file WHERE file_id = ?`,
      [fileId],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to delete staged file: ' + err.message })
        }

        res.json({
          success: true,
          deleted: this.changes,
          message: 'Staged file deleted'
        })
      }
    )
  } catch (error) {
    console.error('Delete staged file error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get preview of a staged file by fetching from its staging table
 * GET /api/staged-files/:fileId/preview
 * Query params: dbPath
 */
app.get('/api/staged-files/:fileId/preview', (req, res) => {
  try {
    const { fileId } = req.params
    const { dbPath } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // First, get the file info to determine which staging table to query
    db.get(
      `SELECT file_name, file_type FROM staged_file WHERE file_id = ?`,
      [fileId],
      (err, file) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to retrieve file info: ' + err.message })
        }

        if (!file) {
          db.close()
          return res.status(404).json({ error: 'File not found' })
        }

        // Determine staging table name based on file type
        let stagingTableName
        let useFileIdFilter = true

        if (file.file_type === 'pnl' || file.file_type === 'balance_sheet' ||
            file.file_type === 'cashflow' || file.file_type === 'carbon') {
          stagingTableName = `staging_statement_${file.file_type}`
        } else if (file.file_type === 'scenario') {
          // Scenarios use numbered tables
          stagingTableName = `staging_scenario_${fileId}`
          useFileIdFilter = false
        } else if (file.file_type === 'location') {
          stagingTableName = 'staging_location'
        } else if (file.file_type === 'damage_curve') {
          stagingTableName = 'staging_damage_curve'
        } else {
          db.close()
          return res.status(400).json({ error: 'Unknown file type: ' + file.file_type })
        }

        // Query the staging table
        const query = useFileIdFilter
          ? `SELECT * FROM ${stagingTableName} WHERE file_id = ? LIMIT 1000`
          : `SELECT * FROM ${stagingTableName} LIMIT 1000`
        const params = useFileIdFilter ? [fileId] : []

        db.all(query, params, (err, rows) => {
          if (err) {
            db.close()
            return res.status(500).json({ error: 'Failed to retrieve staging data: ' + err.message })
          }

          // Convert rows back to CSV format
          if (!rows || rows.length === 0) {
            db.close()
            return res.json({ success: true, csvText: '' })
          }

          // Get column names (exclude internal columns)
          const columns = Object.keys(rows[0]).filter(
            col => !['_rowid', 'staging_id', 'id', 'file_id', 'imported_at', 'is_mapped'].includes(col)
          )

          // Build CSV text
          const csvLines = [columns.join(',')]
          for (const row of rows) {
            const values = columns.map(col => {
              const val = row[col]
              // Escape values that contain commas or quotes
              if (val && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                return `"${val.replace(/"/g, '""')}"`
              }
              return val || ''
            })
            csvLines.push(values.join(','))
          }

          db.close()
          res.json({
            success: true,
            csvText: csvLines.join('\n'),
            fileName: file.file_name
          })
        })
      }
    )
  } catch (error) {
    console.error('Get staged file preview error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get list of scenario staging tables with filenames
 * GET /api/scenarios/staging-tables
 * Query params: dbPath
 */
app.get('/api/scenarios/staging-tables', (req, res) => {
  try {
    const { dbPath } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get filenames from staged_file table - each file represents a "table" to map
    db.all(
      `SELECT file_id, file_name FROM staged_file WHERE file_type = 'scenario' ORDER BY uploaded_at`,
      [],
      (err, fileRows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to fetch file names: ' + err.message })
        }

        // Each file has its own staging table: staging_scenario_{file_id}
        const tables = fileRows.map(file => ({
          tableName: `staging_scenario_${file.file_id}`,
          fileName: file.file_name,
          fileId: file.file_id
        }))

        res.json({ success: true, tables })
      }
    )
  } catch (error) {
    console.error('Get staging tables error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get columns from a scenario staging table
 * GET /api/scenarios/staging-columns
 * Query params: dbPath, tableName
 */
app.get('/api/scenarios/staging-columns', (req, res) => {
  try {
    const { dbPath, tableName } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(`PRAGMA table_info(${tableName})`, [], (err, columns) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to get table info: ' + err.message })
      }

      // Filter out internal columns
      const csvColumns = columns
        .map(col => ({ name: col.name }))
        .filter(col => !['_rowid', 'imported_at', 'is_mapped'].includes(col.name))

      res.json({ success: true, columns: csvColumns })
    })
  } catch (error) {
    console.error('Get staging columns error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get preview data from a scenario staging table
 * GET /api/scenarios/staging-preview
 * Query params: dbPath, tableName, limit (optional, default 5)
 */
app.get('/api/scenarios/staging-preview', (req, res) => {
  try {
    const { dbPath, tableName, limit = '5' } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const limitNum = parseInt(limit) || 5

    db.all(`SELECT * FROM ${tableName} LIMIT ?`, [limitNum], (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to get preview data: ' + err.message })
      }

      res.json({ success: true, data: rows })
    })
  } catch (error) {
    console.error('Get staging preview error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save scenario mapping
 * POST /api/scenarios/save-mapping
 * Body: { dbPath, tableName, mappings }
 */
app.post('/api/scenarios/save-mapping', express.json(), (req, res) => {
  try {
    const { dbPath, tableName, mappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName || !mappings) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const mappingJson = JSON.stringify(mappings)

    // Store mapping in a scenarios_mapping table (create if needed)
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS scenario_mapping (
          mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL UNIQUE,
          column_mapping TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_updated TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `, (err) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to create mapping table: ' + err.message })
        }

        db.run(
          `INSERT OR REPLACE INTO scenario_mapping (table_name, column_mapping, last_updated)
           VALUES (?, ?, datetime('now'))`,
          [tableName, mappingJson],
          function(err) {
            db.close()

            if (err) {
              return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
            }

            res.json({
              success: true,
              message: `Mapping saved for ${tableName}`
            })
          }
        )
      })
    })
  } catch (error) {
    console.error('Save scenario mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get all drivers
 * GET /api/drivers
 * Query params: dbPath
 */
app.get('/api/drivers', (req, res) => {
  try {
    const { dbPath } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all('SELECT * FROM driver WHERE is_active = 1 ORDER BY category, code', [], (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to fetch drivers: ' + err.message })
      }

      res.json(rows || [])
    })
  } catch (error) {
    console.error('Get drivers error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save drivers (bulk create/update)
 * POST /api/drivers
 * Body: { dbPath, drivers }
 */
app.post('/api/drivers', express.json(), (req, res) => {
  try {
    const { dbPath, drivers } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!drivers || !Array.isArray(drivers)) {
      return res.status(400).json({ error: 'Drivers array is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Begin transaction
    db.serialize(() => {
      db.run('BEGIN TRANSACTION')

      let processedCount = 0
      let hasError = false

      drivers.forEach((driver) => {
        if (!driver.code || !driver.name) {
          hasError = true
          processedCount++
          return
        }

        if (driver.driver_id) {
          // Update existing driver
          db.run(
            `UPDATE driver
             SET code = ?, name = ?, description = ?, category = ?
             WHERE driver_id = ?`,
            [driver.code, driver.name, driver.description || '', driver.category, driver.driver_id],
            (err) => {
              if (err) {
                console.error('Update driver error:', err)
                hasError = true
              }
              processedCount++

              if (processedCount === drivers.length) {
                finishTransaction()
              }
            }
          )
        } else {
          // Insert new driver
          db.run(
            `INSERT INTO driver (code, name, description, category)
             VALUES (?, ?, ?, ?)`,
            [driver.code, driver.name, driver.description || '', driver.category],
            (err) => {
              if (err) {
                console.error('Insert driver error:', err)
                hasError = true
              }
              processedCount++

              if (processedCount === drivers.length) {
                finishTransaction()
              }
            }
          )
        }
      })

      function finishTransaction() {
        if (hasError) {
          db.run('ROLLBACK', () => {
            db.close()
            res.status(500).json({ error: 'Failed to save drivers' })
          })
        } else {
          db.run('COMMIT', () => {
            db.close()
            res.json({
              success: true,
              message: `Successfully saved ${drivers.length} driver(s)`
            })
          })
        }
      }
    })
  } catch (error) {
    console.error('Save drivers error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get entity hierarchy levels
 * GET /api/entity-levels
 * Query: dbPath
 */
app.get('/api/entity-levels', (req, res) => {
  try {
    const { dbPath } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT DISTINCT granularity_level FROM entity WHERE granularity_level IS NOT NULL ORDER BY granularity_level`,
      [],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to fetch entity levels: ' + err.message })
        }

        const levels = rows.map(row => row.granularity_level)
        res.json({ success: true, levels })
      }
    )
  } catch (error) {
    console.error('Get entity levels error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get unique values from a column in a staging table
 * GET /api/scenarios/unique-values
 * Query: dbPath, tableName, columnName
 */
app.get('/api/scenarios/unique-values', (req, res) => {
  try {
    const { dbPath, tableName, columnName } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName || !columnName) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get distinct values from the specified column
    db.all(
      `SELECT DISTINCT "${columnName}" as value FROM "${tableName}" WHERE "${columnName}" IS NOT NULL ORDER BY "${columnName}"`,
      [],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to fetch unique values: ' + err.message })
        }

        const values = rows.map(row => row.value)
        res.json({ success: true, values })
      }
    )
  } catch (error) {
    console.error('Get unique values error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save scenario file configuration and variable mappings
 * POST /api/scenarios/save-file-config
 * Body: { dbPath, config: { tableName, scenarioColumn, variableColumn, classificationColumns }, mappings: [{ variableValue, driverCode }] }
 */
app.post('/api/scenarios/save-file-config', express.json(), (req, res) => {
  try {
    const { dbPath, config, mappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!config || !mappings) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.serialize(() => {
      // Create table if it doesn't exist
      db.run(
        `CREATE TABLE IF NOT EXISTS scenario_file_config (
          config_id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL UNIQUE,
          scenario_column TEXT NOT NULL,
          variable_column TEXT NOT NULL,
          classification_columns TEXT,
          variable_mappings TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_updated TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        (err) => {
          if (err) {
            db.close()
            return res.status(500).json({ error: 'Failed to create config table: ' + err.message })
          }

          // Prepare data
          const classificationColumnsJson = JSON.stringify(config.classificationColumns || [])
          const variableMappingsJson = JSON.stringify(mappings)

          // Insert or replace configuration
          db.run(
            `INSERT OR REPLACE INTO scenario_file_config
             (table_name, scenario_column, variable_column, classification_columns, variable_mappings, last_updated)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [
              config.tableName,
              config.scenarioColumn,
              config.variableColumn,
              classificationColumnsJson,
              variableMappingsJson
            ],
            (err) => {
              db.close()

              if (err) {
                return res.status(500).json({ error: 'Failed to save configuration: ' + err.message })
              }

              res.json({
                success: true,
                message: `Configuration saved for ${config.tableName}`
              })
            }
          )
        }
      )
    })
  } catch (error) {
    console.error('Save file config error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save scenario mapping (using new scenario_mapping table schema)
 * POST /api/scenarios/save-scenario-mapping
 */
app.post('/api/scenarios/save-scenario-mapping', express.json(), (req, res) => {
  try {
    const { dbPath, fileId, scenarioColumn, unitsColumn, driverColumn, valueColumns, variableMappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId || !driverColumn || valueColumns === undefined || variableMappings === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const valueColumnsJson = JSON.stringify(valueColumns)
    const variableMappingsJson = JSON.stringify(variableMappings)

    db.run(
      `INSERT OR REPLACE INTO scenario_mapping
       (file_id, scenario_column, units_column, driver_column, value_columns, variable_mappings, last_updated)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [fileId, scenarioColumn, unitsColumn, driverColumn, valueColumnsJson, variableMappingsJson],
      function(err) {
        db.close()

        if (err) {
          console.error('Error saving scenario mapping:', err)
          return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
        }

        res.json({
          success: true,
          message: 'Scenario mapping saved successfully',
          mappingId: this.lastID
        })
      }
    )
  } catch (error) {
    console.error('Save scenario mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get scenario mapping by file ID
 * GET /api/scenarios/get-scenario-mapping?dbPath=...&fileId=...
 */
app.get('/api/scenarios/get-scenario-mapping', (req, res) => {
  try {
    const { dbPath, fileId } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId) {
      return res.status(400).json({ error: 'Missing file ID' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.get(
      `SELECT * FROM scenario_mapping WHERE file_id = ?`,
      [fileId],
      (err, row) => {
        db.close()

        if (err) {
          console.error('Error retrieving scenario mapping:', err)
          return res.status(500).json({ error: 'Failed to retrieve mapping: ' + err.message })
        }

        if (!row) {
          return res.json({
            success: true,
            mapping: null
          })
        }

        // Parse JSON fields
        res.json({
          success: true,
          mapping: {
            mappingId: row.mapping_id,
            fileId: row.file_id,
            scenarioColumn: row.scenario_column,
            unitsColumn: row.units_column,
            driverColumn: row.driver_column,
            valueColumns: JSON.parse(row.value_columns),
            variableMappings: JSON.parse(row.variable_mappings),
            createdAt: row.created_at,
            lastUpdated: row.last_updated
          }
        })
      }
    )
  } catch (error) {
    console.error('Get scenario mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

// =====================================================
// LOCATION & DAMAGE CURVE ENDPOINTS
// =====================================================

/**
 * Load location CSV into staging_location table
 * POST /api/locations/load
 * Body: dbPath
 * File: CSV file
 */
app.post('/api/locations/load', upload.single('file'), async (req, res) => {
  console.log('Received location upload request')

  try {
    const { dbPath } = req.body
    const file = req.file

    if (!file || !dbPath) {
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
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: `Database not found at ${dbPath}` })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.serialize(() => {
      // Insert file record into staged_file
      db.run(
        `INSERT INTO staged_file (file_name, file_type, row_count) VALUES (?, 'location', ?)`,
        [file.originalname, records.length],
        function(err) {
          if (err) {
            console.error('Error inserting staged_file:', err)
            db.close()
            fs.unlinkSync(file.path)
            return res.status(500).json({ error: 'Failed to record file' })
          }

          const fileId = this.lastID

          // Create staging table with dynamic columns
          const columns = Object.keys(records[0])
          // Sanitize and deduplicate column names
          const sanitizedColumns = []
          const seenColumns = new Map()
          columns.forEach(col => {
            let sanitized = col.replace(/[^a-zA-Z0-9_]/g, '_')
            const lowerSanitized = sanitized.toLowerCase()
            if (seenColumns.has(lowerSanitized)) {
              const count = seenColumns.get(lowerSanitized)
              sanitized = `${sanitized}_${count}`
              seenColumns.set(lowerSanitized, count + 1)
            } else {
              seenColumns.set(lowerSanitized, 1)
            }
            sanitizedColumns.push(sanitized)
          })
          const columnDefs = sanitizedColumns.map(col => `"${col}" TEXT`).join(', ')

          db.run(`DROP TABLE IF EXISTS staging_location`, (err) => {
            if (err) {
              console.error('Drop table error:', err)
              db.close()
              fs.unlinkSync(file.path)
              return res.status(500).json({ error: 'Failed to drop old staging table' })
            }

            db.run(`CREATE TABLE staging_location (
              staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
              file_id INTEGER,
              ${columnDefs},
              imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              is_mapped INTEGER DEFAULT 0,
              FOREIGN KEY (file_id) REFERENCES staged_file(file_id)
            )`, (err) => {
            if (err) {
              console.error('Create table error:', err)
              db.close()
              fs.unlinkSync(file.path)
              return res.status(500).json({ error: 'Failed to create staging table' })
            }

            // Insert records
            const placeholders = sanitizedColumns.map(() => '?').join(', ')
            const columnNames = sanitizedColumns.map(c => `"${c}"`).join(', ')
            const stmt = db.prepare(
              `INSERT INTO staging_location (file_id, ${columnNames}) VALUES (?, ${placeholders})`
            )

            let inserted = 0
            for (const record of records) {
              const values = [fileId, ...columns.map(col => record[col])]
              stmt.run(values, (err) => {
                if (err) {
                  console.error('Insert error:', err)
                }
                inserted++
                if (inserted === records.length) {
                  stmt.finalize()
                  db.close()
                  fs.unlinkSync(file.path)
                  res.json({
                    success: true,
                    fileId,
                    rowCount: records.length,
                    columns
                  })
                }
              })
            }
            })
          })
        }
      )
    })
  } catch (error) {
    console.error('Load location error:', error)
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get location staging data preview
 * GET /api/locations/staging-preview
 * Query params: dbPath, limit (optional)
 */
app.get('/api/locations/staging-preview', (req, res) => {
  try {
    const { dbPath, limit = 10 } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT * FROM staging_location LIMIT ?`,
      [limit],
      (err, rows) => {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch staging data: ' + err.message })
        }
        res.json({ success: true, data: rows })
      }
    )
  } catch (error) {
    console.error('Staging preview error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save location mapping configuration
 * POST /api/locations/save-mapping
 * Body: { dbPath, fileId, columnMapping, entityMapping }
 */
app.post('/api/locations/save-mapping', async (req, res) => {
  try {
    const { dbPath, fileId, columnMapping, entityMapping } = req.body

    if (!dbPath || !fileId || !columnMapping || !entityMapping) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Save mapping configuration
    db.run(
      `INSERT OR REPLACE INTO location_mapping (file_id, column_mapping, entity_mapping) VALUES (?, ?, ?)`,
      [fileId, JSON.stringify(columnMapping), JSON.stringify(entityMapping)],
      function(err) {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
        }
        res.json({ success: true, mappingId: this.lastID })
      }
    )
  } catch (error) {
    console.error('Save mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Load damage curve CSV into staging_damage_curve table
 * POST /api/damage-curves/load
 * Body: dbPath
 * File: CSV file
 */
app.post('/api/damage-curves/load', upload.single('file'), async (req, res) => {
  console.log('Received damage curve upload request')

  try {
    const { dbPath } = req.body
    const file = req.file

    if (!file || !dbPath) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const fileContent = fs.readFileSync(file.path, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    if (records.length === 0) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: `Database not found at ${dbPath}` })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.serialize(() => {
      // Insert file record
      db.run(
        `INSERT INTO staged_file (file_name, file_type, row_count) VALUES (?, 'damage_curve', ?)`,
        [file.originalname, records.length],
        function(err) {
          if (err) {
            db.close()
            fs.unlinkSync(file.path)
            return res.status(500).json({ error: 'Failed to record file' })
          }

          const fileId = this.lastID
          const columns = Object.keys(records[0])
          const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ')

          db.run(`DROP TABLE IF EXISTS staging_damage_curve`)

          db.run(`CREATE TABLE staging_damage_curve (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER,
            ${columnDefs},
            imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_mapped INTEGER DEFAULT 0,
            FOREIGN KEY (file_id) REFERENCES staged_file(file_id)
          )`, (err) => {
            if (err) {
              db.close()
              fs.unlinkSync(file.path)
              return res.status(500).json({ error: 'Failed to create staging table' })
            }

            const placeholders = columns.map(() => '?').join(', ')
            const columnNames = columns.map(c => `"${c}"`).join(', ')
            const stmt = db.prepare(
              `INSERT INTO staging_damage_curve (file_id, ${columnNames}) VALUES (?, ${placeholders})`
            )

            let inserted = 0
            for (const record of records) {
              const values = [fileId, ...columns.map(col => record[col])]
              stmt.run(values, (err) => {
                if (err) console.error('Insert error:', err)
                inserted++
                if (inserted === records.length) {
                  stmt.finalize()
                  db.close()
                  fs.unlinkSync(file.path)
                  res.json({
                    success: true,
                    fileId,
                    rowCount: records.length,
                    columns
                  })
                }
              })
            }
          })
        }
      )
    })
  } catch (error) {
    console.error('Load damage curve error:', error)
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get damage curve staging data preview
 * GET /api/damage-curves/staging-preview
 * Query params: dbPath, limit (optional)
 */
app.get('/api/damage-curves/staging-preview', (req, res) => {
  try {
    const { dbPath, limit = 100 } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT * FROM staging_damage_curve LIMIT ?`,
      [limit],
      (err, rows) => {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch staging data: ' + err.message })
        }
        res.json({ success: true, data: rows })
      }
    )
  } catch (error) {
    console.error('Staging preview error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save damage curve mapping configuration
 * POST /api/damage-curves/save-mapping
 * Body: { dbPath, fileId, columnMapping, perilDriverMapping }
 */
app.post('/api/damage-curves/save-mapping', async (req, res) => {
  try {
    const { dbPath, fileId, columnMapping, perilDriverMapping } = req.body

    if (!dbPath || !fileId || !columnMapping) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.run(
      `INSERT OR REPLACE INTO damage_curve_mapping (file_id, column_mapping, peril_driver_mapping) VALUES (?, ?, ?)`,
      [fileId, JSON.stringify(columnMapping), JSON.stringify(perilDriverMapping)],
      function(err) {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
        }
        res.json({ success: true, mappingId: this.lastID })
      }
    )
  } catch (error) {
    console.error('Save curve mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save scenario mappings
 * POST /api/scenario-mappings/save
 * Body: { dbPath, fileId, driverColumn, valueColumns, variableMappings }
 */
app.post('/api/scenario-mappings/save', express.json(), (req, res) => {
  try {
    const { dbPath, fileId, driverColumn, valueColumns, variableMappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId || !driverColumn || !valueColumns || !variableMappings) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const valueColumnsJson = JSON.stringify(valueColumns)
    const variableMappingsJson = JSON.stringify(variableMappings)

    db.run(
      `INSERT INTO scenario_mapping (file_id, driver_column, value_columns, variable_mappings)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(file_id) DO UPDATE SET
         driver_column = excluded.driver_column,
         value_columns = excluded.value_columns,
         variable_mappings = excluded.variable_mappings,
         last_updated = datetime('now')`,
      [fileId, driverColumn, valueColumnsJson, variableMappingsJson],
      function(err) {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to save scenario mapping: ' + err.message })
        }

        res.json({
          success: true,
          message: `Scenario mapping saved for file ${fileId}`,
          mappingId: this.lastID
        })
      }
    )
  } catch (error) {
    console.error('Save scenario mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Claude AI proxy endpoint
 * POST /api/claude/messages
 * Body: { prompt, csvSample, lineItems, companyName }
 */
app.post('/api/claude/messages', express.json(), async (req, res) => {
  try {
    const { prompt, csvSample, lineItems, companyName } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    // Load API key from environment (check both CLAUDE_API_KEY and ANTHROPIC_API_KEY)
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.' })
    }

    // Forward request to Claude API
    const fetch = (await import('node-fetch')).default
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Claude API error:', error)
      return res.status(response.status).json({ error: error.error?.message || 'AI mapping failed' })
    }

    const result = await response.json()
    res.json(result)

  } catch (error) {
    console.error('Claude proxy error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * AI Formula Suggestion endpoint
 */
app.post('/api/ai/suggest-formula', async (req, res) => {
  try {
    const { context } = req.body

    if (!context) {
      return res.status(400).json({ error: 'Context is required' })
    }

    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('Claude API key not found in environment')
      return res.status(500).json({ error: 'Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: context
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Claude API error:', error)
      return res.status(response.status).json({ error: error.error?.message || 'AI suggestion failed' })
    }

    const result = await response.json()
    const suggestion = result.content[0].text

    res.json({ suggestion })

  } catch (error) {
    console.error('Formula suggestion error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Update statement template formula for a line item
 * PUT /api/statement-templates/:code
 */
app.put('/api/statement-templates/:code', (req, res) => {
  const { code } = req.params
  const { dbPath, lineItemCode, formula } = req.body

  if (!dbPath || !lineItemCode || formula === undefined) {
    return res.status(400).json({ error: 'Database path, line item code, and formula required' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  // First, get the current template
  db.get('SELECT json_structure FROM statement_template WHERE code = ?', [code], (err, row) => {
    if (err) {
      db.close()
      return res.status(500).json({ error: err.message })
    }

    if (!row) {
      db.close()
      return res.status(404).json({ error: 'Template not found' })
    }

    try {
      const jsonStructure = JSON.parse(row.json_structure)

      // Find and update the line item's formula
      const lineItem = jsonStructure.line_items.find(item => item.code === lineItemCode)
      if (!lineItem) {
        db.close()
        return res.status(404).json({ error: 'Line item not found' })
      }

      lineItem.formula = formula || null

      // Update the database with the modified json_structure
      const updatedJson = JSON.stringify(jsonStructure)
      db.run(
        'UPDATE statement_template SET json_structure = ?, updated_at = datetime("now") WHERE code = ?',
        [updatedJson, code],
        function(err) {
          db.close()

          if (err) {
            return res.status(500).json({ error: err.message })
          }

          res.json({ success: true, message: 'Formula updated successfully' })
        }
      )
    } catch (e) {
      db.close()
      return res.status(500).json({ error: 'Failed to parse or update JSON structure' })
    }
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
