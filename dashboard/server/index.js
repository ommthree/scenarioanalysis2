import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from api-keys.env
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '../../env/api-keys.env')
dotenv.config({ path: envPath })

// Verify API key is loaded
const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY
console.log('API key loaded:', apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : 'No')

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import sqlite3 from 'sqlite3'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import * as security from './security.js'
import StagingService from './staging_service.js'
import ValidationService from './validation_service.js'
import LoggingService from './logging_service.js'
import WhatIfService from './whatif_service.js'

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

    // Create safe staging table name with validation
    let stagingTableName
    try {
      stagingTableName = security.createStatementStagingTableName(statementType)
    } catch (err) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: err.message })
    }

    // Get columns from first record and validate
    const columns = Object.keys(records[0])
    try {
      security.validateColumnNames(columns)
    } catch (err) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Invalid column names in CSV: ' + err.message })
    }

    const columnDefs = columns.map(col => `"${col.replace(/"/g, '""')}" TEXT`).join(', ')

    // Execute database operations
    db.serialize(() => {
      // Drop existing staging table
      db.run(`DROP TABLE IF EXISTS ${security.quoteIdentifier(stagingTableName)}`)

      // Create new staging table
      db.run(`CREATE TABLE ${security.quoteIdentifier(stagingTableName)} (
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
        const stmt = db.prepare(`INSERT INTO ${security.quoteIdentifier(stagingTableName)} (${columnNames}) VALUES (${placeholders})`)

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
/**
 * POST /api/scenarios/load
 * Body: scenarioName, dbPath
 * File: CSV file
 * Refactored to use StagingService for unified staging architecture
 */
app.post('/api/scenarios/load', upload.single('file'), async (req, res) => {
  console.log('Received scenario upload request:', {
    scenarioName: req.body.scenarioName,
    dbPath: req.body.dbPath,
    hasFile: !!req.file
  })

  let db
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
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Get columns from first record and validate
    const columns = Object.keys(records[0])
    try {
      security.validateColumnNames(columns)
    } catch (err) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Invalid column names in CSV: ' + err.message })
    }

    // Connect to database
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    // 1. Insert into staged_file table
    const fileResult = await stagingService.dbRun(`
      INSERT INTO staged_file (file_name, file_type, row_count, csv_content)
      VALUES (?, ?, ?, ?)
    `, [file.originalname, 'scenario', records.length, fileContent])

    const fileId = fileResult.lastID

    // 2. Create staging table with metadata tracking
    const { stagingId, tableName } = await stagingService.createStagingTable(
      'scenario',
      fileId,
      file.originalname,
      columns
    )

    // 3. Insert data into staging table
    const placeholders = columns.map(() => '?').join(', ')
    const columnNames = columns.map(c => security.quoteIdentifier(c)).join(', ')
    const insertSql = `INSERT INTO ${security.quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`

    const stmt = db.prepare(insertSql)
    for (const record of records) {
      const values = columns.map(col => record[col])
      await new Promise((resolve, reject) => {
        stmt.run(values, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    await new Promise((resolve, reject) => {
      stmt.finalize((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 4. Update row count and status in staging metadata
    await stagingService.updateRowCount(stagingId, records.length)
    await stagingService.updateStatus(stagingId, 'pending')

    // Cleanup
    db.close()
    fs.unlinkSync(file.path)

    res.json({
      success: true,
      message: `Successfully loaded ${records.length} rows from ${scenarioName} into staging area.`,
      rowCount: records.length,
      tableName: tableName,
      stagingId: stagingId,
      fileId: fileId
    })

  } catch (error) {
    console.error('Import error:', error)
    if (db) db.close()
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
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

          // Create safe staging table name with validation
          let stagingTableName
          try {
            stagingTableName = security.createNumberedStagingTableName(tableNum)
          } catch (err) {
            db.close()
            files.forEach(f => fs.unlinkSync(f.path))
            return res.status(400).json({ error: err.message })
          }

          const columnDefs = fileData.columns.map(col => `"${col}" TEXT`).join(', ')

          // Create table for this file
          db.run(`CREATE TABLE ${security.quoteIdentifier(stagingTableName)} (
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
                const stmt = db.prepare(`INSERT INTO ${security.quoteIdentifier(stagingTableName)} (${columnNames}) VALUES (${placeholders})`)

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
 * Load correlation matrix CSV file
 * POST /api/correlation/load
 * Body: dbPath
 * File: Single CSV file
 */
app.post('/api/correlation/load', upload.single('file'), async (req, res) => {
  console.log('Received correlation matrix upload request:', {
    dbPath: req.body.dbPath,
    file: req.file?.originalname
  })

  try {
    const { dbPath } = req.body
    const file = req.file

    if (!file || !dbPath) {
      console.log('Missing fields - file:', file?.originalname, 'dbPath:', dbPath)
      if (file) fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Parse CSV file
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    let records
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    } catch (parseError) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: `Failed to parse CSV: ${parseError.message}` })
    }

    if (records.length === 0) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    // Validate square matrix structure
    const headers = Object.keys(records[0])
    const dataColumnCount = headers.length - 1 // Exclude the first column (variable names)
    const actualRowCount = records.length

    if (actualRowCount !== dataColumnCount) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Correlation matrix must be square. Found ${actualRowCount} rows but ${dataColumnCount} data columns (excluding label column).`
      })
    }

    // Validate all rows have the same number of columns
    for (let i = 0; i < records.length; i++) {
      const rowKeys = Object.keys(records[i])
      if (rowKeys.length !== headers.length) {
        fs.unlinkSync(file.path)
        return res.status(400).json({
          error: `Row ${i + 1} has ${rowKeys.length} columns but expected ${headers.length}.`
        })
      }
    }

    // Connect to database
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Store file metadata in staged_file table
    db.run(
      `INSERT INTO staged_file (file_name, file_type, row_count, csv_content, uploaded_at, is_valid)
       VALUES (?, 'correlation', ?, ?, datetime('now'), 1)`,
      [file.originalname, records.length, fileContent],
      function(err) {
        if (err) {
          console.error('Failed to insert staged_file record:', err)
          db.close()
          fs.unlinkSync(file.path)
          return res.status(500).json({ error: 'Failed to store file metadata: ' + err.message })
        }

        const fileId = this.lastID
        console.log(`Stored correlation matrix file: ${file.originalname} (file_id=${fileId}, rows=${records.length})`)

        db.close()
        fs.unlinkSync(file.path)

        res.json({
          success: true,
          message: `Successfully loaded correlation matrix with ${records.length} variables.`,
          fileId,
          rowCount: records.length,
          columns: headers
        })
      }
    )

  } catch (error) {
    console.error('Correlation load error:', error)
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/conversion/load
 * Upload and stage a unit conversion lookup table CSV file
 */
app.post('/api/conversion/load', upload.single('file'), async (req, res) => {
  console.log('Received conversion table upload request:', {
    dbPath: req.body.dbPath,
    file: req.file?.originalname
  })

  try {
    const { dbPath } = req.body
    const file = req.file

    if (!file || !dbPath) {
      console.log('Missing fields - file:', file?.originalname, 'dbPath:', dbPath)
      if (file) fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Database not found at ${dbPath}. Please select a valid database in the Database page.`
      })
    }

    // Parse CSV file
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    let records
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
    } catch (parseError) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: `Failed to parse CSV: ${parseError.message}` })
    }

    if (records.length === 0) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    // Validate at least 2 columns (from/to units)
    const headers = Object.keys(records[0])
    if (headers.length < 2) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Conversion table must have at least 2 columns. Found ${headers.length}.`
      })
    }

    // Connect to database
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('Database connection error:', err)
        fs.unlinkSync(file.path)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Store file metadata in staged_file table
    db.run(
      `INSERT INTO staged_file (file_name, file_type, row_count, csv_content, uploaded_at, is_valid)
       VALUES (?, 'conversion', ?, ?, datetime('now'), 1)`,
      [file.originalname, records.length, fileContent],
      function(err) {
        if (err) {
          console.error('Failed to insert staged_file record:', err)
          db.close()
          fs.unlinkSync(file.path)
          return res.status(500).json({ error: 'Failed to store file metadata: ' + err.message })
        }

        const fileId = this.lastID
        console.log(`Stored conversion table file: ${file.originalname} (file_id=${fileId}, rows=${records.length})`)

        db.close()
        fs.unlinkSync(file.path)

        res.json({
          success: true,
          message: `Successfully loaded conversion table with ${records.length} conversion(s).`,
          fileId,
          rowCount: records.length,
          columns: headers
        })
      }
    )

  } catch (error) {
    console.error('Conversion load error:', error)
    if (req.file) fs.unlinkSync(req.file.path)
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

    const tableName = tableNameMap[statementType.toLowerCase()]
    if (!tableName) {
      return res.status(400).json({ error: 'Invalid statement type' })
    }

    // Validate table name for additional safety
    try {
      security.validateTableName(tableName, 'staging_statement_')
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get table info to find columns
    db.all(`PRAGMA table_info(${security.quoteIdentifier(tableName)})`, [], (err, columns) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to get table info: ' + err.message })
      }

      // Filter out internal columns
      const csvColumns = columns
        .map(col => col.name)
        .filter(name => !['_rowid', 'imported_at', 'is_mapped'].includes(name))

      // Get all rows - each row represents a line item
      db.all(`SELECT * FROM ${security.quoteIdentifier(tableName)}`, [], (err, rows) => {
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
        // Frontend sends: 'pnl', 'bs', 'cf', 'carbon'
        const tableMap = {
          'pnl': { staging: 'staging_statement_pnl', result: 'pl_results' },
          'bs': { staging: 'staging_statement_balance_sheet', result: 'bs_result' },
          'balance_sheet': { staging: 'staging_statement_balance_sheet', result: 'bs_result' },
          'carbon': { staging: 'staging_statement_carbon', result: 'carbon_result' },
          'cf': { staging: 'staging_statement_cashflow', result: 'cf_result' },
          'cashflow': { staging: 'staging_statement_cashflow', result: 'cf_result' }
        }

        const tables = tableMap[statementType]
        if (!tables) {
          db.close()
          return res.status(400).json({ error: 'Invalid statement type: ' + statementType })
        }

        // Validate table name for additional safety
        try {
          security.validateTableName(tables.staging, 'staging_statement_')
        } catch (err) {
          db.close()
          return res.status(400).json({ error: err.message })
        }

        // Now get all staging data
        console.log('Querying staging table:', tables.staging)
        db.all(`SELECT * FROM ${security.quoteIdentifier(tables.staging)}`, [], (err, stagingRows) => {
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

        // Extract value from staging table
        // Balance sheet table: _rowid, line_item, units, value, imported_at, is_mapped
        // PNL table: _rowid, "Line Item", "Initial Value", imported_at, is_mapped
        let value = null

        // Try different column names depending on statement type
        if (statementType === 'balance_sheet' || statementType === 'bs') {
          // Balance sheet uses lowercase 'value' column
          if (csvRow['value'] !== undefined && csvRow['value'] !== null) {
            value = parseFloat(csvRow['value'])
          }
        } else {
          // PNL and others use 'Initial Value' column
          if (csvRow['Initial Value'] !== undefined && csvRow['Initial Value'] !== null) {
            value = parseFloat(csvRow['Initial Value'])
          }
        }

        if (value === null || isNaN(value)) {
          console.log('WARNING: Could not extract value from row', csv_row_index, 'value:', csvRow['value'], 'Initial Value:', csvRow['Initial Value'])
          continue
        }

        console.log('Mapping:', line_item_code, '=', value, 'from row', csv_row_index)

        // Insert into appropriate result table
        let insertSql
        let insertParams

        if (statementType === 'pnl') {
          // P&L has specific schema with statement_id
          insertSql = `
            INSERT OR REPLACE INTO ${security.quoteIdentifier(tables.result)}
            (entity_id, scenario_id, period_id, statement_id, code, value, calculation_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `
          insertParams = [targetEntityId, scenarioId, periodId, statementId, line_item_code, value]
        } else if (statementType === 'carbon') {
          insertSql = `
            INSERT OR REPLACE INTO ${security.quoteIdentifier(tables.result)}
            (entity_id, scenario_id, period_id, template_code, line_item_code, value, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          `
          insertParams = [targetEntityId, scenarioId, periodId, templateCode, line_item_code, value]
        } else if (statementType === 'balance_sheet' || statementType === 'bs') {
          // For balance sheet, store as drivers in scenario_drivers with period_id=0 (opening balance)
          // This allows formulas to reference them using [t-1] syntax in period 1+
          // Force period_id to 0 for balance sheet items since they represent opening balances
          insertSql = `
            INSERT OR REPLACE INTO scenario_drivers
            (scenario_id, period_id, driver_code, value, unit_code, is_populated)
            VALUES (?, 0, ?, ?, 'CHF', 1)
          `
          insertParams = [scenarioId, line_item_code, value]
        } else {
          // For CF - skip for now
          // TODO: Implement CF storage
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

    // Hard delete - actually remove the row
    db.run(
      'DELETE FROM entity WHERE entity_id = ?',
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

  // Log what we're receiving (for debugging)
  console.log(`Saving template ${template.code} with ${lineItems?.length || 0} line items`)
  if (lineItems && lineItems.length > 0) {
    const taggedItems = lineItems.filter(item =>
      item.is_mac_numerator || item.is_mac_denominator ||
      item.is_roi_numerator || item.is_roi_denominator
    )
    console.log(`  Tagged items: ${taggedItems.length}`)
    taggedItems.forEach(item => {
      console.log(`    ${item.code}: MAC num=${!!item.is_mac_numerator} den=${!!item.is_mac_denominator} ROI num=${!!item.is_roi_numerator} den=${!!item.is_roi_denominator}`)
    })
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
    const { dbPath, fileName, fileType, rowCount, csvContent } = req.body

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
      `INSERT INTO staged_file (file_name, file_type, row_count, is_valid, csv_content)
       VALUES (?, ?, ?, 1, ?)`,
      [fileName, fileType, rowCount || 0, csvContent || null],
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

    // First, get the file_type to determine which mapping table to use
    db.get(
      `SELECT file_type FROM staged_file WHERE file_id = ?`,
      [fileId],
      (err, row) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to query file type: ' + err.message })
        }

        if (!row) {
          db.close()
          return res.status(404).json({ error: 'File not found' })
        }

        const fileType = row.file_type

        // Handle different file types
        if (fileType === 'scenario') {
          // Delete scenario mapping configuration, staging table, and staged file
          // Validate file_id and create safe staging table name
          let stagingTableName
          try {
            const validatedFileId = security.validateFileId(fileId)
            stagingTableName = security.createNumberedStagingTableName(validatedFileId)
          } catch (err) {
            db.close()
            return res.status(400).json({ error: err.message })
          }

          new Promise((resolve, reject) => {
            db.run(
              `DELETE FROM scenario_mapping WHERE file_id = ?`,
              [fileId],
              (err) => {
                if (err) reject(err)
                else resolve()
              }
            )
          })
            .then(() => {
              // Drop the staging table if it exists
              return new Promise((resolve, reject) => {
                db.run(
                  `DROP TABLE IF EXISTS ${security.quoteIdentifier(stagingTableName)}`,
                  (err) => {
                    if (err) {
                      console.warn(`Warning: Failed to drop table ${stagingTableName}:`, err.message)
                      // Don't fail the whole operation if table drop fails
                    }
                    resolve()
                  }
                )
              })
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staged_file WHERE file_id = ?`,
                  [fileId],
                  function(err) {
                    if (err) reject(err)
                    else resolve(this.changes)
                  }
                )
              })
            })
            .then((changes) => {
              db.close()
              console.log(`[File Deletion] Deleted scenario file_id ${fileId} and dropped table ${stagingTableName}`)
              res.json({
                success: true,
                deleted: changes,
                message: 'Staged scenario file deleted'
              })
            })
            .catch((err) => {
              db.close()
              res.status(500).json({ error: 'Failed to delete: ' + err.message })
            })
        } else if (fileType === 'damage_curve') {
          // Delete damage curve mapping, staging table, and file using StagingService
          const stagingService = new StagingService(db)

          new Promise((resolve, reject) => {
            db.run(
              `DELETE FROM damage_curve_mapping WHERE file_id = ?`,
              [fileId],
              (err) => {
                if (err) reject(err)
                else resolve()
              }
            )
          })
            .then(async () => {
              // Get staging table name and drop it
              const stagingInfo = await stagingService.getStagingInfoByFileId(fileId, 'damage_curve')
              if (stagingInfo) {
                await stagingService.deleteStagingTable(stagingInfo.staging_id)
                console.log(`Deleted staging table ${stagingInfo.staging_table_name} for damage curve file_id ${fileId}`)
              }
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staged_file WHERE file_id = ?`,
                  [fileId],
                  function(err) {
                    if (err) reject(err)
                    else resolve(this.changes)
                  }
                )
              })
            })
            .then((changes) => {
              db.close()
              console.log(`[File Deletion] Deleted damage_curve file_id ${fileId} and staging data`)
              res.json({
                success: true,
                deleted: changes,
                message: 'Damage curve file deleted'
              })
            })
            .catch((err) => {
              db.close()
              res.status(500).json({ error: 'Failed to delete: ' + err.message })
            })
        } else if (fileType === 'location') {
          // Delete location mapping config, staging data, and file
          new Promise((resolve, reject) => {
            db.run(
              `DELETE FROM location_mapping_config WHERE file_id = ?`,
              [fileId],
              (err) => {
                if (err) reject(err)
                else resolve()
              }
            )
          })
            .then(() => {
              // Delete staging data
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staging_location WHERE file_id = ?`,
                  [fileId],
                  (err) => {
                    if (err) {
                      console.warn(`Warning: Failed to delete staging_location for file_id ${fileId}:`, err.message)
                    }
                    resolve()
                  }
                )
              })
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staged_file WHERE file_id = ?`,
                  [fileId],
                  function(err) {
                    if (err) reject(err)
                    else resolve(this.changes)
                  }
                )
              })
            })
            .then((changes) => {
              db.close()
              console.log(`[File Deletion] Deleted location file_id ${fileId} and staging data`)
              res.json({
                success: true,
                deleted: changes,
                message: 'Location file deleted'
              })
            })
            .catch((err) => {
              db.close()
              res.status(500).json({ error: 'Failed to delete: ' + err.message })
            })
        } else if (fileType === 'hazard_map') {
          // Delete hazard map mapping, staging data, and file
          new Promise((resolve, reject) => {
            db.run(
              `DELETE FROM hazard_map_mapping WHERE file_id = ?`,
              [fileId],
              (err) => {
                if (err) reject(err)
                else resolve()
              }
            )
          })
            .then(() => {
              // Delete staging data
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staging_hazard_map WHERE file_id = ?`,
                  [fileId],
                  (err) => {
                    if (err) {
                      console.warn(`Warning: Failed to delete staging_hazard_map for file_id ${fileId}:`, err.message)
                    }
                    resolve()
                  }
                )
              })
            })
            .then(() => {
              return new Promise((resolve, reject) => {
                db.run(
                  `DELETE FROM staged_file WHERE file_id = ?`,
                  [fileId],
                  function(err) {
                    if (err) reject(err)
                    else resolve(this.changes)
                  }
                )
              })
            })
            .then((changes) => {
              db.close()
              console.log(`[File Deletion] Deleted hazard_map file_id ${fileId} and staging data`)
              res.json({
                success: true,
                deleted: changes,
                message: 'Hazard map file deleted'
              })
            })
            .catch((err) => {
              db.close()
              res.status(500).json({ error: 'Failed to delete: ' + err.message })
            })
        } else {
          // For other file types, just delete the staged_file entry
          db.run(
            `DELETE FROM staged_file WHERE file_id = ?`,
            [fileId],
            function(err) {
              db.close()
              if (err) {
                return res.status(500).json({ error: 'Failed to delete: ' + err.message })
              }
              res.json({
                success: true,
                deleted: this.changes,
                message: 'Staged file deleted'
              })
            }
          )
        }
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
      `SELECT file_name, file_type, csv_content FROM staged_file WHERE file_id = ?`,
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

        // For files with csv_content, return it directly
        if (file.csv_content) {
          db.close()
          return res.json({
            success: true,
            csvText: file.csv_content,
            fileName: file.file_name
          })
        }

        // Determine staging table name based on file type
        let stagingTableName
        let useFileIdFilter = true

        try {
          if (file.file_type === 'pnl' || file.file_type === 'balance_sheet' ||
              file.file_type === 'cashflow' || file.file_type === 'carbon') {
            stagingTableName = `staging_statement_${file.file_type}`
            security.validateTableName(stagingTableName, 'staging_statement_')
            useFileIdFilter = false  // Statement staging tables don't have file_id
          } else if (file.file_type === 'scenario') {
            // Scenarios use numbered tables - validate fileId
            const validatedFileId = security.validateFileId(fileId)
            stagingTableName = security.createNumberedStagingTableName(validatedFileId)
            useFileIdFilter = false
          } else if (file.file_type === 'location') {
            stagingTableName = 'staging_location'
          } else if (file.file_type === 'hazard_map') {
            stagingTableName = 'staging_hazard_map'
          } else {
            db.close()
            return res.status(400).json({ error: 'Unknown file type: ' + file.file_type })
          }
        } catch (err) {
          db.close()
          return res.status(400).json({ error: err.message })
        }

        // Query the staging table
        // For hazard maps, we need all data for proper map visualization
        // For other types, limit to 1000 rows for preview
        const rowLimit = file.file_type === 'hazard_map' ? 500000 : 1000
        const query = useFileIdFilter
          ? `SELECT * FROM ${security.quoteIdentifier(stagingTableName)} WHERE file_id = ? LIMIT ${rowLimit}`
          : `SELECT * FROM ${security.quoteIdentifier(stagingTableName)} LIMIT ${rowLimit}`
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

    // Validate table name
    try {
      security.validateTableName(tableName, 'staging_scenario_')
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(`PRAGMA table_info(${security.quoteIdentifier(tableName)})`, [], (err, columns) => {
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

    // Validate table name
    try {
      security.validateTableName(tableName, 'staging_scenario_')
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const limitNum = parseInt(limit) || 5

    db.all(`SELECT * FROM ${security.quoteIdentifier(tableName)} LIMIT ?`, [limitNum], (err, rows) => {
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
 * Get unique currencies from staging table
 * GET /api/scenarios/get-currencies
 * Query params: dbPath, tableName
 */
app.get('/api/scenarios/get-currencies', (req, res) => {
  try {
    const { dbPath, tableName } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' })
    }

    // Validate table name
    try {
      security.validateTableName(tableName, 'staging_scenario_')
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get unique values from Units column
    db.all(`SELECT DISTINCT ${security.quoteIdentifier('Units')} as currency FROM ${security.quoteIdentifier(tableName)} WHERE ${security.quoteIdentifier('Units')} IS NOT NULL ORDER BY currency`, [], (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to get currencies: ' + err.message })
      }

      const currencies = rows.map(row => row.currency).filter(c => c && c.trim() !== '')
      res.json({ success: true, currencies })
    })
  } catch (error) {
    console.error('Get currencies error:', error)
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

      // First, delete all existing drivers
      db.run('DELETE FROM driver', (err) => {
        if (err) {
          console.error('Delete drivers error:', err)
          db.run('ROLLBACK')
          db.close()
          return res.status(500).json({ error: 'Failed to clear existing drivers: ' + err.message })
        }

        // Now insert new drivers
        let processedCount = 0
        let hasError = false

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

        if (drivers.length === 0) {
          // No drivers to insert, just commit
          db.run('COMMIT', (err) => {
            db.close()
            if (err) {
              return res.status(500).json({ error: 'Failed to commit: ' + err.message })
            }
            return res.json({ success: true, message: 'All drivers cleared' })
          })
          return
        }

        drivers.forEach((driver) => {
        if (!driver.code || !driver.name) {
          hasError = true
          processedCount++
          return
        }

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
      })
      }) // Close DELETE callback
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

    // Validate table name and column name
    try {
      security.validateTableName(tableName, 'staging_scenario_')
      security.validateColumnName(columnName)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get distinct values from the specified column
    db.all(
      `SELECT DISTINCT ${security.quoteIdentifier(columnName)} as value FROM ${security.quoteIdentifier(tableName)} WHERE ${security.quoteIdentifier(columnName)} IS NOT NULL ORDER BY ${security.quoteIdentifier(columnName)}`,
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
    const { dbPath, fileId, scenarioColumn, unitsColumn, driverColumn, valueColumns, variableMappings, templateCode } = req.body

    console.log('=== SAVE SCENARIO MAPPING RECEIVED ===')
    console.log('fileId:', fileId)
    console.log('scenarioColumn:', scenarioColumn)
    console.log('unitsColumn:', unitsColumn)
    console.log('driverColumn:', driverColumn)
    console.log('valueColumns:', valueColumns)
    console.log('valueColumns type:', typeof valueColumns)
    console.log('valueColumns isArray:', Array.isArray(valueColumns))
    console.log('valueColumns length:', valueColumns?.length)
    console.log('variableMappings count:', variableMappings?.length)
    console.log('templateCode:', templateCode)
    console.log('=====================================')

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId || !driverColumn || valueColumns === undefined || variableMappings === undefined) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Get active template if not provided
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // If templateCode not provided, fetch the active template
    const resolveTemplateCode = (callback) => {
      if (templateCode) {
        callback(null, templateCode)
      } else {
        db.get(
          'SELECT code FROM statement_template WHERE is_active = 1 LIMIT 1',
          [],
          (err, row) => {
            if (err) {
              callback(err)
            } else {
              callback(null, row?.code || null)
            }
          }
        )
      }
    }

    resolveTemplateCode((err, finalTemplateCode) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to resolve template: ' + err.message })
      }

      const valueColumnsJson = JSON.stringify(valueColumns)
      const variableMappingsJson = JSON.stringify(variableMappings)

      db.run(
        `INSERT OR REPLACE INTO scenario_mapping
         (file_id, scenario_column, units_column, driver_column, value_columns, variable_mappings, template_code, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [fileId, scenarioColumn, unitsColumn, driverColumn, valueColumnsJson, variableMappingsJson, finalTemplateCode],
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
    })
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
 * Load location CSV into unique staging table
 * POST /api/locations/load
 * Body: dbPath
 * File: CSV file
 * Refactored to use StagingService for unified staging architecture
 */
app.post('/api/locations/load', upload.single('file'), async (req, res) => {
  console.log('Received location upload request')

  let db
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

    // Get columns and sanitize
    const columns = Object.keys(records[0])
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

    // Connect to database
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    // 1. Insert into staged_file table
    const fileResult = await stagingService.dbRun(`
      INSERT INTO staged_file (file_name, file_type, row_count, csv_content)
      VALUES (?, ?, ?, ?)
    `, [file.originalname, 'location', records.length, fileContent])

    const fileId = fileResult.lastID

    // 2. Create staging table with metadata tracking
    const { stagingId, tableName } = await stagingService.createStagingTable(
      'location',
      fileId,
      file.originalname,
      sanitizedColumns
    )

    // 3. Insert data into staging table
    const placeholders = sanitizedColumns.map(() => '?').join(', ')
    const columnNames = sanitizedColumns.map(c => security.quoteIdentifier(c)).join(', ')
    const insertSql = `INSERT INTO ${security.quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`

    const stmt = db.prepare(insertSql)
    for (const record of records) {
      const values = columns.map(col => record[col])
      await new Promise((resolve, reject) => {
        stmt.run(values, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    await new Promise((resolve, reject) => {
      stmt.finalize((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 4. Update row count and status in staging metadata
    await stagingService.updateRowCount(stagingId, records.length)
    await stagingService.updateStatus(stagingId, 'pending')

    // Cleanup
    db.close()
    fs.unlinkSync(file.path)

    res.json({
      success: true,
      message: `Successfully loaded ${records.length} location records into staging area.`,
      rowCount: records.length,
      tableName: tableName,
      stagingId: stagingId,
      fileId: fileId
    })

  } catch (error) {
    console.error('Location import error:', error)
    if (db) db.close()
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
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
    const { dbPath, tableName, limit = 10 } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName) {
      return res.status(400).json({ error: 'Missing tableName parameter' })
    }

    // Validate table name format for security
    if (!/^staging_location_\d+$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name format' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.all(
      `SELECT * FROM ${security.quoteIdentifier(tableName)} LIMIT ?`,
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
 * Get full location staging data (all rows)
 * GET /api/locations/staging-full
 * Query params: dbPath, tableName
 */
app.get('/api/locations/staging-full', (req, res) => {
  try {
    const { dbPath, tableName } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!tableName) {
      return res.status(400).json({ error: 'Missing tableName parameter' })
    }

    // Validate table name format for security
    if (!/^staging_location(_\d+)?$/.test(tableName)) {
      return res.status(400).json({ error: 'Invalid table name format' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get all rows from the staging table
    db.all(
      `SELECT * FROM ${security.quoteIdentifier(tableName)}`,
      [],
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to fetch staging data: ' + err.message })
        }

        res.json({
          success: true,
          data: rows || []
        })
      }
    )
  } catch (error) {
    console.error('Staging full data error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get list of available staging tables for locations
 * GET /api/locations/staging-tables
 * Query params: dbPath
 */
app.get('/api/locations/staging-tables', (req, res) => {
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

    // Get all staged location files with their staging table names from staging_metadata
    db.all(
      `SELECT
        sf.file_id,
        sf.file_name,
        sf.row_count,
        sf.uploaded_at,
        sm.staging_table_name
       FROM staged_file sf
       LEFT JOIN staging_metadata sm ON sf.file_id = sm.file_id
       WHERE sf.file_type = 'location'
       ORDER BY sf.uploaded_at DESC`,
      [],
      (err, files) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to fetch staged files: ' + err.message })
        }

        // Return file info with actual table names from staging_metadata
        const tables = files.map(file => ({
          fileId: file.file_id,
          fileName: file.file_name,
          tableName: file.staging_table_name || 'staging_location'  // Fallback for legacy files
        }))

        db.close()
        res.json({ success: true, tables })
      }
    )
  } catch (error) {
    console.error('Get staging tables error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get entities hierarchy
 * GET /api/entities
 * Query params: dbPath
 */
app.get('/api/entities', (req, res) => {
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
      `SELECT entity_id, code as entity_code, name as entity_name, parent_entity_id as parent_id, granularity_level as level
       FROM entity
       WHERE is_active = 1
       ORDER BY granularity_level, code`,
      [],
      (err, entities) => {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch entities: ' + err.message })
        }
        res.json(entities || [])
      }
    )
  } catch (error) {
    console.error('Get entities error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save location mapping configuration
 * POST /api/locations/save-location-mapping
 * Body: { dbPath, fileId, identifierColumn, latitudeColumn, longitudeColumn, entityColumn, archetypeColumn, unitColumn, valueColumns, entityMappings }
 */
app.post('/api/locations/save-location-mapping', async (req, res) => {
  try {
    const {
      dbPath,
      fileId,
      identifierColumn,
      latitudeColumn,
      longitudeColumn,
      entityColumn,
      archetypeColumn,
      unitColumn,
      valueColumns,
      entityMappings
    } = req.body

    console.log('=== SAVE LOCATION MAPPING DEBUG ===')
    console.log('fileId:', fileId)
    console.log('valueColumns received:', valueColumns)
    console.log('valueColumns type:', typeof valueColumns)
    console.log('valueColumns stringified:', JSON.stringify(valueColumns || []))

    if (!dbPath || !fileId) {
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

    // Create table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS location_mapping_config (
      mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER UNIQUE,
      identifier_column TEXT,
      latitude_column TEXT,
      longitude_column TEXT,
      entity_column TEXT,
      archetype_column TEXT,
      unit_column TEXT,
      value_columns TEXT,
      entity_mappings TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES staged_file(file_id)
    )`, (err) => {
      if (err) {
        console.error('Create table error:', err)
      }

      // Add migration for archetype_column and unit_column if they don't exist
      db.run(`ALTER TABLE location_mapping_config ADD COLUMN archetype_column TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Migration error (archetype_column):', alterErr)
        }
      })

      db.run(`ALTER TABLE location_mapping_config ADD COLUMN unit_column TEXT`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Migration error (unit_column):', alterErr)
        }
      })

      // Save or update mapping configuration
      db.run(
        `INSERT INTO location_mapping_config (
          file_id, identifier_column, latitude_column, longitude_column,
          entity_column, archetype_column, unit_column, value_columns, entity_mappings, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(file_id) DO UPDATE SET
          identifier_column = excluded.identifier_column,
          latitude_column = excluded.latitude_column,
          longitude_column = excluded.longitude_column,
          entity_column = excluded.entity_column,
          archetype_column = excluded.archetype_column,
          unit_column = excluded.unit_column,
          value_columns = excluded.value_columns,
          entity_mappings = excluded.entity_mappings,
          updated_at = CURRENT_TIMESTAMP`,
        [
          fileId,
          identifierColumn,
          latitudeColumn,
          longitudeColumn,
          entityColumn,
          archetypeColumn,
          unitColumn,
          JSON.stringify(valueColumns || []),
          JSON.stringify(entityMappings || [])
        ],
        function(err) {
          db.close()
          if (err) {
            return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
          }
          res.json({ success: true, mappingId: this.lastID })
        }
      )
    })
  } catch (error) {
    console.error('Save location mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Ingest locations from staging into production location table
 * POST /api/locations/ingest
 * Body: { dbPath, fileId }
 */
app.post('/api/locations/ingest', async (req, res) => {
  try {
    const { dbPath, fileId } = req.body

    if (!dbPath || !fileId) {
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

    // Get the mapping configuration
    db.get(
      `SELECT * FROM location_mapping_config WHERE file_id = ?`,
      [fileId],
      (err, mapping) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to fetch mapping: ' + err.message })
        }

        if (!mapping) {
          db.close()
          return res.status(400).json({ error: 'No mapping configuration found for this file' })
        }

        console.log('[Location Ingestion] Starting ingestion for file_id:', fileId)

        // Parse the entity mappings
        const entityMappings = JSON.parse(mapping.entity_mappings || '[]')
        console.log('[Location Ingestion] Entity mappings:', entityMappings)

        // Create a map for quick lookup
        const entityMap = {}
        entityMappings.forEach(em => {
          entityMap[em.csv_entity_value] = em.entity_id
        })

        // Get the staging table name from staging_metadata
        db.get(
          `SELECT staging_table_name FROM staging_metadata WHERE file_id = ?`,
          [fileId],
          (metaErr, metaResult) => {
            if (metaErr) {
              db.close()
              return res.status(500).json({ error: 'Failed to find staging table: ' + metaErr.message })
            }

            if (!metaResult) {
              db.close()
              return res.status(400).json({ error: 'No staging table found for this file' })
            }

            const tableName = metaResult.staging_table_name
            console.log('[Location Ingestion] Using staging table:', tableName)

            // Validate table name format for security
            if (!/^staging_location(_\d+)?$/.test(tableName)) {
              db.close()
              return res.status(400).json({ error: 'Invalid staging table name format' })
            }

            // Clear existing locations for this file (using identifier_column from mapping)
            // Note: We can't use file_id in the staging table anymore since new tables don't have it
            // Instead, we'll clear locations that match this batch and re-insert them
            const identifierCol = mapping.identifier_column

            // Get all staging data first to know what location_codes to delete
            db.all(
              `SELECT ${security.quoteIdentifier(identifierCol)} as identifier FROM ${security.quoteIdentifier(tableName)}`,
              [],
              (preErr, preRows) => {
                if (preErr) {
                  db.close()
                  return res.status(500).json({ error: 'Failed to fetch identifiers: ' + preErr.message })
                }

                const locationCodes = preRows.map(r => 'LOC_' + r.identifier)

                // Delete old locations with these codes
                if (locationCodes.length > 0) {
                  const placeholders = locationCodes.map(() => '?').join(',')
                  db.run(
                    `DELETE FROM location WHERE location_code IN (${placeholders})`,
                    locationCodes,
                    (delErr) => {
                      if (delErr) {
                        console.error('[Location Ingestion] Error deleting old locations:', delErr)
                      }

                      // Get all rows from the staging table
                      db.all(
                        `SELECT * FROM ${security.quoteIdentifier(tableName)}`,
                        [],
                        (err, rows) => {
                          if (err) {
                            db.close()
                            return res.status(500).json({ error: 'Failed to fetch staging data: ' + err.message })
                          }

                          if (!rows || rows.length === 0) {
                            db.close()
                            return res.status(400).json({ error: 'No staging data found' })
                          }

                          console.log(`[Location Ingestion] Processing ${rows.length} locations`)

                          let inserted = 0
                          let errors = 0

                          // Process each row
                          const insertPromises = rows.map((row, index) => {
                            return new Promise((resolve) => {
                              // Get entity_id from the entity column
                              const entityValue = row[mapping.entity_column]
                              const entity_id = entityMap[entityValue]

                              if (!entity_id) {
                                console.warn(`[Location Ingestion] No entity mapping for value: ${entityValue}`)
                              }

                              // Build location_code with LOC_ prefix
                              const location_code = 'LOC_' + row[mapping.identifier_column]
                              const latitude = parseFloat(row[mapping.latitude_column])
                              const longitude = parseFloat(row[mapping.longitude_column])
                              const archetype = row[mapping.archetype_column] || 'Standard'

                              db.run(
                                `INSERT INTO location (location_code, latitude, longitude, entity_id, archetype, json_values)
                                 VALUES (?, ?, ?, ?, ?, ?)`,
                                [location_code, latitude, longitude, entity_id, archetype, '{}'],
                                function(insertErr) {
                                  if (insertErr) {
                                    console.error(`[Location Ingestion] Error inserting location ${location_code}:`, insertErr.message)
                                    errors++
                                  } else {
                                    inserted++
                                  }
                                  resolve()
                                }
                              )
                            })
                          })

                          Promise.all(insertPromises).then(() => {
                            db.close()
                            console.log(`[Location Ingestion] Complete: ${inserted} inserted, ${errors} errors`)
                            res.json({
                              success: true,
                              inserted,
                              errors,
                              message: `Ingested ${inserted} locations from staging`
                            })
                          })
                        }
                      )
                    }
                  )
                } else {
                  db.close()
                  res.status(400).json({ error: 'No locations found in staging table' })
                }
              }
            )
          }
        )
      }
    )
  } catch (error) {
    console.error('Location ingestion error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get saved location mapping configuration
 * GET /api/locations/get-location-mapping
 * Query params: dbPath, fileId
 */
app.get('/api/locations/get-location-mapping', (req, res) => {
  try {
    const { dbPath, fileId } = req.query

    if (!dbPath || !fileId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.get(
      `SELECT * FROM location_mapping_config WHERE file_id = ?`,
      [fileId],
      (err, row) => {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch mapping: ' + err.message })
        }

        if (!row) {
          return res.json({ success: false, message: 'No mapping found' })
        }

        // Parse JSON fields
        console.log('=== GET LOCATION MAPPING DEBUG ===')
        console.log('Raw row from DB:', row)
        console.log('value_columns field:', row.value_columns)

        const mapping = {
          identifierColumn: row.identifier_column,
          latitudeColumn: row.latitude_column,
          longitudeColumn: row.longitude_column,
          entityColumn: row.entity_column,
          archetypeColumn: row.archetype_column,
          unitColumn: row.unit_column,
          valueColumns: row.value_columns ? JSON.parse(row.value_columns) : [],
          entityMappings: row.entity_mappings ? JSON.parse(row.entity_mappings) : []
        }

        console.log('Parsed mapping.valueColumns:', mapping.valueColumns)
        res.json({ success: true, mapping })
      }
    )
  } catch (error) {
    console.error('Get location mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Load multiple damage curve CSV files into staged_file table (batch mode)
 * POST /api/damage-curves/load-batch
 * Body: dbPath
 * Files: Multiple CSV files
 */
app.post('/api/damage-curves/load-batch', upload.array('files'), async (req, res) => {
  console.log('Received batch damage curve upload request:', {
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
          csvContent: fileContent,
          rowCount: records.length
        })
      } catch (error) {
        files.forEach(f => fs.unlinkSync(f.path))
        return res.status(400).json({ error: `Failed to parse ${files[i].originalname}: ${error.message}` })
      }
    }

    db.serialize(() => {
      let fileIdx = 0
      const insertNextFile = () => {
        if (fileIdx >= filesData.length) {
          // All done
          db.close()
          files.forEach(f => fs.unlinkSync(f.path))
          return res.json({
            success: true,
            message: `Successfully loaded ${files.length} damage curve file(s) into staging area.`,
            fileCount: files.length
          })
        }

        const fileData = filesData[fileIdx]

        // Insert into staged_file with CSV content
        db.run(
          `INSERT INTO staged_file (file_name, file_type, row_count, csv_content) VALUES (?, 'damage_curve', ?, ?)`,
          [fileData.fileName, fileData.rowCount, fileData.csvContent],
          function(err) {
            if (err) {
              console.error('Failed to create staged_file entry:', err)
              db.close()
              files.forEach(f => fs.unlinkSync(f.path))
              return res.status(500).json({ error: 'Failed to record staged file: ' + err.message })
            }

            fileIdx++
            insertNextFile()
          }
        )
      }

      insertNextFile()
    })

  } catch (error) {
    console.error('Import error:', error)
    if (req.files) {
      req.files.forEach(f => fs.unlinkSync(f.path))
    }
    res.status(500).json({ error: error.message })
  }
})

/**
 * Load damage curve CSV into unique staging table
 * POST /api/damage-curves/load
 * Body: dbPath
 * File: CSV file
 * Refactored to use StagingService for unified staging architecture
 */
app.post('/api/damage-curves/load', upload.single('file'), async (req, res) => {
  console.log('Received damage curve upload request')

  let db
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

    // Get columns from first record
    const columns = Object.keys(records[0])

    // Connect to database
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    // 1. Insert into staged_file table
    const fileResult = await stagingService.dbRun(`
      INSERT INTO staged_file (file_name, file_type, row_count, csv_content)
      VALUES (?, ?, ?, ?)
    `, [file.originalname, 'damage_curve', records.length, fileContent])

    const fileId = fileResult.lastID

    // 2. Create staging table with metadata tracking
    const { stagingId, tableName } = await stagingService.createStagingTable(
      'damage_curve',
      fileId,
      file.originalname,
      columns
    )

    // 3. Insert data into staging table
    const placeholders = columns.map(() => '?').join(', ')
    const columnNames = columns.map(c => security.quoteIdentifier(c)).join(', ')
    const insertSql = `INSERT INTO ${security.quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`

    const stmt = db.prepare(insertSql)
    for (const record of records) {
      const values = columns.map(col => record[col])
      await new Promise((resolve, reject) => {
        stmt.run(values, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    await new Promise((resolve, reject) => {
      stmt.finalize((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 4. Update row count and status in staging metadata
    await stagingService.updateRowCount(stagingId, records.length)
    await stagingService.updateStatus(stagingId, 'pending')

    // Cleanup
    db.close()
    fs.unlinkSync(file.path)

    res.json({
      success: true,
      message: `Successfully loaded ${records.length} damage curve records into staging area.`,
      rowCount: records.length,
      tableName: tableName,
      stagingId: stagingId,
      fileId: fileId,
      columns: columns
    })

  } catch (error) {
    console.error('Load damage curve error:', error)
    if (db) db.close()
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get damage curve staging data preview
 * GET /api/damage-curves/staging-preview
 * Query params: dbPath, fileId, limit (optional)
 * Refactored to use dynamic staging table names from staging_metadata
 */
app.get('/api/damage-curves/staging-preview', (req, res) => {
  try {
    const { dbPath, fileId, limit = 100 } = req.query

    if (!dbPath || !fileId) {
      return res.status(400).json({ error: 'Missing required fields (dbPath, fileId)' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Get the staging table name from staging_metadata
    db.get(
      `SELECT staging_table_name FROM staging_metadata WHERE file_id = ?`,
      [fileId],
      (metaErr, metaResult) => {
        if (metaErr) {
          db.close()
          return res.status(500).json({ error: 'Failed to find staging table: ' + metaErr.message })
        }

        if (!metaResult) {
          db.close()
          return res.status(400).json({ error: 'No staging table found for this file' })
        }

        const tableName = metaResult.staging_table_name

        // Validate table name format for security
        if (!/^staging_damage_curve(_\d+)?$/.test(tableName)) {
          db.close()
          return res.status(400).json({ error: 'Invalid staging table name format' })
        }

        // Query the dynamic staging table
        db.all(
          `SELECT * FROM ${security.quoteIdentifier(tableName)} LIMIT ?`,
          [limit],
          (err, rows) => {
            db.close()
            if (err) {
              return res.status(500).json({ error: 'Failed to fetch staging data: ' + err.message })
            }
            res.json({ success: true, data: rows })
          }
        )
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
 * Get damage curve staging tables/files
 * GET /api/damage-curves/staging-tables
 * Query: { dbPath }
 */
app.get('/api/damage-curves/staging-tables', (req, res) => {
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

    // Get staged files of type 'damage_curve'
    db.all(
      `SELECT file_id, file_name, row_count, uploaded_at
       FROM staged_file
       WHERE file_type = 'damage_curve'
       ORDER BY uploaded_at DESC`,
      [],
      (err, files) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to query staged files: ' + err.message })
        }

        // Transform into table info format
        const tables = files.map(file => ({
          tableName: `staged_damage_curve_${file.file_id}`,
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
 * Get available perils from database
 * GET /api/perils
 * Query: { dbPath }
 */
app.get('/api/perils', (req, res) => {
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

    // Get physical risk drivers from driver table
    db.all(
      `SELECT driver_id, code, name, description
       FROM driver
       WHERE category = 'physical' AND is_active = 1
       ORDER BY code`,
      [],
      (err, drivers) => {
        db.close()

        if (err) {
          console.error('Error fetching physical risk drivers:', err)
          return res.status(500).json({ error: 'Failed to fetch physical risk drivers: ' + err.message })
        }

        if (!drivers || drivers.length === 0) {
          // If no physical risk drivers are defined, return empty array
          return res.json([])
        }

        // Convert drivers to peril format expected by frontend
        const perils = drivers.map((d) => ({
          peril_id: d.driver_id,
          peril_type: d.code,
          peril_code: d.code,
          description: d.description || d.name
        }))

        res.json(perils)
      }
    )
  } catch (error) {
    console.error('Get perils error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Save damage curve mapping configuration
 * POST /api/damage-curves/save-damage-curve-mapping
 * Body: { dbPath, fileId, inputColumn, outputColumn, archetypeColumn, perilColumn, unitColumn, valueTypeColumn, perilMappings }
 */
app.post('/api/damage-curves/save-damage-curve-mapping', express.json(), (req, res) => {
  try {
    const { dbPath, fileId, inputColumn, outputColumn, archetypeColumn, perilColumn, unitColumn, valueTypeColumn, driverMappings } = req.body

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId) {
      return res.status(400).json({ error: 'Missing required fileId' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const columnMapping = JSON.stringify({
      inputColumn,
      outputColumn,
      archetypeColumn,
      perilColumn,
      unitColumn,
      valueTypeColumn
    })

    // New format: { "FLOOD": [{peril_type: "FLOOD", value_type: "PPE"}, ...], "STORM": [...] }
    const perilDriverMapping = JSON.stringify(driverMappings || {})

    // First check if mapping exists for this file_id
    db.get(
      `SELECT mapping_id FROM damage_curve_mapping WHERE file_id = ?`,
      [fileId],
      (err, row) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to check existing mapping: ' + err.message })
        }

        if (row) {
          // Update existing mapping
          db.run(
            `UPDATE damage_curve_mapping
             SET column_mapping = ?, peril_driver_mapping = ?, created_at = datetime('now')
             WHERE file_id = ?`,
            [columnMapping, perilDriverMapping, fileId],
            function(err) {
              db.close()

              if (err) {
                return res.status(500).json({ error: 'Failed to update damage curve mapping: ' + err.message })
              }

              res.json({
                success: true,
                message: `Damage curve mapping updated for file ${fileId}`,
                mappingId: row.mapping_id
              })
            }
          )
        } else {
          // Insert new mapping
          db.run(
            `INSERT INTO damage_curve_mapping (file_id, column_mapping, peril_driver_mapping, created_at)
             VALUES (?, ?, ?, datetime('now'))`,
            [fileId, columnMapping, perilDriverMapping],
            function(err) {
              db.close()

              if (err) {
                return res.status(500).json({ error: 'Failed to insert damage curve mapping: ' + err.message })
              }

              res.json({
                success: true,
                message: `Damage curve mapping saved for file ${fileId}`,
                mappingId: this.lastID
              })
            }
          )
        }
      }
    )
  } catch (error) {
    console.error('Save damage curve mapping error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Ingest damage curves from staged CSV into production damage_curve table
 * POST /api/damage-curves/ingest
 * Body: { dbPath, fileId }
 */
app.post('/api/damage-curves/ingest', async (req, res) => {
  try {
    const { dbPath, fileId } = req.body

    if (!dbPath || !fileId) {
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

    // Get the mapping configuration and CSV data
    db.get(
      `SELECT dcm.*, sf.csv_content
       FROM damage_curve_mapping dcm
       JOIN staged_file sf ON sf.file_id = dcm.file_id
       WHERE dcm.file_id = ?`,
      [fileId],
      (err, mapping) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to fetch mapping: ' + err.message })
        }

        if (!mapping) {
          db.close()
          return res.status(400).json({ error: 'No mapping configuration found for this file' })
        }

        console.log('[Damage Curve Ingestion] Starting ingestion for file_id:', fileId)

        // Parse the column mapping
        const columnMapping = JSON.parse(mapping.column_mapping || '{}')
        const { inputColumn, outputColumn, archetypeColumn, perilColumn, unitColumn, valueTypeColumn } = columnMapping

        if (!inputColumn || !outputColumn || !perilColumn) {
          db.close()
          return res.status(400).json({ error: 'Missing required column mappings' })
        }

        // Parse CSV content
        const lines = mapping.csv_content.trim().split('\n')
        const headers = lines[0].split(',')

        // Find column indices
        const inputIdx = headers.indexOf(inputColumn)
        const outputIdx = headers.indexOf(outputColumn)
        const archetypeIdx = archetypeColumn ? headers.indexOf(archetypeColumn) : -1
        const perilIdx = headers.indexOf(perilColumn)
        const unitIdx = unitColumn ? headers.indexOf(unitColumn) : -1
        const valueTypeIdx = valueTypeColumn ? headers.indexOf(valueTypeColumn) : -1

        // Group rows by (peril, archetype, value_type)
        const curves = {}

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',')

          const peril = row[perilIdx]
          const archetype = archetypeIdx >= 0 ? row[archetypeIdx] : 'Standard'
          const valueType = valueTypeIdx >= 0 ? row[valueTypeIdx] : 'PPE'
          const intensity = parseFloat(row[inputIdx])
          const damageFactor = parseFloat(row[outputIdx])
          const unit = unitIdx >= 0 ? row[unitIdx] : 'meters'

          const key = `${peril}|${archetype}|${valueType}`

          if (!curves[key]) {
            curves[key] = {
              peril_type: peril,
              archetype: archetype,
              value_type: valueType,
              intensity_unit: unit,
              points: []
            }
          }

          curves[key].points.push([intensity, damageFactor])
        }

        console.log(`[Damage Curve Ingestion] Parsed ${Object.keys(curves).length} unique curves`)

        // Delete existing curves for this file
        db.run(
          `DELETE FROM damage_curve WHERE curve_code LIKE 'DC_' || ? || '_%'`,
          [fileId],
          (delErr) => {
            if (delErr) {
              console.error('[Damage Curve Ingestion] Error deleting old curves:', delErr)
            }

            // Insert each curve
            let inserted = 0
            let errors = 0
            const insertPromises = []

            for (const [key, curve] of Object.entries(curves)) {
              // Sort points by intensity
              curve.points.sort((a, b) => a[0] - b[0])

              const curveCode = `DC_${fileId}_${curve.peril_type}_${curve.archetype}_${curve.value_type}`
              const curvePointsJSON = JSON.stringify(curve.points)

              insertPromises.push(
                new Promise((resolve) => {
                  db.run(
                    `INSERT INTO damage_curve
                     (curve_code, peril_type, archetype, value_type, curve_points, intensity_unit)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [curveCode, curve.peril_type, curve.archetype, curve.value_type, curvePointsJSON, curve.intensity_unit],
                    function(insertErr) {
                      if (insertErr) {
                        console.error(`[Damage Curve Ingestion] Error inserting curve ${curveCode}:`, insertErr.message)
                        errors++
                      } else {
                        inserted++
                      }
                      resolve()
                    }
                  )
                })
              )
            }

            Promise.all(insertPromises).then(() => {
              db.close()
              console.log(`[Damage Curve Ingestion] Complete: ${inserted} inserted, ${errors} errors`)
              res.json({
                success: true,
                inserted,
                errors,
                message: `Ingested ${inserted} damage curves`
              })
            })
          }
        )
      }
    )
  } catch (error) {
    console.error('Damage curve ingestion error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get damage curve mapping configuration
 * GET /api/damage-curves/get-damage-curve-mapping
 * Query: { dbPath, fileId }
 */
app.get('/api/damage-curves/get-damage-curve-mapping', (req, res) => {
  try {
    const { dbPath, fileId } = req.query

    if (!dbPath || !fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Invalid database path' })
    }

    if (!fileId) {
      return res.status(400).json({ error: 'Missing required fileId' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    db.get(
      `SELECT column_mapping, peril_driver_mapping
       FROM damage_curve_mapping
       WHERE file_id = ?`,
      [fileId],
      (err, row) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to query mapping: ' + err.message })
        }

        if (!row) {
          return res.json({ success: true, mapping: null })
        }

        const columnMapping = JSON.parse(row.column_mapping)
        const perilMappings = JSON.parse(row.peril_driver_mapping || '[]')

        res.json({
          success: true,
          mapping: {
            inputColumn: columnMapping.inputColumn,
            outputColumn: columnMapping.outputColumn,
            archetypeColumn: columnMapping.archetypeColumn,
            perilColumn: columnMapping.perilColumn,
            unitColumn: columnMapping.unitColumn,
            valueTypeColumn: columnMapping.valueTypeColumn,
            driverMappings: perilMappings
          }
        })
      }
    )
  } catch (error) {
    console.error('Get damage curve mapping error:', error)
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
    const { dbPath, fileId, driverColumn, valueColumns, variableMappings, templateCode } = req.body

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

    // If templateCode not provided, fetch the active template
    const resolveTemplateCode = (callback) => {
      if (templateCode) {
        callback(null, templateCode)
      } else {
        db.get(
          'SELECT code FROM statement_template WHERE is_active = 1 LIMIT 1',
          [],
          (err, row) => {
            if (err) {
              callback(err)
            } else {
              callback(null, row?.code || null)
            }
          }
        )
      }
    }

    resolveTemplateCode((err, finalTemplateCode) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to resolve template: ' + err.message })
      }

      db.run(
        `INSERT INTO scenario_mapping (file_id, driver_column, value_columns, variable_mappings, template_code)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(file_id) DO UPDATE SET
           driver_column = excluded.driver_column,
           value_columns = excluded.value_columns,
           variable_mappings = excluded.variable_mappings,
           template_code = excluded.template_code,
           last_updated = datetime('now')`,
        [fileId, driverColumn, valueColumnsJson, variableMappingsJson, finalTemplateCode],
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
    })
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
 * Get all validation rules
 * GET /api/validation-rules?dbPath=...
 */
app.get('/api/validation-rules', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error('Error opening database:', err)
      return res.status(500).json({ error: 'Failed to open database' })
    }
  })

  db.all(
    'SELECT * FROM validation_rule ORDER BY rule_code',
    [],
    (err, rows) => {
      db.close()
      if (err) {
        console.error('Error fetching validation rules:', err)
        return res.status(500).json({ error: 'Failed to fetch validation rules' })
      }

      const rules = rows.map(row => ({
        rule_id: row.rule_id,
        rule_code: row.rule_code,
        rule_name: row.rule_name,
        rule_type: row.rule_type,
        description: row.description,
        formula: row.formula,
        required_line_items: row.required_line_items ? JSON.parse(row.required_line_items) : [],
        tolerance: row.tolerance,
        severity: row.severity,
        is_active: row.is_active === 1
      }))

      res.json(rules)
    }
  )
})

/**
 * Create a new validation rule
 * POST /api/validation-rules
 * Body: { dbPath, rule_code, rule_name, rule_type, description, formula, tolerance, severity, is_active }
 */
app.post('/api/validation-rules', (req, res) => {
  const { dbPath, rule_code, rule_name, rule_type, description, formula, tolerance, severity, is_active } = req.body

  if (!dbPath || !rule_code || !rule_name || !formula) {
    return res.status(400).json({ error: 'dbPath, rule_code, rule_name, and formula are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error('Error opening database:', err)
      return res.status(500).json({ error: 'Failed to open database' })
    }
  })

  db.run(
    `INSERT INTO validation_rule (rule_code, rule_name, rule_type, description, formula, tolerance, severity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rule_code, rule_name, rule_type, description || '', formula, tolerance || 0.01, severity || 'error', is_active ? 1 : 0],
    function(err) {
      db.close()
      if (err) {
        console.error('Error creating validation rule:', err)
        return res.status(500).json({ error: 'Failed to create validation rule' })
      }

      res.json({ success: true, rule_id: this.lastID })
    }
  )
})

/**
 * Update a validation rule
 * PUT /api/validation-rules/:ruleId
 * Body: { dbPath, rule_code, rule_name, rule_type, description, formula, tolerance, severity, is_active }
 */
app.put('/api/validation-rules/:ruleId', (req, res) => {
  const { ruleId } = req.params
  const { dbPath, rule_code, rule_name, rule_type, description, formula, tolerance, severity, is_active } = req.body

  if (!dbPath || !rule_code || !rule_name || !formula) {
    return res.status(400).json({ error: 'dbPath, rule_code, rule_name, and formula are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error('Error opening database:', err)
      return res.status(500).json({ error: 'Failed to open database' })
    }
  })

  db.run(
    `UPDATE validation_rule
     SET rule_code = ?, rule_name = ?, rule_type = ?, description = ?, formula = ?,
         tolerance = ?, severity = ?, is_active = ?
     WHERE rule_id = ?`,
    [rule_code, rule_name, rule_type, description || '', formula, tolerance || 0.01, severity || 'error', is_active ? 1 : 0, ruleId],
    (err) => {
      db.close()
      if (err) {
        console.error('Error updating validation rule:', err)
        return res.status(500).json({ error: 'Failed to update validation rule' })
      }

      res.json({ success: true })
    }
  )
})

/**
 * Load hazard map CSV into unique staging table
 * POST /api/hazard-maps/load
 * Body: dbPath
 * File: CSV file
 * Refactored to use StagingService for unified staging architecture
 */
app.post('/api/hazard-maps/load', upload.single('file'), async (req, res) => {
  console.log('Received hazard map upload request')

  let db
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

    // Get columns and sanitize
    const columns = Object.keys(records[0])
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

    // Connect to database
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    // 1. Insert into staged_file table
    const fileResult = await stagingService.dbRun(`
      INSERT INTO staged_file (file_name, file_type, row_count, csv_content)
      VALUES (?, ?, ?, ?)
    `, [file.originalname, 'hazard_map', records.length, fileContent])

    const fileId = fileResult.lastID

    // 2. Create staging table with metadata tracking
    const { stagingId, tableName } = await stagingService.createStagingTable(
      'hazard_map',
      fileId,
      file.originalname,
      sanitizedColumns
    )

    // 3. Insert data into staging table
    const placeholders = sanitizedColumns.map(() => '?').join(', ')
    const columnNames = sanitizedColumns.map(c => security.quoteIdentifier(c)).join(', ')
    const insertSql = `INSERT INTO ${security.quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`

    const stmt = db.prepare(insertSql)
    for (const record of records) {
      const values = columns.map(col => record[col])
      await new Promise((resolve, reject) => {
        stmt.run(values, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

    await new Promise((resolve, reject) => {
      stmt.finalize((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // 4. Update row count and status in staging metadata
    await stagingService.updateRowCount(stagingId, records.length)
    await stagingService.updateStatus(stagingId, 'pending')

    // Cleanup
    db.close()
    fs.unlinkSync(file.path)

    console.log(`Successfully imported ${records.length} hazard map records`)
    res.json({
      success: true,
      message: `Successfully imported ${records.length} records`,
      rowCount: records.length,
      tableName: tableName,
      stagingId: stagingId,
      fileId: fileId
    })

  } catch (error) {
    console.error('Hazard map import error:', error)
    if (db) db.close()
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get all scenarios
 * GET /api/scenarios/list
 */
app.get('/api/scenarios/list', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Get scenarios and extract file_id from code (format: SCENARIO_X_FILEY)
  db.all('SELECT scenario_id, code, name, description FROM scenario ORDER BY name', [], (err, rows) => {
    if (err) {
      db.close()
      return res.status(500).json({ error: 'Failed to fetch scenarios: ' + err.message })
    }

    // Parse codes to extract file IDs and fetch file names
    const fileIds = new Set()
    rows.forEach(row => {
      const match = row.code.match(/FILE(\d+)/i)
      if (match) {
        fileIds.add(parseInt(match[1]))
      }
    })

    if (fileIds.size === 0) {
      db.close()
      return res.json({ success: true, scenarios: rows })
    }

    // Fetch file names for the extracted file IDs
    const placeholders = Array.from(fileIds).map(() => '?').join(',')
    db.all(
      `SELECT file_id, file_name FROM staged_file WHERE file_id IN (${placeholders})`,
      Array.from(fileIds),
      (err, files) => {
        db.close()
        if (err) {
          console.error('Error fetching file names:', err)
          return res.json({ success: true, scenarios: rows })
        }

        // Create a map of file_id -> file_name
        const fileMap = {}
        files.forEach(f => {
          fileMap[f.file_id] = f.file_name
        })

        // Add file info to scenarios
        const enrichedScenarios = rows.map(row => {
          const match = row.code.match(/SCENARIO_(\d+)_FILE(\d+)/i)
          if (match) {
            const scenarioNum = match[1]
            const fileId = parseInt(match[2])
            return {
              ...row,
              scenario_number: scenarioNum,
              source_file_id: fileId,
              source_file_name: fileMap[fileId] || 'unknown'
            }
          }
          return row
        })

        res.json({ success: true, scenarios: enrichedScenarios })
      }
    )
  })
})

/**
 * Get all management actions
 * GET /api/management-actions
 */
app.get('/api/management-actions', (req, res) => {
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT action_id, action_code, action_name, action_category, description,
            is_active, is_mac_relevant, created_at
     FROM management_action
     ORDER BY action_category, action_name`,
    [],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch actions: ' + err.message })
      }
      res.json(rows)
    }
  )
})

/**
 * Get a single management action with its scenario assignments
 * GET /api/management-actions/:actionCode
 */
app.get('/api/management-actions/:actionCode', (req, res) => {
  const { actionCode } = req.params
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Get action details
  db.get(
    `SELECT * FROM management_action WHERE action_code = ?`,
    [actionCode],
    (err, action) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to fetch action: ' + err.message })
      }

      if (!action) {
        db.close()
        return res.status(404).json({ error: 'Action not found' })
      }

      // Get scenario assignments for this action
      db.all(
        `SELECT * FROM scenario_action WHERE action_code = ?`,
        [actionCode],
        (err, scenarios) => {
          db.close()
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch scenario assignments: ' + err.message })
          }

          // Parse JSON transformations
          const scenariosWithParsedJson = scenarios.map(s => ({
            ...s,
            financial_transformations: s.financial_transformations ? JSON.parse(s.financial_transformations) : [],
            carbon_transformations: s.carbon_transformations ? JSON.parse(s.carbon_transformations) : []
          }))

          res.json({
            ...action,
            scenario_assignments: scenariosWithParsedJson
          })
        }
      )
    }
  )
})

/**
 * Create a new management action
 * POST /api/management-actions
 */
app.post('/api/management-actions', (req, res) => {
  const { dbPath, action_code, action_name, action_category, description, is_active, is_mac_relevant } = req.body

  if (!dbPath || !action_code || !action_name || !action_category) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.run(
    `INSERT INTO management_action (action_code, action_name, action_category, description, is_active, is_mac_relevant)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [action_code, action_name, action_category, description || '', is_active ? 1 : 0, is_mac_relevant ? 1 : 0],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to create action: ' + err.message })
      }
      res.json({ success: true, action_id: this.lastID })
    }
  )
})

/**
 * Update a management action
 * PUT /api/management-actions/:actionCode
 */
app.put('/api/management-actions/:actionCode', (req, res) => {
  const { actionCode } = req.params
  const { dbPath, action_name, action_category, description, is_active, is_mac_relevant } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.run(
    `UPDATE management_action
     SET action_name = ?, action_category = ?, description = ?, is_active = ?, is_mac_relevant = ?
     WHERE action_code = ?`,
    [action_name, action_category, description, is_active ? 1 : 0, is_mac_relevant ? 1 : 0, actionCode],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to update action: ' + err.message })
      }
      res.json({ success: true, changes: this.changes })
    }
  )
})

/**
 * Delete a management action
 * DELETE /api/management-actions/:actionCode
 */
app.delete('/api/management-actions/:actionCode', (req, res) => {
  const { actionCode } = req.params
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // First delete all scenario_action assignments
  db.run(
    `DELETE FROM scenario_action WHERE action_code = ?`,
    [actionCode],
    (err) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to delete scenario assignments: ' + err.message })
      }

      // Then delete the management_action
      db.run(
        `DELETE FROM management_action WHERE action_code = ?`,
        [actionCode],
        function(err) {
          db.close()
          if (err) {
            return res.status(500).json({ error: 'Failed to delete action: ' + err.message })
          }
          res.json({ success: true, changes: this.changes })
        }
      )
    }
  )
})

/**
 * Save or update scenario action assignment
 * POST /api/scenario-actions
 */
app.post('/api/scenario-actions', (req, res) => {
  const {
    dbPath,
    scenario_id,
    action_code,
    entity_id,
    start_period,
    end_period,
    capex,
    opex_annual,
    emission_reduction_annual,
    financial_transformations,
    carbon_transformations,
    notes,
    trigger_type,
    trigger_condition,
    trigger_period,
    trigger_sticky
  } = req.body

  if (!dbPath || !scenario_id || !action_code) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Convert transformation arrays to JSON strings
  const financialJson = financial_transformations ? JSON.stringify(financial_transformations) : null
  const carbonJson = carbon_transformations ? JSON.stringify(carbon_transformations) : null

  db.run(
    `INSERT INTO scenario_action
     (scenario_id, action_code, entity_id, start_period, end_period, capex, opex_annual,
      emission_reduction_annual, financial_transformations, carbon_transformations, notes,
      trigger_type, trigger_condition, trigger_period, trigger_sticky)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scenario_id, action_code, entity_id || null, start_period, end_period, capex || 0, opex_annual || 0,
      emission_reduction_annual || 0, financialJson, carbonJson, notes || '',
      trigger_type || 'UNCONDITIONAL', trigger_condition, trigger_period, trigger_sticky ? 1 : 0
    ],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to save scenario action: ' + err.message })
      }
      res.json({ success: true, scenario_action_id: this.lastID })
    }
  )
})

/**
 * Get action-entity associations for an action
 * GET /api/action-entities?dbPath=...&action_code=...
 */
app.get('/api/action-entities', (req, res) => {
  const { dbPath, action_code } = req.query

  if (!dbPath || !action_code) {
    return res.status(400).json({ error: 'Missing required query parameters: dbPath, action_code' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT action_entity_id, action_code, entity_id, created_at
     FROM action_entity
     WHERE action_code = ?
     ORDER BY entity_id`,
    [action_code],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch action entities: ' + err.message })
      }
      res.json(rows || [])
    }
  )
})

/**
 * Create action-entity association
 * POST /api/action-entities
 */
app.post('/api/action-entities', express.json(), (req, res) => {
  const { dbPath, action_code, entity_id } = req.body

  if (!dbPath || !action_code || !entity_id) {
    return res.status(400).json({ error: 'Missing required fields: dbPath, action_code, entity_id' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.run(
    `INSERT INTO action_entity (action_code, entity_id) VALUES (?, ?)`,
    [action_code, entity_id],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to create action-entity association: ' + err.message })
      }
      res.json({ success: true, action_entity_id: this.lastID })
    }
  )
})

/**
 * Delete action-entity association
 * DELETE /api/action-entities
 */
app.delete('/api/action-entities', express.json(), (req, res) => {
  const { dbPath, action_code, entity_id } = req.body

  if (!dbPath || !action_code || !entity_id) {
    return res.status(400).json({ error: 'Missing required fields: dbPath, action_code, entity_id' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.run(
    `DELETE FROM action_entity WHERE action_code = ? AND entity_id = ?`,
    [action_code, entity_id],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to delete action-entity association: ' + err.message })
      }
      res.json({ success: true, deleted_count: this.changes })
    }
  )
})

/**
 * Get scenario actions for an action code and scenario
 * GET /api/scenario-actions?dbPath=...&action_code=...&scenario_id=...
 */
app.get('/api/scenario-actions', (req, res) => {
  const { dbPath, action_code, scenario_id } = req.query

  if (!dbPath || !action_code || !scenario_id) {
    return res.status(400).json({ error: 'Missing required query parameters: dbPath, action_code, scenario_id' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT scenario_action_id, scenario_id, action_code, entity_id, start_period, end_period,
            capex, opex_annual, emission_reduction_annual, notes, created_at,
            trigger_type, trigger_condition, trigger_period, trigger_sticky
     FROM scenario_action
     WHERE action_code = ? AND scenario_id = ?
     ORDER BY entity_id`,
    [action_code, scenario_id],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch scenario actions: ' + err.message })
      }
      res.json(rows || [])
    }
  )
})

/**
 * Delete a scenario action by scenario_action_id
 * DELETE /api/scenario-actions/:id
 */
app.delete('/api/scenario-actions/:id', express.json(), (req, res) => {
  const { id } = req.params
  const { dbPath } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath in request body' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.run(
    `DELETE FROM scenario_action WHERE scenario_action_id = ?`,
    [id],
    function(err) {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to delete scenario action: ' + err.message })
      }
      res.json({ success: true, deleted_count: this.changes })
    }
  )
})

/**
 * Export management action to JSON file
 * GET /api/management-actions/:actionCode/export
 */
app.get('/api/management-actions/:actionCode/export', (req, res) => {
  const { actionCode } = req.params
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.get(
    `SELECT * FROM management_action WHERE action_code = ?`,
    [actionCode],
    (err, action) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to fetch action: ' + err.message })
      }

      if (!action) {
        return res.status(404).json({ error: 'Action not found' })
      }

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${actionCode}.json"`)
      res.json(action)
    }
  )
})

/**
 * Import management action from JSON file
 * POST /api/management-actions/import
 */
app.post('/api/management-actions/import', upload.single('file'), async (req, res) => {
  try {
    const { dbPath } = req.body
    const file = req.file

    if (!file || !dbPath) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const fileContent = fs.readFileSync(file.path, 'utf-8')
    const actionData = JSON.parse(fileContent)

    // Clean up uploaded file
    fs.unlinkSync(file.path)

    if (!actionData.action_code || !actionData.action_name || !actionData.action_category) {
      return res.status(400).json({ error: 'Invalid action JSON: missing required fields' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Use INSERT OR REPLACE to handle both new and existing actions
    db.run(
      `INSERT OR REPLACE INTO management_action
       (action_code, action_name, action_category, description, is_active, is_mac_relevant)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        actionData.action_code,
        actionData.action_name,
        actionData.action_category,
        actionData.description || '',
        actionData.is_active !== undefined ? actionData.is_active : 1,
        actionData.is_mac_relevant !== undefined ? actionData.is_mac_relevant : 0
      ],
      function(err) {
        db.close()
        if (err) {
          return res.status(500).json({ error: 'Failed to import action: ' + err.message })
        }
        res.json({
          success: true,
          action_code: actionData.action_code,
          message: 'Action imported successfully'
        })
      }
    )
  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get transformations for a management action
 * GET /api/action-transformations?action_code=xxx&db_path=xxx
 */
app.get('/api/action-transformations', (req, res) => {
  const { action_code, db_path } = req.query

  if (!action_code || !db_path) {
    return res.status(400).json({ error: 'action_code and db_path are required' })
  }

  const db = new sqlite3.Database(db_path, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT transformation_id, action_code, line_item, type, new_formula, comment, created_at
     FROM action_transformation
     WHERE action_code = ?
     ORDER BY transformation_id`,
    [action_code],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch transformations: ' + err.message })
      }
      res.json(rows)
    }
  )
})

/**
 * Save transformations for a management action
 * POST /api/action-transformations/save
 */
app.post('/api/action-transformations/save', (req, res) => {
  const { dbPath, action_code, transformations } = req.body

  if (!dbPath || !action_code) {
    return res.status(400).json({ error: 'dbPath and action_code are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.serialize(() => {
    // Delete existing transformations
    db.run('DELETE FROM action_transformation WHERE action_code = ?', [action_code], (err) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to delete old transformations: ' + err.message })
      }

      // Insert new transformations
      if (transformations && transformations.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO action_transformation (action_code, line_item, type, new_formula, comment)
          VALUES (?, ?, ?, ?, ?)
        `)

        for (const t of transformations) {
          stmt.run([action_code, t.line_item, t.type, t.new_formula, t.comment || null])
        }

        stmt.finalize((err) => {
          db.close()
          if (err) {
            return res.status(500).json({ error: 'Failed to save transformations: ' + err.message })
          }
          res.json({ success: true })
        })
      } else {
        db.close()
        res.json({ success: true })
      }
    })
  })
})

/**
 * Get triggers for a management action
 * GET /api/action-triggers?action_code=xxx&db_path=xxx
 */
app.get('/api/action-triggers', (req, res) => {
  const { action_code, db_path } = req.query

  if (!action_code || !db_path) {
    return res.status(400).json({ error: 'action_code and db_path are required' })
  }

  const db = new sqlite3.Database(db_path, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT trigger_id, action_code, trigger_type, condition_formula, start_period, end_period, created_at
     FROM action_trigger
     WHERE action_code = ?
     ORDER BY trigger_id`,
    [action_code],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch triggers: ' + err.message })
      }
      res.json(rows)
    }
  )
})

/**
 * Save trigger for a management action
 * POST /api/action-triggers/save
 */
app.post('/api/action-triggers/save', (req, res) => {
  const { dbPath, action_code, trigger_type, condition_formula, trigger_sticky, start_period, end_period } = req.body

  if (!dbPath || !action_code || !trigger_type) {
    return res.status(400).json({ error: 'dbPath, action_code, and trigger_type are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.serialize(() => {
    // Delete existing trigger
    db.run('DELETE FROM action_trigger WHERE action_code = ?', [action_code], (err) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to delete old trigger: ' + err.message })
      }

      // Insert new trigger
      db.run(
        `INSERT INTO action_trigger (action_code, trigger_type, condition_formula, trigger_sticky, start_period, end_period)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [action_code, trigger_type, condition_formula, trigger_sticky, start_period, end_period],
        function(err) {
          db.close()
          if (err) {
            return res.status(500).json({ error: 'Failed to save trigger: ' + err.message })
          }
          res.json({ success: true })
        }
      )
    })
  })
})

/**
 * Get physical risk drivers for hazard map mapping
 * GET /api/physical-perils?dbPath=...
 */
app.get('/api/physical-perils', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT
      driver_id as peril_id,
      code as peril_code,
      name as peril_type,
      description,
      category
     FROM driver
     WHERE category = 'physical' AND is_active = 1
     ORDER BY code`,
    [],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch physical risk drivers: ' + err.message })
      }
      res.json(rows)
    }
  )
})

/**
 * Save hazard map mapping configuration
 * POST /api/hazard-maps/save-hazard-map-mapping
 * Body: { dbPath, fileId, perilId, latitudeColumn, longitudeColumn, unitsColumn, intensityColumns, varianceColumns }
 */
app.post('/api/hazard-maps/save-hazard-map-mapping', (req, res) => {
  const { dbPath, fileId, perilType, latitudeColumn, longitudeColumn, unitsColumn, intensityColumns, varianceColumns } = req.body

  console.log('Saving hazard map mapping:', { fileId, perilType, latitudeColumn, longitudeColumn, unitsColumn, intensityColumns, varianceColumns })

  if (!dbPath || !fileId || !perilType || !latitudeColumn || !longitudeColumn) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  const mapping = {
    fileId,
    perilType,
    latitudeColumn,
    longitudeColumn,
    unitsColumn: unitsColumn || null,
    intensityColumns: intensityColumns || [],
    varianceColumns: varianceColumns || []
  }

  // Use UPSERT to preserve mapping_id and prevent CASCADE DELETE
  db.run(
    `INSERT INTO hazard_map_mapping (file_id, peril_type, latitude_column, longitude_column, units_column, intensity_columns, variance_columns, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(file_id) DO UPDATE SET
       peril_type = excluded.peril_type,
       latitude_column = excluded.latitude_column,
       longitude_column = excluded.longitude_column,
       units_column = excluded.units_column,
       intensity_columns = excluded.intensity_columns,
       variance_columns = excluded.variance_columns,
       updated_at = datetime('now')`,
    [fileId, perilType, latitudeColumn, longitudeColumn, unitsColumn || null, JSON.stringify(intensityColumns || []), JSON.stringify(varianceColumns || [])],
    function(err) {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to save mapping: ' + err.message })
      }

      // Get the mapping_id that was just inserted/updated
      db.get(
        'SELECT mapping_id FROM hazard_map_mapping WHERE file_id = ?',
        [fileId],
        (err, row) => {
          db.close()
          if (err || !row) {
            return res.status(500).json({ error: 'Failed to retrieve mapping ID' })
          }
          res.json({ success: true, message: 'Hazard map mapping saved', mappingId: row.mapping_id })
        }
      )
    }
  )
})

/**
 * Get hazard map mapping configuration
 * GET /api/hazard-maps/get-hazard-map-mapping?dbPath=...&fileId=...
 */
app.get('/api/hazard-maps/get-hazard-map-mapping', (req, res) => {
  const { dbPath, fileId } = req.query

  if (!dbPath || !fileId) {
    return res.status(400).json({ error: 'dbPath and fileId are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.get(
    `SELECT mapping_id, file_id, peril_type, latitude_column, longitude_column, units_column, intensity_columns, variance_columns
     FROM hazard_map_mapping
     WHERE file_id = ?`,
    [fileId],
    (err, row) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch mapping: ' + err.message })
      }

      if (!row) {
        return res.json({ success: true, mapping: null })
      }

      const mapping = {
        mappingId: row.mapping_id,
        perilType: row.peril_type,
        latitudeColumn: row.latitude_column,
        longitudeColumn: row.longitude_column,
        unitsColumn: row.units_column,
        intensityColumns: JSON.parse(row.intensity_columns || '[]'),
        varianceColumns: JSON.parse(row.variance_columns || '[]')
      }

      res.json({ success: true, mapping })
    }
  )
})

/**
 * List all hazard map mappings with metadata
 * GET /api/hazard-maps/list-mappings?dbPath=...
 */
app.get('/api/hazard-maps/list-mappings', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT hm.mapping_id, sf.file_name, hm.peril_type, hm.peril_type as peril_code
     FROM hazard_map_mapping hm
     JOIN staged_file sf ON sf.file_id = hm.file_id
     ORDER BY sf.file_name`,
    [],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch mappings: ' + err.message })
      }
      res.json({ success: true, mappings: rows || [] })
    }
  )
})

/**
 * Get scenarios linked to a hazard map
 * GET /api/hazard-maps/get-scenarios?dbPath=...&mappingId=...
 */
app.get('/api/hazard-maps/get-scenarios', (req, res) => {
  const { dbPath, mappingId } = req.query

  if (!dbPath || !mappingId) {
    return res.status(400).json({ error: 'dbPath and mappingId are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.all(
    `SELECT s.scenario_id, s.code, s.name
     FROM hazard_map_scenario hms
     JOIN scenario s ON s.code = hms.scenario_code
     WHERE hms.mapping_id = ?
     ORDER BY s.code`,
    [mappingId],
    (err, rows) => {
      db.close()
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch scenarios: ' + err.message })
      }
      res.json({ success: true, scenarios: rows || [] })
    }
  )
})

/**
 * Save hazard map to scenario mappings
 * POST /api/hazard-maps/save-scenario-mappings
 * Body: { dbPath, mappingId, scenarioCodes: [] }
 */
app.post('/api/hazard-maps/save-scenario-mappings', (req, res) => {
  const { dbPath, mappingId, scenarioCodes } = req.body

  console.log('[Hazard Map Scenario Save]', { mappingId, scenarioCodes, count: scenarioCodes?.length })

  if (!dbPath || !mappingId || !Array.isArray(scenarioCodes)) {
    return res.status(400).json({ error: 'dbPath, mappingId, and scenarioCodes array are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  db.serialize(() => {
    // Delete existing mappings for this hazard map
    db.run(
      'DELETE FROM hazard_map_scenario WHERE mapping_id = ?',
      [mappingId],
      (err) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Failed to delete old mappings: ' + err.message })
        }

        // Insert new mappings
        if (scenarioCodes.length === 0) {
          db.close()
          return res.json({ success: true, message: 'Mappings cleared' })
        }

        const stmt = db.prepare('INSERT INTO hazard_map_scenario (mapping_id, scenario_code) VALUES (?, ?)')
        let errors = []

        scenarioCodes.forEach((scenarioCode) => {
          stmt.run([mappingId, scenarioCode], (err) => {
            if (err) errors.push(err.message)
          })
        })

        stmt.finalize((err) => {
          db.close()
          if (err || errors.length > 0) {
            return res.status(500).json({
              error: 'Failed to save some mappings',
              details: errors
            })
          }
          res.json({ success: true, message: `Saved ${scenarioCodes.length} mapping(s)` })
        })
      }
    )
  })
})

/**
 * Ingest statements from staged files using mappings
 * POST /api/ingest/statements
 * Body: { dbPath }
 */
app.post('/api/ingest/statements', async (req, res) => {
  const { dbPath, verbosity = 'verbose' } = req.body

  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Invalid database path' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  const logs = []

  const logDebug = (msg, data) => {
    if (verbosity === 'debug') {
      const logMsg = data ? `${msg}: ${JSON.stringify(data, null, 2)}` : msg
      console.log(`[Statement Ingestion DEBUG] ${logMsg}`)
      logs.push({ level: 'debug', message: logMsg })
    }
  }

  const logVerbose = (msg) => {
    if (verbosity === 'verbose' || verbosity === 'debug') {
      console.log(`[Statement Ingestion] ${msg}`)
      logs.push({ level: 'verbose', message: msg })
    }
  }

  const ingestStatements = () => {
    return new Promise((resolve, reject) => {
      logVerbose('Querying database tables: statement_mapping JOIN staged_file')
      // Get all statement mappings with their CSV content
      db.all(
        `SELECT sm.*, sf.csv_content
         FROM statement_mapping sm
         JOIN staged_file sf ON sf.file_name = sm.csv_file_name
         WHERE sf.csv_content IS NOT NULL`,
        [],
        async (err, mappings) => {
          if (err) return reject(err)
          logVerbose(`Found ${mappings.length} statement mapping(s) with CSV content`)
          if (mappings.length === 0) {
            return resolve({ inserted: 0, message: 'No statement mappings found' })
          }

          let totalInserted = 0
          const errors = []

          for (const mapping of mappings) {
            try {
              logVerbose(`Processing statement mapping for file: ${mapping.csv_file_name}`)
              logDebug('Mapping record from statement_mapping table:', {
                mapping_id: mapping.mapping_id,
                csv_file_name: mapping.csv_file_name,
                column_mapping_keys: Object.keys(JSON.parse(mapping.column_mapping))
              })

              const csvData = parse(mapping.csv_content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
              })

              // Get all column names
              const allColumns = csvData.length > 0 ? Object.keys(csvData[0]) : []

              logVerbose(`File dimensions: ${csvData.length} rows × ${allColumns.length} columns`)
              logDebug('All available columns:', allColumns)
              logDebug('Parsed CSV rows from csv_content field:', csvData.length)
              if (csvData.length > 0) {
                logDebug('Sample CSV row (first row):', csvData[0])
              }

              const columnMapping = JSON.parse(mapping.column_mapping)
              logDebug('Column mapping structure from statement_mapping:', columnMapping)
              const hierarchicalMappings = columnMapping.hierarchical_mappings || []
              logVerbose(`Processing ${hierarchicalMappings.length} hierarchical mapping(s)`)

              // Determine target staging table based on statement_type
              const statementType = mapping.statement_type
              let stagingTable
              switch (statementType) {
                case 'pnl':
                  stagingTable = 'staging_statement_pnl'
                  break
                case 'bs':
                case 'balance_sheet':
                  stagingTable = 'staging_statement_balance_sheet'
                  break
                case 'cashflow':
                case 'cf':
                  stagingTable = 'staging_statement_cashflow'
                  break
                case 'carbon':
                  stagingTable = 'staging_statement_carbon'
                  break
                default:
                  throw new Error(`Unknown statement type: ${statementType}`)
              }

              logVerbose(`Statement type: ${statementType} → Target table: ${stagingTable}`)

              // Clear existing data in staging table
              await new Promise((res, rej) => {
                db.run(`DELETE FROM ${stagingTable}`, [], (err) => {
                  if (err) rej(err)
                  else res()
                })
              })

              for (const hm of hierarchicalMappings) {
                const csvRow = csvData[hm.csv_row_index]
                if (!csvRow) {
                  logDebug(`Skipping missing CSV row at index ${hm.csv_row_index}`)
                  continue
                }

                const value = parseFloat(csvRow.Value || csvRow.value || 0)
                const units = csvRow.units || csvRow.Units || csvRow.currency || csvRow.Currency || null

                logDebug(`Inserting into ${stagingTable}:`, {
                  source_csv_row: hm.csv_row_index,
                  source_csv_value: csvRow.Value || csvRow.value,
                  parsed_value: value,
                  units: units,
                  line_item_code: hm.line_item_code
                })

                await new Promise((res, rej) => {
                  db.run(
                    `INSERT INTO ${stagingTable} (line_item, units, value) VALUES (?, ?, ?)`,
                    [hm.line_item_code, units, value.toString()],
                    (err) => (err ? rej(err) : (totalInserted++, res()))
                  )
                })
              }
              logVerbose(`Completed processing file: ${mapping.csv_file_name}`)
            } catch (err) {
              errors.push(`Error processing mapping: ${err.message}`)
              logDebug('Error details:', err)
            }
          }

          if (errors.length > 0) {
            reject(new Error(errors.join('; ')))
          } else {
            logVerbose(`Statement ingestion complete. Inserted ${totalInserted} values into staging tables`)
            resolve({ inserted: totalInserted, mappings: mappings.length })
          }
        }
      )
    })
  }

  try {
    const result = await ingestStatements()
    res.json({ success: true, ...result, logs })
  } catch (error) {
    console.error('Statement ingestion error:', error)
    res.status(500).json({ error: error.message })
  } finally {
    db.close()
  }
})

/**
 * Ingest scenarios from staged files using mappings
 * POST /api/ingest/scenarios
 * Body: { dbPath }
 */
app.post('/api/ingest/scenarios', async (req, res) => {
  const { dbPath, verbosity = 'verbose' } = req.body

  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Invalid database path' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  const logs = []

  const logDebug = (msg, data) => {
    if (verbosity === 'debug') {
      const logMsg = data ? `${msg}: ${JSON.stringify(data, null, 2)}` : msg
      console.log(`[Scenario Ingestion DEBUG] ${logMsg}`)
      logs.push({ level: 'debug', message: logMsg })
    }
  }

  const logVerbose = (msg) => {
    if (verbosity === 'verbose' || verbosity === 'debug') {
      console.log(`[Scenario Ingestion] ${msg}`)
      logs.push({ level: 'verbose', message: msg })
    }
  }

  // Clean up all scenarios and results before starting ingestion
  const cleanupDatabase = () => {
    return new Promise((resolve, reject) => {
      logVerbose('Cleaning up old scenarios and results...')
      db.serialize(() => {
        db.run('DELETE FROM scenario', (err) => {
          if (err) console.error('Failed to clear scenario:', err)
        })
        db.run('DELETE FROM scenario_drivers', (err) => {
          if (err) console.error('Failed to clear scenario_drivers:', err)
        })
        db.run('DELETE FROM fx_rate', (err) => {
          if (err) console.error('Failed to clear fx_rate:', err)
        })
        db.run('DELETE FROM statement_result', (err) => {
          if (err) console.error('Failed to clear statement_result:', err)
        })
        db.run('DELETE FROM statement_result_by_driver', (err) => {
          if (err) console.error('Failed to clear statement_result_by_driver:', err)
        })
        db.run('DELETE FROM pl_result', (err) => {
          if (err) console.error('Failed to clear pl_result:', err)
        })
        db.run('DELETE FROM bs_result', (err) => {
          if (err) console.error('Failed to clear bs_result:', err)
        })
        db.run('DELETE FROM cf_result', (err) => {
          if (err) console.error('Failed to clear cf_result:', err)
        })
        db.run('DELETE FROM carbon_result', (err) => {
          if (err) {
            console.error('Failed to clear carbon_result:', err)
            return reject(err)
          }
          logVerbose('Cleanup complete')
          resolve()
        })
      })
    })
  }

  const ingestScenarios = () => {
    return new Promise((resolve, reject) => {
      logVerbose('Querying database tables: scenario_mapping JOIN staged_file')
      // Get all scenario mappings
      db.all(
        `SELECT scm.*, sf.file_name
         FROM scenario_mapping scm
         JOIN staged_file sf ON sf.file_id = scm.file_id`,
        [],
        async (err, mappings) => {
              if (err) return reject(err)
              logVerbose(`Found ${mappings.length} scenario mapping(s)`)
              if (mappings.length === 0) {
                return resolve({ scenarios: 0, drivers: 0, message: 'No scenario mappings found' })
              }

              let scenariosCreated = 0
              let driversInserted = 0
              const errors = []
              let firstMappingId = null

              for (const mapping of mappings) {
                // Capture the first mapping_id to return to the frontend
                if (firstMappingId === null) {
                  firstMappingId = mapping.mapping_id
                }
            try {
              logVerbose(`Processing CSV file: ${mapping.file_name}`)
              logDebug('Mapping record from scenario_mapping table:', {
                mapping_id: mapping.mapping_id,
                file_id: mapping.file_id,
                scenario_column: mapping.scenario_column,
                driver_column: mapping.driver_column,
                units_column: mapping.units_column,
                value_columns: mapping.value_columns,
                variable_mappings_count: JSON.parse(mapping.variable_mappings).length
              })

              // Read from staging table instead of csv_content
              // Validate file_id and create safe staging table name
              let stagingTableName
              try {
                const validatedFileId = security.validateFileId(mapping.file_id)
                stagingTableName = security.createNumberedStagingTableName(validatedFileId)
              } catch (err) {
                errors.push(`Invalid file_id: ${mapping.file_id}`)
                continue
              }

              logVerbose(`Reading data from staging table: ${stagingTableName}`)
              const csvData = await new Promise((res, rej) => {
                db.all(`SELECT * FROM ${security.quoteIdentifier(stagingTableName)}`, [], (err, rows) => {
                  if (err) rej(err)
                  else res(rows)
                })
              })

              if (csvData.length === 0) {
                errors.push(`No data in staging table ${stagingTableName}`)
                continue
              }

              // Get all column names from the first row
              const allColumns = csvData.length > 0 ? Object.keys(csvData[0]).filter(col =>
                !['_rowid', 'imported_at', 'is_mapped'].includes(col)
              ) : []

              logVerbose(`File dimensions: ${csvData.length} rows × ${allColumns.length} columns`)
              logDebug('All available columns:', allColumns)
              logDebug('Sample CSV row (first row):', csvData[0])

              const valueColumns = JSON.parse(mapping.value_columns)
              const variableMappings = JSON.parse(mapping.variable_mappings)

              logVerbose(`Column mapping configuration:`)
              logVerbose(`  - Scenario column: ${mapping.scenario_column || 'Not set'}`)
              logVerbose(`  - Variable/Driver column: ${mapping.driver_column || 'Not set'}`)
              logVerbose(`  - Units column: ${mapping.units_column || 'Not set'}`)
              logVerbose(`  - Value columns count: ${valueColumns.length}`)
              if (valueColumns.length > 0) {
                logVerbose(`  - Value columns: ${valueColumns.join(', ')}`)
              } else {
                logVerbose(`  ⚠️  WARNING: No value columns configured! Period data will not be ingested.`)
                logVerbose(`  ⚠️  Please set Value Start and Value End columns in the Map Scenarios page.`)
              }
              logVerbose(`  - Variable mappings: ${variableMappings.length} driver(s) mapped`)

              logDebug('Value columns from mapping:', valueColumns)
              logDebug('Variable mappings from mapping:', variableMappings)

              // Get value columns (periods)
              const periodColumns = valueColumns.filter(col => !['driver', 'scenario', 'unit', 'units'].includes(col.toLowerCase()))
              logVerbose(`Identified ${periodColumns.length} period column(s): ${periodColumns.join(', ')}`)

              // Get unique scenarios from the scenario column
              const uniqueScenarios = new Set()
              if (mapping.scenario_column) {
                logVerbose(`Using scenario column: ${mapping.scenario_column}`)
                csvData.forEach(row => {
                  const scenarioName = row[mapping.scenario_column]
                  if (scenarioName) uniqueScenarios.add(scenarioName)
                })
              }

              // If no scenario column, treat all data as one scenario
              if (uniqueScenarios.size === 0) {
                uniqueScenarios.add('Default')
              }
              logVerbose(`Found ${uniqueScenarios.size} unique scenario(s): ${Array.from(uniqueScenarios).join(', ')}`)

              // For each unique scenario, create scenario record and insert driver values
              for (const scenarioName of uniqueScenarios) {
                // Use file_id in code to ensure one scenario per file (no duplicates)
                const scenarioCode = `SCENARIO_${scenarioName}_FILE${mapping.file_id}`
                logVerbose(`Creating/reusing scenario: ${scenarioName} (code: ${scenarioCode})`)
                logVerbose(`[DIAGNOSTIC] About to look up template. mapping = ${JSON.stringify(mapping)}`)

                // Get template_id from statement_mapping's template_code
                logDebug(`[TEMPLATE_LOOKUP] mapping.template_code = ${mapping.template_code}`)
                const templateId = await new Promise((res, rej) => {
                  db.get(
                    'SELECT template_id FROM statement_template WHERE code = ?',
                    [mapping.template_code],
                    (err, row) => {
                      if (err) {
                        logDebug(`[TEMPLATE_LOOKUP] ERROR: ${err.message}`)
                        rej(err)
                      } else if (row?.template_id) {
                        logDebug(`[TEMPLATE_LOOKUP] Query result: ${JSON.stringify(row)}, resolved templateId = ${row.template_id}`)
                        res(row.template_id)
                      } else {
                        // Fallback: query for active template instead of hardcoding template_id = 1
                        logDebug(`[TEMPLATE_LOOKUP] No template found for code '${mapping.template_code}', querying for active template`)
                        db.get(
                          'SELECT template_id FROM statement_template WHERE is_active = 1 LIMIT 1',
                          [],
                          (err2, row2) => {
                            if (err2) {
                              logDebug(`[TEMPLATE_LOOKUP] ERROR querying active template: ${err2.message}`)
                              rej(err2)
                            } else if (row2?.template_id) {
                              logDebug(`[TEMPLATE_LOOKUP] Using active template: ${row2.template_id}`)
                              res(row2.template_id)
                            } else {
                              const error = new Error(`No template found for code '${mapping.template_code}' and no active template exists`)
                              logDebug(`[TEMPLATE_LOOKUP] FATAL: ${error.message}`)
                              rej(error)
                            }
                          }
                        )
                      }
                    }
                  )
                })

                // Create scenario record (if not exists)
                await new Promise((res, rej) => {
                  db.run(
                    `INSERT OR IGNORE INTO scenario
                     (code, name, description, json_drivers, statement_template_id, tax_strategy_id)
                     VALUES (?, ?, ?, '[]', ?, 1)`,
                    [scenarioCode, scenarioName, `Imported from ${mapping.file_id}`, templateId],
                    function(err) {
                      if (err) rej(err)
                      else {
                        if (this.changes > 0) {
                          scenariosCreated++
                          logDebug(`Inserted new scenario into scenario table with template_id ${templateId}`)
                        } else {
                          logDebug(`Reusing existing scenario with code: ${scenarioCode}`)
                        }
                        res(this.lastID)
                      }
                    }
                  )
                })

                // Always update template_id in case it was wrong from previous ingestion
                logDebug(`[TEMPLATE_UPDATE] Updating scenario ${scenarioCode} to template_id ${templateId}`)
                await new Promise((res, rej) => {
                  db.run(
                    `UPDATE scenario SET statement_template_id = ? WHERE code = ?`,
                    [templateId, scenarioCode],
                    function(err) {
                      if (err) {
                        logDebug(`[TEMPLATE_UPDATE] ERROR: ${err.message}`)
                        rej(err)
                      } else {
                        logDebug(`[TEMPLATE_UPDATE] SUCCESS: ${this.changes} row(s) updated`)
                        res()
                      }
                    }
                  )
                })

                // Get scenario_id
                const scenarioId = await new Promise((res, rej) => {
                  db.get(
                    `SELECT scenario_id FROM scenario WHERE code = ?`,
                    [scenarioCode],
                    (err, row) => (err ? rej(err) : res(row?.scenario_id))
                  )
                })
                logDebug(`Scenario ID: ${scenarioId}`)

                // Insert driver values for each period
                logVerbose(`Processing ${variableMappings.length} variable mapping(s) for ${periodColumns.length} period(s)`)
                for (const varMapping of variableMappings) {
                  // Find the CSV row that matches BOTH this driver AND this scenario
                  // (Don't rely on csv_row_index which may only reference scenario 1's rows)
                  let csvRow = null
                  if (mapping.scenario_column) {
                    // Multi-scenario CSV: need to find the driver name first, then search
                    // Get the driver name from the originally mapped row
                    const originalRow = csvData[varMapping.csv_row_index]
                    if (!originalRow) {
                      logDebug(`Skipping driver ${varMapping.driver_code}: original row ${varMapping.csv_row_index} not found`)
                      continue
                    }
                    const driverNameInCsv = originalRow[mapping.driver_column]

                    // Now search for the row with this driver name AND the current scenario
                    csvRow = csvData.find(row =>
                      row[mapping.driver_column] === driverNameInCsv &&
                      row[mapping.scenario_column] === scenarioName
                    )
                    if (!csvRow) {
                      logDebug(`Skipping driver ${varMapping.driver_code} (${driverNameInCsv}): no CSV row found for scenario ${scenarioName}`)
                      continue
                    }
                  } else {
                    // Single-scenario CSV: use the original row index
                    csvRow = csvData[varMapping.csv_row_index]
                    if (!csvRow) {
                      logDebug(`Skipping missing CSV row at index ${varMapping.csv_row_index}`)
                      continue
                    }
                  }

                  const unitCode = csvRow[mapping.units_column] || 'USD'
                  logDebug(`Processing driver: ${varMapping.driver_code}`, {
                    csv_row_index: varMapping.csv_row_index,
                    driver_name_in_csv: csvRow[mapping.driver_column],
                    unit_from_csv: unitCode,
                    scenario_from_csv: csvRow[mapping.scenario_column],
                    mapped_to_driver_code: varMapping.driver_code
                  })

                  // Insert value for each period (drivers are global, no entity_id)
                  for (let periodIndex = 0; periodIndex < periodColumns.length; periodIndex++) {
                    const periodCol = periodColumns[periodIndex]
                    const value = parseFloat(csvRow[periodCol] || 0)

                    logDebug(`Inserting into scenario_drivers table:`, {
                      source_csv_column: periodCol,
                      source_csv_value: csvRow[periodCol],
                      parsed_value: value,
                      insert_to_table: 'scenario_drivers',
                      scenario_id: scenarioId,
                      period_id: periodIndex + 1,
                      driver_code: varMapping.driver_code,
                      value: value,
                      unit_code: unitCode
                    })

                    await new Promise((res, rej) => {
                      db.run(
                        `INSERT OR REPLACE INTO scenario_drivers
                         (scenario_id, period_id, driver_code, value, unit_code)
                         VALUES (?, ?, ?, ?, ?)`,
                        [scenarioId, periodIndex + 1, varMapping.driver_code, value, unitCode],
                        (err) => (err ? rej(err) : (driversInserted++, res()))
                      )
                    })
                  }
                }

                // Populate fx_rate table from FX drivers (category = 'fx')
                logVerbose(`Populating FX rates from FX drivers for scenario: ${scenarioName}`)
                const baseCurrency = await new Promise((res, rej) => {
                  db.get(
                    `SELECT base_currency FROM scenario WHERE scenario_id = ?`,
                    [scenarioId],
                    (err, row) => (err ? rej(err) : res(row?.base_currency || 'CHF'))
                  )
                })

                logDebug(`Base currency for scenario ${scenarioId}: ${baseCurrency}`)

                // Get all FX drivers from scenario_drivers that match drivers with category='fx'
                const fxDrivers = await new Promise((res, rej) => {
                  db.all(
                    `SELECT sd.scenario_id, sd.period_id, sd.driver_code, sd.value, d.code as currency_code
                     FROM scenario_drivers sd
                     JOIN driver d ON sd.driver_code = d.code
                     WHERE sd.scenario_id = ? AND d.category = 'fx'
                     ORDER BY sd.period_id, sd.driver_code`,
                    [scenarioId],
                    (err, rows) => (err ? rej(err) : res(rows))
                  )
                })

                logVerbose(`Found ${fxDrivers.length} FX driver value(s) for scenario ${scenarioId}`)

                let fxRatesInserted = 0
                for (const fxDriver of fxDrivers) {
                  // The value in scenario_drivers is the exchange rate from base_currency to foreign currency
                  // For example: CHF base, USD driver with value 0.91 means 1 CHF = 0.91 USD
                  // But fx_rate table expects: 1 USD = X CHF, so we need to invert
                  const rate = 1 / fxDriver.value  // Invert to get from_currency to base_currency

                  await new Promise((res, rej) => {
                    db.run(
                      `INSERT OR REPLACE INTO fx_rate
                       (scenario_id, period_id, from_currency, to_currency, rate, rate_type)
                       VALUES (?, ?, ?, ?, ?, 'average')`,
                      [fxDriver.scenario_id, fxDriver.period_id, fxDriver.currency_code, baseCurrency, rate],
                      (err) => {
                        if (err) {
                          logDebug(`Error inserting FX rate: ${err.message}`)
                          rej(err)
                        } else {
                          fxRatesInserted++
                          res()
                        }
                      }
                    )
                  })
                }

                if (fxRatesInserted > 0) {
                  logVerbose(`  → Inserted ${fxRatesInserted} FX rate(s) into fx_rate table`)
                } else {
                  logVerbose(`  → No FX rates to insert (no drivers with category='fx')`)
                }

                logVerbose(`Completed scenario: ${scenarioName}`)
                logVerbose(`  → Inserted ${variableMappings.length} drivers × ${periodColumns.length} periods = ${variableMappings.length * periodColumns.length} values`)
              }
            } catch (err) {
              errors.push(`Error processing mapping: ${err.message}`)
            }
              }

              if (errors.length > 0) {
                reject(new Error(errors.join('; ')))
              } else {
                resolve({ scenarios: scenariosCreated, drivers: driversInserted, mappingId: firstMappingId })
              }
            }
          )
    })
  }

  try {
    await cleanupDatabase()
    const result = await ingestScenarios()
    res.json({ success: true, ...result, logs })
  } catch (error) {
    console.error('Scenario ingestion error:', error)
    res.status(500).json({ error: error.message, logs })
  } finally {
    db.close()
  }
})

/**
 * Get available periods from scenario_drivers
 * GET /api/results/periods?dbPath=...
 */
/**
 * Get list of scenarios with their metadata
 * GET /api/results/scenarios?dbPath=...
 */
app.get('/api/results/scenarios', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  db.all(
    `SELECT
      s.scenario_id,
      s.code,
      s.name,
      COUNT(DISTINCT sr.period_id) as num_periods
    FROM scenario s
    LEFT JOIN statement_result sr ON s.scenario_id = sr.scenario_id
    GROUP BY s.scenario_id
    ORDER BY s.scenario_id`,
    [],
    (err, rows) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: err.message })
      }

      db.close()
      res.json({ success: true, scenarios: rows })
    }
  )
})

app.get('/api/results/periods', (req, res) => {
  const { dbPath, scenarioId } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  let query, params
  if (scenarioId) {
    query = `SELECT DISTINCT period_id FROM statement_result WHERE scenario_id = ? ORDER BY period_id`
    params = [scenarioId]
  } else {
    query = `SELECT DISTINCT period_id FROM statement_result ORDER BY period_id`
    params = []
  }

  db.all(query, params, (err, rows) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: err.message })
      }

      const periods = rows.map(row => row.period_id)
      db.close()
      res.json({ success: true, periods })
    }
  )
})

/**
 * Get financial statement results for a specific period and entity
 * GET /api/results/statement?dbPath=...&period=1&entityId=...&scenarioId=...
 */
app.get('/api/results/statement', (req, res) => {
  const { dbPath, period, entityId, scenarioId, whatIfCombination } = req.query

  if (!dbPath || !period) {
    return res.status(400).json({ error: 'Database path and period are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  // First, get the statement template to extract line item metadata
  db.get(
    `SELECT json_structure FROM statement_template WHERE is_active = 1 LIMIT 1`,
    [],
    (err, template) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to load statement template: ' + err.message })
      }

      if (!template) {
        db.close()
        return res.status(404).json({ error: 'No active statement template found' })
      }

      let lineItemsMetadata
      try {
        const jsonStructure = JSON.parse(template.json_structure)
        lineItemsMetadata = jsonStructure.line_items || []
      } catch (parseErr) {
        db.close()
        return res.status(500).json({ error: 'Failed to parse statement template' })
      }

      // Create a map of code -> metadata for quick lookup
      const metadataMap = new Map()
      lineItemsMetadata.forEach(item => {
        metadataMap.set(item.code, {
          display_name: item.display_name,
          section: item.section || 'Other',
          is_computed: item.formula ? true : false,
          display_order: item.display_order || 999,
          sign_convention: item.sign_convention || 'positive'
        })
      })

      // Now query statement_result for calculated values
      // If entityId is provided, filter by that entity; otherwise get latest entity
      let query, params
      const whatIfFilter = whatIfCombination ? ' AND what_if_combination = ?' : ''

      if (scenarioId) {
        // Use specific scenario
        if (entityId) {
          query = `SELECT line_item_code, value FROM statement_result
                   WHERE period_id = ? AND entity_id = ? AND scenario_id = ?${whatIfFilter}
                   LIMIT 100`
          params = whatIfCombination ? [period, entityId, scenarioId, whatIfCombination] : [period, entityId, scenarioId]
        } else {
          query = `SELECT line_item_code, value FROM statement_result
                   WHERE period_id = ? AND scenario_id = ?${whatIfFilter}
                   AND entity_id = (SELECT MAX(entity_id) FROM statement_result WHERE period_id = ? AND scenario_id = ?${whatIfFilter})
                   LIMIT 100`
          params = whatIfCombination ? [period, scenarioId, whatIfCombination, period, scenarioId, whatIfCombination] : [period, scenarioId, period, scenarioId]
        }
      } else {
        // Default to latest scenario
        if (entityId) {
          query = `SELECT line_item_code, value FROM statement_result
                   WHERE period_id = ? AND entity_id = ?${whatIfFilter}
                   AND scenario_id = (SELECT MAX(scenario_id) FROM statement_result)
                   LIMIT 100`
          params = whatIfCombination ? [period, entityId, whatIfCombination] : [period, entityId]
        } else {
          query = `SELECT line_item_code, value FROM statement_result
                   WHERE period_id = ?${whatIfFilter}
                   AND scenario_id = (SELECT MAX(scenario_id) FROM statement_result)
                   AND entity_id = (SELECT MAX(entity_id) FROM statement_result WHERE period_id = ?${whatIfFilter})
                   LIMIT 100`
          params = whatIfCombination ? [period, whatIfCombination, period, whatIfCombination] : [period, period]
        }
      }

      db.all(query, params, (err, rows) => {
          if (err) {
            db.close()
            return res.status(500).json({ error: err.message })
          }

          // If no statement_result data, return empty array
          if (!rows || rows.length === 0) {
            db.close()
            return res.json({ success: true, lineItems: [] })
          }

          // Combine pl_result data with metadata
          const lineItems = rows.map(row => {
            const metadata = metadataMap.get(row.line_item_code) || {
              display_name: row.line_item_code,
              section: 'Other',
              is_computed: false,
              display_order: 999,
              sign_convention: 'positive'
            }
            return {
              code: row.line_item_code,
              display_name: metadata.display_name,
              section: metadata.section,
              is_computed: metadata.is_computed,
              sign_convention: metadata.sign_convention,
              value: row.value
            }
          })

          // Debug: Log line items with sign convention
          console.log('[Statement Results] Line items with sign_convention:',
            lineItems.map(li => ({ code: li.code, sign_convention: li.sign_convention })))

          // Sort by section and display_order
          lineItems.sort((a, b) => {
            if (a.section !== b.section) {
              return a.section.localeCompare(b.section)
            }
            const orderA = metadataMap.get(a.code)?.display_order || 999
            const orderB = metadataMap.get(b.code)?.display_order || 999
            return orderA - orderB
          })

          db.close()
          res.json({ success: true, lineItems })
        }
      )
    }
  )
})

/**
 * Get all entities with hierarchy information
 * GET /api/results/entities?dbPath=...
 */
app.get('/api/results/entities', (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'Database path is required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  db.all(
    `SELECT entity_id, code, name, granularity_level, parent_entity_id
     FROM entity
     WHERE is_active = 1
     ORDER BY entity_id`,
    [],
    (err, rows) => {
      db.close()

      if (err) {
        return res.status(500).json({ error: err.message })
      }

      res.json({ success: true, entities: rows || [] })
    }
  )
})

/**
 * GET /api/results/driver-decomposition?dbPath=...&period=1&entityId=...&lineItemCode=...
 */
app.get('/api/results/driver-decomposition', (req, res) => {
  const { dbPath, period, entityId, lineItemCode, scenarioId, whatIfCombination } = req.query

  if (!dbPath || !period || !entityId || !lineItemCode) {
    return res.status(400).json({ error: 'Database path, period, entityId, and lineItemCode are required' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }
  })

  let query, params
  const whatIfFilter = whatIfCombination ? ' AND what_if_combination = ?' : ''

  if (scenarioId) {
    query = `SELECT driver_code, value
             FROM statement_result_by_driver
             WHERE period_id = ? AND entity_id = ? AND line_item_code = ? AND scenario_id = ?${whatIfFilter}
             ORDER BY driver_code`
    params = whatIfCombination ? [period, entityId, lineItemCode, scenarioId, whatIfCombination] : [period, entityId, lineItemCode, scenarioId]
  } else {
    // Default to latest scenario for backward compatibility
    query = `SELECT driver_code, value
             FROM statement_result_by_driver
             WHERE period_id = ? AND entity_id = ? AND line_item_code = ?${whatIfFilter}
             AND scenario_id = (SELECT MAX(scenario_id) FROM statement_result_by_driver)
             ORDER BY driver_code`
    params = whatIfCombination ? [period, entityId, lineItemCode, whatIfCombination] : [period, entityId, lineItemCode]
  }

  db.all(query, params, (err, rows) => {
    db.close()

    if (err) {
      return res.status(500).json({ error: err.message })
    }

    res.json({ success: true, drivers: rows || [] })
  })
})

/**
 * Validate scenario readiness for calculation (Issues #12, #14)
 * POST /api/validate-scenario
 * Body: { dbPath, scenarioId }
 * Returns: { valid, errors, warnings, info }
 */
app.post('/api/validate-scenario', (req, res) => {
  const { dbPath, scenarioId } = req.body

  if (!dbPath || !scenarioId) {
    return res.status(400).json({ error: 'dbPath and scenarioId are required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  const validationService = new ValidationService(db)

  validationService.validateScenario(scenarioId)
    .then(result => {
      db.close()
      res.json(result)
    })
    .catch(error => {
      db.close()
      res.status(500).json({ error: error.message })
    })
})

/**
 * Calculate MAC curve for what-if scenario
 * GET /api/results/mac-curve
 * Query params: dbPath, scenarioId, entityId, startPeriod, endPeriod
 *
 * UPDATED: Now uses tagged line items from statement template instead of hardcoded values
 */
app.get('/api/results/mac-curve', (req, res) => {
  const { dbPath, scenarioId, entityId, startPeriod, endPeriod } = req.query

  if (!dbPath || !scenarioId || !entityId || !startPeriod || !endPeriod) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Step 1: Get template_id for this scenario
  const templateQuery = `
    SELECT st.template_id, st.json_structure
    FROM scenario s
    JOIN statement_template st ON s.statement_template_id = st.template_id
    WHERE s.scenario_id = ?
  `

  db.get(templateQuery, [scenarioId], (err, template) => {
    if (err || !template) {
      db.close()
      return res.status(500).json({ error: 'Failed to query template: ' + (err?.message || 'Template not found') })
    }

    // Step 2: Parse json_structure to find MAC-tagged line items
    let lineItems
    try {
      const parsed = JSON.parse(template.json_structure)
      // Support both line_items (stored format) and lineItems (legacy format)
      lineItems = parsed.line_items || parsed.lineItems || []
    } catch (e) {
      db.close()
      return res.status(500).json({ error: 'Failed to parse template structure' })
    }

    const macNumeratorCodes = lineItems.filter(item => item.is_mac_numerator).map(item => item.code)
    const macDenominatorCodes = lineItems.filter(item => item.is_mac_denominator).map(item => item.code)

    if (macNumeratorCodes.length === 0 || macDenominatorCodes.length === 0) {
      db.close()
      return res.status(400).json({ error: 'No MAC numerator or denominator tagged in template. Please tag line items in Define Statements.' })
    }

    // Step 3: Get the list of MAC-relevant action codes
    const macActionsQuery = `
      SELECT action_code
      FROM management_action
      WHERE is_mac_relevant = 1
    `

    db.all(macActionsQuery, [], (err, macActions) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to query MAC-relevant actions: ' + err.message })
      }

      const macActionCodes = new Set(macActions.map(a => a.action_code))

      // Step 4: Build dynamic SQL with tagged line item codes
      const allMacCodes = [...macNumeratorCodes, ...macDenominatorCodes]
      const placeholders = allMacCodes.map(() => '?').join(',')

      const sql = `
        SELECT
          sr.what_if_combination,
          sr.period_id,
          sr.line_item_code,
          sr.value
        FROM statement_result sr
        WHERE sr.scenario_id = ?
          AND sr.entity_id = ?
          AND sr.period_id BETWEEN ? AND ?
          AND sr.line_item_code IN (${placeholders})
        ORDER BY sr.what_if_combination, sr.period_id, sr.line_item_code
      `

      const params = [scenarioId, entityId, startPeriod, endPeriod, ...allMacCodes]

      db.all(sql, params, (err, rows) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Database query failed: ' + err.message })
        }

        console.log(`\n=== MAC Calculation Debug ===`)
        console.log(`Query returned ${rows.length} rows`)
        console.log(`MAC Numerator codes: ${JSON.stringify(macNumeratorCodes)}`)
        console.log(`MAC Denominator codes: ${JSON.stringify(macDenominatorCodes)}`)
        console.log(`First 5 rows:`, rows.slice(0, 5))

        // Step 5: Group by combination and accumulate numerator/denominator values
        const combinationData = {}
        rows.forEach(row => {
          const combo = row.what_if_combination || ''
          if (!combinationData[combo]) {
            combinationData[combo] = {
              numerator: 0,      // Cost (e.g. lost net income)
              denominator: 0      // Carbon (e.g. total emissions)
            }
          }

          // Sum up values across periods
          if (macNumeratorCodes.includes(row.line_item_code)) {
            combinationData[combo].numerator += row.value
          } else if (macDenominatorCodes.includes(row.line_item_code)) {
            combinationData[combo].denominator += row.value
          }
        })

        console.log(`\nCombination data keys: ${JSON.stringify(Object.keys(combinationData))}`)
        console.log(`Combination data:`, combinationData)

        // Step 6: Find base case (no actions = empty combination)
        const baseCase = combinationData[''] || combinationData['BASE'] || combinationData['NONE'] || null
        if (!baseCase) {
          db.close()
          return res.status(400).json({ error: 'Base case (no actions) not found in results' })
        }

        const baseNumerator = baseCase.numerator
        const baseDenominator = baseCase.denominator

        // Step 7: Calculate MAC for each single-action combination
        const macResults = []
        Object.keys(combinationData).forEach(combo => {
          if (!combo || combo === '' || combo === 'BASE' || combo === 'NONE') return // Skip base case

          // Check if this is a single-action combination (no + signs)
          if (combo.includes('+')) return // Skip multi-action combinations

          // Check if this action is MAC-relevant
          if (!macActionCodes.has(combo)) return // Skip non-MAC-relevant actions

          const data = combinationData[combo]
          const numerator = data.numerator
          const denominator = data.denominator

          // Calculate deltas (positive = reduction/cost)
          const denominatorAbatement = baseDenominator - denominator  // Positive = denominator reduced (e.g., carbon reduced)
          const cost = baseNumerator - numerator  // Positive = numerator reduced (e.g., income loss = cost)

          // Skip actions with zero denominator impact (can't calculate meaningful MAC)
          if (denominatorAbatement === 0) return

          // Calculate MAC (cost per unit of denominator abatement)
          const mac = cost / denominatorAbatement

          macResults.push({
            action: combo,
            carbonAbatement: denominatorAbatement,  // Keep name for backwards compatibility
            cost,
            mac
          })
        })

        // Sort by MAC (ascending - lowest cost per unit first)
        macResults.sort((a, b) => a.mac - b.mac)

        db.close()
        res.json({
          success: true,
          baseCase: {
            totalCarbon: baseDenominator,  // Keep name for backwards compatibility
            netIncome: baseNumerator
          },
          macCurve: macResults
        })
      })
    })
  })
})

/**
 * Calculate ROI curve for what-if scenario
 * GET /api/results/roi-curve
 * Query params: dbPath, scenarioId, entityId, startPeriod, endPeriod
 *
 * Uses tagged line items from statement template (is_roi_numerator and is_roi_denominator)
 * Calculates ROI = benefit / investment for each single-action combination
 */
app.get('/api/results/roi-curve', (req, res) => {
  const { dbPath, scenarioId, entityId, startPeriod, endPeriod } = req.query

  if (!dbPath || !scenarioId || !entityId || !startPeriod || !endPeriod) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Step 1: Get template_id for this scenario
  const templateQuery = `
    SELECT st.template_id, st.json_structure
    FROM scenario s
    JOIN statement_template st ON s.statement_template_id = st.template_id
    WHERE s.scenario_id = ?
  `

  db.get(templateQuery, [scenarioId], (err, template) => {
    if (err || !template) {
      db.close()
      return res.status(500).json({ error: 'Failed to query template: ' + (err?.message || 'Template not found') })
    }

    // Step 2: Parse json_structure to find ROI-tagged line items
    let lineItems
    try {
      const parsed = JSON.parse(template.json_structure)
      // Support both line_items (stored format) and lineItems (legacy format)
      lineItems = parsed.line_items || parsed.lineItems || []
    } catch (e) {
      db.close()
      return res.status(500).json({ error: 'Failed to parse template structure' })
    }

    const roiNumeratorCodes = lineItems.filter(item => item.is_roi_numerator).map(item => item.code)
    const roiDenominatorCodes = lineItems.filter(item => item.is_roi_denominator).map(item => item.code)

    if (roiNumeratorCodes.length === 0 || roiDenominatorCodes.length === 0) {
      db.close()
      return res.status(400).json({ error: 'No ROI numerator or denominator tagged in template. Please tag line items in Define Statements.' })
    }

    // Step 3: Get the list of management action codes (all actions can be included in ROI)
    const actionsQuery = `
      SELECT action_code
      FROM management_action
    `

    db.all(actionsQuery, [], (err, actions) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to query management actions: ' + err.message })
      }

      const actionCodes = new Set(actions.map(a => a.action_code))

      // Step 4: Build dynamic SQL with tagged line item codes
      const allRoiCodes = [...roiNumeratorCodes, ...roiDenominatorCodes]
      const placeholders = allRoiCodes.map(() => '?').join(',')

      const sql = `
        SELECT
          sr.what_if_combination,
          sr.period_id,
          sr.line_item_code,
          sr.value
        FROM statement_result sr
        WHERE sr.scenario_id = ?
          AND sr.entity_id = ?
          AND sr.period_id BETWEEN ? AND ?
          AND sr.line_item_code IN (${placeholders})
        ORDER BY sr.what_if_combination, sr.period_id, sr.line_item_code
      `

      const params = [scenarioId, entityId, startPeriod, endPeriod, ...allRoiCodes]

      db.all(sql, params, (err, rows) => {
        if (err) {
          db.close()
          return res.status(500).json({ error: 'Database query failed: ' + err.message })
        }

        console.log(`\n=== ROI Calculation Debug ===`)
        console.log(`Query returned ${rows.length} rows`)
        console.log(`ROI Numerator codes (benefit): ${JSON.stringify(roiNumeratorCodes)}`)
        console.log(`ROI Denominator codes (investment): ${JSON.stringify(roiDenominatorCodes)}`)
        console.log(`First 5 rows:`, rows.slice(0, 5))

        // Step 5: Group by combination and accumulate numerator/denominator values
        const combinationData = {}
        rows.forEach(row => {
          const combo = row.what_if_combination || ''
          if (!combinationData[combo]) {
            combinationData[combo] = {
              numerator: 0,      // Benefit (e.g. revenue increase)
              denominator: 0      // Investment (e.g. capital expenditure)
            }
          }

          // Sum up values across periods
          if (roiNumeratorCodes.includes(row.line_item_code)) {
            combinationData[combo].numerator += row.value
          } else if (roiDenominatorCodes.includes(row.line_item_code)) {
            combinationData[combo].denominator += row.value
          }
        })

        console.log(`\nCombination data keys: ${JSON.stringify(Object.keys(combinationData))}`)
        console.log(`Combination data:`, combinationData)

        // Step 6: Find base case (no actions = empty combination)
        const baseCase = combinationData[''] || combinationData['BASE'] || combinationData['NONE'] || null
        if (!baseCase) {
          db.close()
          return res.status(400).json({ error: 'Base case (no actions) not found in results' })
        }

        const baseNumerator = baseCase.numerator
        const baseDenominator = baseCase.denominator

        // Step 7: Calculate ROI for each single-action combination
        const roiResults = []
        Object.keys(combinationData).forEach(combo => {
          if (!combo || combo === '' || combo === 'BASE' || combo === 'NONE') return // Skip base case

          // Check if this is a single-action combination (no + signs)
          if (combo.includes('+')) return // Skip multi-action combinations

          // Check if this action exists in management actions
          if (!actionCodes.has(combo)) return // Skip unknown actions

          const data = combinationData[combo]
          const numerator = data.numerator
          const denominator = data.denominator

          // Calculate deltas relative to base case
          const benefit = numerator - baseNumerator  // Positive = increased benefit (e.g., more revenue)
          const investment = denominator - baseDenominator  // Positive = increased investment (e.g., more capex)

          // Skip actions with zero investment (can't calculate meaningful ROI)
          if (investment === 0) return

          // Calculate ROI (benefit per unit of investment)
          const roi = benefit / investment

          roiResults.push({
            action: combo,
            investment,
            benefit,
            roi
          })
        })

        // Sort by ROI (descending - highest ROI first)
        roiResults.sort((a, b) => b.roi - a.roi)

        db.close()
        res.json({
          success: true,
          baseCase: {
            totalBenefit: baseNumerator,
            totalInvestment: baseDenominator
          },
          roiCurve: roiResults
        })
      })
    })
  })
})

/**
 * Get Monte Carlo results summary (mean across draws for MC period)
 * GET /api/results/mc-summary
 * Query params: dbPath, scenarioId, period, entityId
 */
app.get('/api/results/mc-summary', (req, res) => {
  const { dbPath, scenarioId, periodId, entityId } = req.query

  if (!dbPath || !scenarioId || !periodId || !entityId) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Query MC results and calculate mean for each line item
  const sql = `
    SELECT
      line_item_code,
      AVG(value) as mean_value,
      COUNT(DISTINCT draw_number) as num_draws
    FROM mc_statement_result
    WHERE scenario_id = ?
      AND period_id = ?
      AND entity_id = ?
    GROUP BY line_item_code
    ORDER BY line_item_code
  `

  db.all(sql, [scenarioId, periodId, entityId], (err, rows) => {
    if (err) {
      db.close()
      return res.status(500).json({ error: 'Database query failed: ' + err.message })
    }

    db.close()
    res.json({
      success: true,
      mcPeriod: parseInt(periodId),
      numDraws: rows.length > 0 ? rows[0].num_draws : 0,
      lineItems: rows.map(row => ({
        code: row.line_item_code,
        meanValue: row.mean_value
      }))
    })
  })
})

/**
 * Get Monte Carlo distribution data for a specific line item
 * GET /api/results/mc-distribution
 * Query params: dbPath, scenarioId, periodId, entityId, lineItemCode
 * Returns: all draw values, statistics (mean, std, skew, kurtosis), percentiles
 */
app.get('/api/results/mc-distribution', (req, res) => {
  const { dbPath, scenarioId, periodId, entityId, lineItemCode } = req.query

  if (!dbPath || !scenarioId || !periodId || !entityId || !lineItemCode) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
    }
  })

  // Query all draw values for the specific line item
  const sql = `
    SELECT
      draw_number,
      value
    FROM mc_statement_result
    WHERE scenario_id = ?
      AND period_id = ?
      AND entity_id = ?
      AND line_item_code = ?
    ORDER BY draw_number
  `

  db.all(sql, [scenarioId, periodId, entityId, lineItemCode], (err, rows) => {
    if (err) {
      db.close()
      return res.status(500).json({ error: 'Database query failed: ' + err.message })
    }

    if (rows.length === 0) {
      db.close()
      return res.status(404).json({ error: 'No MC draws found for this line item' })
    }

    // Calculate statistics
    const values = rows.map(r => r.value)
    const n = values.length
    const mean = values.reduce((a, b) => a + b, 0) / n

    // Standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
    const std = Math.sqrt(variance)

    // Skewness
    const m3 = values.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n
    const skew = m3 / Math.pow(std, 3)

    // Kurtosis (excess kurtosis, 0 for normal distribution)
    const m4 = values.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / n
    const kurtosis = (m4 / Math.pow(std, 4)) - 3

    // Percentiles
    const sortedValues = [...values].sort((a, b) => a - b)
    const getPercentile = (p) => {
      const index = (p / 100) * (n - 1)
      const lower = Math.floor(index)
      const upper = Math.ceil(index)
      const weight = index - lower
      return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
    }

    const percentiles = {
      p5: getPercentile(5),
      p25: getPercentile(25),
      p50: getPercentile(50),  // median
      p75: getPercentile(75),
      p95: getPercentile(95)
    }

    db.close()
    res.json({
      success: true,
      lineItemCode,
      numDraws: n,
      draws: rows.map(r => ({ drawNumber: r.draw_number, value: r.value })),
      statistics: {
        mean,
        median: percentiles.p50,
        std,
        skew,
        kurtosis,
        min: sortedValues[0],
        max: sortedValues[n - 1]
      },
      percentiles
    })
  })
})

/**
 * Risk Dashboard: Compare two scenarios across physical and transition risk dimensions
 */
app.post('/api/results/risk-dashboard', async (req, res) => {
  const { dbPath, scenarioA, scenarioB, lineItemCode, periodId, entityId, whatIfCombination } = req.body

  console.log('[risk-dashboard] Request received:', {
    scenarioA,
    scenarioB,
    lineItemCode,
    periodId,
    entityId,
    whatIfCombination
  })

  if (!dbPath || !scenarioA || !lineItemCode) {
    return res.status(400).json({ error: 'dbPath, scenarioA, and lineItemCode are required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: `Database error: ${err.message}` })
    }
  })

  try {
    // Get driver decomposition results
    // If scenarioB provided: Calculate delta (Test Case - Base Case)
    // If scenarioB is null: Return absolute values from scenarioA
    // In what-if mode, filter by action combination

    const isAbsoluteMode = !scenarioB

    const query = isAbsoluteMode ? `
      -- Absolute mode: just show scenarioA values
      SELECT
        srd.driver_code,
        d.name as driver_name,
        d.category,
        e.entity_id,
        e.json_metadata,
        SUM(srd.value) as impact
      FROM statement_result_by_driver srd
      JOIN driver d ON srd.driver_code = d.code
      JOIN entity e ON srd.entity_id = e.entity_id
      WHERE srd.scenario_id = ?
        AND srd.line_item_code = ?
        ${periodId ? 'AND srd.period_id = ?' : ''}
        ${entityId ? 'AND srd.entity_id = ?' : ''}
        ${whatIfCombination ? 'AND srd.what_if_combination = ?' : ''}
        AND d.category IN ('physical', 'financial')
      GROUP BY srd.driver_code, d.name, d.category, e.entity_id, e.json_metadata
    ` : `
      -- Delta mode: compare two scenarios
      WITH all_drivers AS (
        SELECT DISTINCT
          srd.driver_code,
          d.name as driver_name,
          d.category,
          e.entity_id,
          e.json_metadata
        FROM statement_result_by_driver srd
        JOIN driver d ON srd.driver_code = d.code
        JOIN entity e ON srd.entity_id = e.entity_id
        WHERE srd.scenario_id IN (?, ?)
          AND srd.line_item_code = ?
          ${periodId ? 'AND srd.period_id = ?' : ''}
          ${entityId ? 'AND srd.entity_id = ?' : ''}
          AND d.category IN ('physical', 'financial')
      ),
      scenario_a AS (
        SELECT
          srd.driver_code,
          e.entity_id,
          SUM(srd.value) as total_value
        FROM statement_result_by_driver srd
        JOIN entity e ON srd.entity_id = e.entity_id
        WHERE srd.scenario_id = ?
          AND srd.line_item_code = ?
          ${periodId ? 'AND srd.period_id = ?' : ''}
          ${entityId ? 'AND srd.entity_id = ?' : ''}
          ${whatIfCombination ? 'AND srd.what_if_combination = ?' : ''}
        GROUP BY srd.driver_code, e.entity_id
      ),
      scenario_b AS (
        SELECT
          srd.driver_code,
          e.entity_id,
          SUM(srd.value) as total_value
        FROM statement_result_by_driver srd
        JOIN entity e ON srd.entity_id = e.entity_id
        WHERE srd.scenario_id = ?
          AND srd.line_item_code = ?
          ${periodId ? 'AND srd.period_id = ?' : ''}
          ${entityId ? 'AND srd.entity_id = ?' : ''}
          ${whatIfCombination ? 'AND srd.what_if_combination = ?' : ''}
        GROUP BY srd.driver_code, e.entity_id
      )
      SELECT
        ad.driver_code,
        ad.driver_name,
        ad.category,
        ad.entity_id,
        ad.json_metadata,
        (COALESCE(a.total_value, 0) - COALESCE(b.total_value, 0)) as impact
      FROM all_drivers ad
      LEFT JOIN scenario_a a
        ON ad.driver_code = a.driver_code
        AND ad.entity_id = a.entity_id
      LEFT JOIN scenario_b b
        ON ad.driver_code = b.driver_code
        AND ad.entity_id = b.entity_id
    `

    // Build params array based on mode and optional filters
    let params = []

    if (isAbsoluteMode) {
      // Absolute mode: just scenarioA params
      params = [scenarioA, lineItemCode]
      if (periodId) params.push(periodId)
      if (entityId) params.push(entityId)
      if (whatIfCombination) params.push(whatIfCombination)
    } else {
      // Delta mode: all_drivers + scenario_a + scenario_b params
      const allDriversParams = [scenarioA, scenarioB, lineItemCode]
      if (periodId) allDriversParams.push(periodId)
      if (entityId) allDriversParams.push(entityId)

      const scenarioAParams = [scenarioA, lineItemCode]
      if (periodId) scenarioAParams.push(periodId)
      if (entityId) scenarioAParams.push(entityId)
      if (whatIfCombination) scenarioAParams.push(whatIfCombination)

      const scenarioBParams = [scenarioB, lineItemCode]
      if (periodId) scenarioBParams.push(periodId)
      if (entityId) scenarioBParams.push(entityId)
      if (whatIfCombination) scenarioBParams.push(whatIfCombination)

      params = [...allDriversParams, ...scenarioAParams, ...scenarioBParams]
    }

    const results = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })

    // Process results into physical/transition + country/driver breakdown
    // Store driver-country combinations for cross-filtering
    const physicalDriverCountries = [] // Array of { driver_code, driver_name, country, impact }
    const transitionDriverCountries = []
    const physicalCountries = new Map()
    const transitionCountries = new Map()

    results.forEach(row => {
      const metadata = typeof row.json_metadata === 'string'
        ? JSON.parse(row.json_metadata)
        : row.json_metadata
      const countries = metadata?.countries || []
      const isPhysical = row.category?.toLowerCase() === 'physical'
      const isTransition = row.category?.toLowerCase() === 'financial'

      // Store driver-country combinations
      countries.forEach(country => {
        if (isPhysical) {
          physicalDriverCountries.push({
            driver_code: row.driver_code,
            driver_name: row.driver_name,
            country: country,
            impact: row.impact
          })
          const current = physicalCountries.get(country) || 0
          physicalCountries.set(country, current + row.impact)
        } else if (isTransition) {
          transitionDriverCountries.push({
            driver_code: row.driver_code,
            driver_name: row.driver_name,
            country: country,
            impact: row.impact
          })
          const current = transitionCountries.get(country) || 0
          transitionCountries.set(country, current + row.impact)
        }
      })
    })

    // Aggregate drivers (sum across all countries for each driver)
    const aggregateDrivers = (driverCountryList) => {
      const driverMap = new Map()
      driverCountryList.forEach(item => {
        const key = item.driver_code
        if (!driverMap.has(key)) {
          driverMap.set(key, {
            driver_code: item.driver_code,
            driver_name: item.driver_name,
            impact: 0
          })
        }
        driverMap.get(key).impact += item.impact
      })
      return Array.from(driverMap.values())
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    }

    const formatCountryData = (countryMap) => {
      return Array.from(countryMap.entries())
        .map(([country, impact]) => ({
          country: country,
          impact: impact
        }))
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    }

    db.close()
    res.json({
      success: true,
      physicalDrivers: aggregateDrivers(physicalDriverCountries),
      transitionDrivers: aggregateDrivers(transitionDriverCountries),
      physicalCountries: formatCountryData(physicalCountries),
      transitionCountries: formatCountryData(transitionCountries),
      // Include driver-country detail for cross-filtering
      physicalDriverCountries,
      transitionDriverCountries
    })
  } catch (err) {
    db.close()
    res.status(500).json({ error: `Failed to load risk dashboard data: ${err.message}` })
  }
})

/**
 * Get period range for scenarios
 */
app.get('/api/results/period-range', async (req, res) => {
  const { dbPath, scenarioIds } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: `Database error: ${err.message}` })
    }
  })

  try {
    const ids = scenarioIds ? scenarioIds.split(',') : []
    const placeholders = ids.length > 0 ? ids.map(() => '?').join(',') : '?'
    const params = ids.length > 0 ? ids : [0]

    const query = `
      SELECT MIN(period_id) as min_period, MAX(period_id) as max_period
      FROM statement_result
      WHERE scenario_id IN (${placeholders})
    `

    const result = await new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })

    db.close()
    res.json({
      success: true,
      minPeriod: result.min_period || 1,
      maxPeriod: result.max_period || 20
    })
  } catch (err) {
    db.close()
    res.status(500).json({ error: `Failed to get period range: ${err.message}` })
  }
})

/**
 * Get available line items for risk dashboard
 */
app.get('/api/results/risk-line-items', async (req, res) => {
  const { dbPath } = req.query

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return res.status(500).json({ error: `Database error: ${err.message}` })
    }
  })

  try {
    // Only return line items that have driver decomposition data
    const query = `
      SELECT DISTINCT srd.line_item_code as code
      FROM statement_result_by_driver srd
      ORDER BY srd.line_item_code
    `

    const results = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })

    const lineItems = results.map(row => ({
      code: row.code,
      name: row.code.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ')
    }))

    db.close()
    res.json({ success: true, lineItems })
  } catch (err) {
    db.close()
    res.status(500).json({ error: `Failed to load line items: ${err.message}` })
  }
})

/**
 * Generate what-if combinations
 */
app.post('/api/whatif/combinations', async (req, res) => {
  const { dbPath } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: `Database error: ${err.message}` })
    }
  })

  try {
    const whatifService = new WhatIfService(db)
    const combinations = await whatifService.generateCombinations()

    db.close()
    res.json({ success: true, combinations })
  } catch (err) {
    db.close()
    res.status(500).json({ error: `Failed to generate combinations: ${err.message}` })
  }
})

/**
 * Prepare Monte Carlo simulation: Load correlation matrix and perform Cholesky decomposition
 */
app.post('/api/montecarlo/prepare', async (req, res) => {
  const { correlationCsvPath, dbPath, mappingId } = req.body

  if (!correlationCsvPath) {
    return res.status(400).json({ error: 'correlationCsvPath is required' })
  }

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  if (!mappingId) {
    return res.status(400).json({ error: 'mappingId is required' })
  }

  if (!fs.existsSync(correlationCsvPath)) {
    return res.status(400).json({ error: 'Correlation CSV file not found' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  try {
    // Read CSV file
    const csvContent = fs.readFileSync(correlationCsvPath, 'utf-8')
    const lines = csvContent.trim().split('\n')

    if (lines.length < 2) {
      return res.status(400).json({ error: 'Correlation CSV must have at least header and one data row' })
    }

    // Parse header to get CSV column names (skip first column)
    const header = lines[0].split(',')
    const csvColumnNames = header.slice(1) // Skip first column (Driver label)
    const n = csvColumnNames.length

    // Parse row names from first column (should match column names for symmetric matrix)
    const csvRowNames = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      csvRowNames.push(values[0].trim())
    }

    // Parse correlation matrix
    const correlationMatrix = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const row = values.slice(1).map(v => parseFloat(v.trim()))
      if (row.length !== n) {
        return res.status(400).json({
          error: `Row ${i} has ${row.length} values, expected ${n}`
        })
      }
      correlationMatrix.push(row)
    }

    if (correlationMatrix.length !== n) {
      return res.status(400).json({
        error: `Matrix should be ${n}x${n}, got ${correlationMatrix.length}x${n}`
      })
    }

    // Load scenario_mapping to get variable_mappings
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    const mapping = await new Promise((resolve, reject) => {
      db.get(
        'SELECT variable_mappings, driver_column FROM scenario_mapping WHERE mapping_id = ?',
        [mappingId],
        (err, row) => {
          if (err) reject(err)
          else if (!row) reject(new Error(`Scenario mapping ${mappingId} not found`))
          else resolve(row)
        }
      )
    })

    // Get the CSV staging table data to look up row names
    const stagingTableName = security.createNumberedStagingTableName(
      await new Promise((resolve, reject) => {
        db.get(
          'SELECT file_id FROM scenario_mapping WHERE mapping_id = ?',
          [mappingId],
          (err, row) => {
            if (err) reject(err)
            else if (!row) reject(new Error('File ID not found'))
            else resolve(security.validateFileId(row.file_id))
          }
        )
      })
    )

    const csvData = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM ${security.quoteIdentifier(stagingTableName)}`,
        [],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        }
      )
    })

    // Close database and wait for completion before continuing
    db.close((closeErr) => {
      if (closeErr) {
        return res.status(500).json({ error: 'Failed to close database: ' + closeErr.message })
      }

      const variableMappings = JSON.parse(mapping.variable_mappings)
      const driverColumn = mapping.driver_column

      // Map CSV row names to driver codes
      const driverCodes = []
      const unmappedRows = []

      for (let i = 0; i < csvRowNames.length; i++) {
        const csvRowName = csvRowNames[i]

        // Find the CSV row in staging table that matches this row name
        const csvRow = csvData.find(row => row[driverColumn] === csvRowName)

        if (!csvRow) {
          unmappedRows.push(csvRowName)
          driverCodes.push(null)
          continue
        }

        // Find the csv_row_index in staging table
        const csvRowIndex = csvData.indexOf(csvRow)

        // Find the variable mapping for this csv_row_index
        const varMapping = variableMappings.find(vm => vm.csv_row_index === csvRowIndex)

        if (!varMapping) {
          unmappedRows.push(csvRowName)
          driverCodes.push(null)
        } else {
          driverCodes.push(varMapping.driver_code)
        }
      }

      if (unmappedRows.length > 0) {
        return res.status(400).json({
          error: `Failed to map CSV row names to driver codes`,
          unmappedRows: unmappedRows,
          hint: 'Please ensure all drivers in the correlation matrix are mapped in the scenario mapping'
        })
      }

      // Perform Cholesky decomposition
      // L * L^T = Correlation Matrix
      const L = Array(n).fill(0).map(() => Array(n).fill(0))

      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          let sum = 0
          for (let k = 0; k < j; k++) {
            sum += L[i][k] * L[j][k]
          }

          if (i === j) {
            const diag = correlationMatrix[i][i] - sum
            if (diag <= 0) {
              return res.status(400).json({
                error: `Matrix is not positive definite (row ${i}: ${csvRowNames[i]})`
              })
            }
            L[i][j] = Math.sqrt(diag)
          } else {
            L[i][j] = (correlationMatrix[i][j] - sum) / L[j][j]
          }
        }
      }

      // Extract stddevs from covariance matrix diagonal
      // Covariance matrix diagonal contains variances: stddev = sqrt(variance)
      const stddevs = correlationMatrix.map((row, i) => Math.sqrt(Math.abs(row[i])))

      res.json({
        success: true,
        choleskyMatrix: L,
        driverCodes: driverCodes,
        stddevs: stddevs,
        csvRowNames: csvRowNames,
        dimension: n
      })
    })
  } catch (err) {
    res.status(500).json({ error: `Failed to prepare Monte Carlo: ${err.message}` })
  }
})

/**
 * Run calculation engine (with integrated validation and logging - Issues #12, #13, #14)
 */
app.post('/api/calculate', async (req, res) => {
  const { dbPath, scenarioIds, skipValidation = false, whatIfCombination, mcStartPeriod, mcDrawNumber, choleskyMatrix, choleskyDrivers, choleskyStddevs } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'dbPath is required' })
  }

  if (!fs.existsSync(dbPath)) {
    return res.status(400).json({ error: 'Database not found' })
  }

  // Initialize logging service
  const logger = new LoggingService()
  logger.start()
  logger.info('Calculation started', { dbPath, scenarioIds, mcStartPeriod, mcDrawNumber })

  // Write Cholesky data to temp file if provided (for MC draws)
  let choleskyFilePath = null
  if (choleskyMatrix && choleskyDrivers && mcDrawNumber) {
    const tempDir = path.join(__dirname, '../../temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    choleskyFilePath = path.join(tempDir, `cholesky_${Date.now()}_${mcDrawNumber}.json`)
    const choleskyData = {
      matrix: choleskyMatrix,
      drivers: choleskyDrivers,
      stddevs: choleskyStddevs || [],
      drawNumber: mcDrawNumber
    }

    try {
      fs.writeFileSync(choleskyFilePath, JSON.stringify(choleskyData, null, 2))
      logger.debug('Cholesky data written to temp file', { path: choleskyFilePath })
    } catch (err) {
      logger.error('Failed to write Cholesky temp file', { error: err.message })
      return res.status(500).json({ error: 'Failed to write Cholesky data: ' + err.message })
    }
  }

  // Validate scenarios before calculation (unless explicitly skipped)
  if (!skipValidation && scenarioIds && scenarioIds.length > 0) {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY)
    const validationService = new ValidationService(db)

    try {
      logger.info('Running pre-calculation validation', { scenarioCount: scenarioIds.length })

      const validationResults = []
      for (const scenarioId of scenarioIds) {
        logger.verbose(`Validating scenario ${scenarioId}`)
        const result = await validationService.validateScenario(scenarioId)
        validationResults.push({ scenarioId, ...result })

        // Log validation results
        if (result.errors.length > 0) {
          result.errors.forEach(err => logger.error(`Scenario ${scenarioId}: ${err.message}`, { code: err.code }))
        }
        if (result.warnings.length > 0) {
          result.warnings.forEach(warn => logger.warn(`Scenario ${scenarioId}: ${warn.message}`, { code: warn.code }))
        }
        result.info.forEach(info => logger.debug(`Scenario ${scenarioId}: ${info.message}`, { code: info.code }))
      }

      db.close()

      // Check if any validation failed
      const hasErrors = validationResults.some(r => !r.valid)
      if (hasErrors) {
        logger.error('Pre-calculation validation failed', {
          failedCount: validationResults.filter(r => !r.valid).length,
          totalCount: validationResults.length
        })
        return res.json({
          success: false,
          error: 'Pre-calculation validation failed. Fix errors before running calculation.',
          validationResults,
          logs: logger.getLogs('info')
        })
      }

      logger.info('Pre-calculation validation passed', { scenarioCount: scenarioIds.length })
    } catch (validationError) {
      db.close()
      logger.error('Validation error', { error: validationError.message })
      return res.status(500).json({
        success: false,
        error: 'Validation failed: ' + validationError.message,
        logs: logger.getLogs('info')
      })
    }
  }

  // Run the calculation
  const calculationBinary = path.join(__dirname, '../../build/bin/run_calculation')
  logger.info('Launching C++ calculation engine', { binary: calculationBinary, whatIfCombination, mcStartPeriod })

  // Build command with optional flags
  let command = `"${calculationBinary}" "${dbPath}"`
  if (whatIfCombination) {
    command += ` --whatif-combination "${whatIfCombination}"`
  }
  if (mcStartPeriod) {
    command += ` --mc-start-period ${mcStartPeriod}`
  }
  if (choleskyFilePath) {
    command += ` --cholesky-file "${choleskyFilePath}"`
  }

  exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    // Clean up Cholesky temp file
    if (choleskyFilePath && fs.existsSync(choleskyFilePath)) {
      try {
        fs.unlinkSync(choleskyFilePath)
        logger.debug('Cholesky temp file cleaned up', { path: choleskyFilePath })
      } catch (cleanupErr) {
        logger.warn('Failed to delete Cholesky temp file', { error: cleanupErr.message })
      }
    }

    // Merge C++ logs
    if (stdout) {
      logger.mergeCppLogs(stdout)
    }
    if (stderr) {
      logger.mergeCppLogs(stderr)
    }

    if (error) {
      logger.error('Calculation engine failed', { error: error.message, exitCode: error.code })
      return res.json({
        success: false,
        error: error.message,
        stdout: stdout,
        stderr: stderr,
        logs: logger.getLogs('info'),
        errorSummary: logger.getErrorSummary()
      })
    }

    logger.info('Calculation completed successfully')

    // If this is a Monte Carlo draw, copy results to MC tables
    if (mcDrawNumber) {
      logger.info(`Copying results to MC tables for draw ${mcDrawNumber}`)

      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Failed to open database for MC result copy', { error: err.message })
          return res.json({
            success: true,
            output: stdout,
            errors: stderr,
            warning: 'Calculation succeeded but failed to copy to MC tables',
            logs: logger.getLogs('info'),
            errorSummary: logger.getErrorSummary()
          })
        }

        // Copy statement_result to mc_statement_result
        db.run(`
          INSERT INTO mc_statement_result
            (scenario_id, period_id, entity_id, line_item_code, draw_number, value, calculated_at, is_populated)
          SELECT scenario_id, period_id, entity_id, line_item_code, ?, value, calculated_at, is_populated
          FROM statement_result
          WHERE what_if_combination = ''
        `, [mcDrawNumber], (err) => {
          if (err) {
            logger.error('Failed to copy to mc_statement_result', { error: err.message, draw: mcDrawNumber })
            db.close()
            return res.json({
              success: true,
              output: stdout,
              errors: stderr,
              warning: 'Failed to copy results to mc_statement_result',
              logs: logger.getLogs('info'),
              errorSummary: logger.getErrorSummary()
            })
          }

          logger.verbose(`Copied statement_result to mc_statement_result for draw ${mcDrawNumber}`)

          // Copy statement_result_by_driver to mc_statement_result_by_driver
          db.run(`
            INSERT INTO mc_statement_result_by_driver
              (scenario_id, period_id, entity_id, line_item_code, driver_code, draw_number, value, calculated_at)
            SELECT scenario_id, period_id, entity_id, line_item_code, driver_code, ?, value, calculated_at
            FROM statement_result_by_driver
            WHERE what_if_combination = ''
          `, [mcDrawNumber], (err) => {
            if (err) {
              logger.error('Failed to copy to mc_statement_result_by_driver', { error: err.message, draw: mcDrawNumber })
              db.close()
              return res.json({
                success: true,
                output: stdout,
                errors: stderr,
                warning: 'Failed to copy results to mc_statement_result_by_driver',
                logs: logger.getLogs('info'),
                errorSummary: logger.getErrorSummary()
              })
            }

            logger.verbose(`Copied statement_result_by_driver to mc_statement_result_by_driver for draw ${mcDrawNumber}`)
            logger.info(`MC draw ${mcDrawNumber} results saved successfully`)

            db.close((closeErr) => {
              if (closeErr) {
                logger.error('Failed to close database', { error: closeErr.message })
              }
              res.json({
                success: true,
                output: stdout,
                errors: stderr,
                logs: logger.getLogs('info'),
                errorSummary: logger.getErrorSummary()
              })
            })
          })
        })
      })
    } else {
      // Not a Monte Carlo draw - just return success
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Failed to open database for result verification', { error: err.message })
          return res.json({
            success: true,
            output: stdout,
            errors: stderr,
            warning: 'Results calculated but not saved to database',
            logs: logger.getLogs('info'),
            errorSummary: logger.getErrorSummary()
          })
        }

        // Note: The C++ binary should be writing results directly to the database
        // This is just a fallback/verification step
        db.close()

        res.json({
          success: true,
          output: stdout,
          errors: stderr,
          logs: logger.getLogs('info'),
          errorSummary: logger.getErrorSummary()
        })
      })
    }
  })
})

/**
 * ======================
 * Saved Runs API Endpoints
 * ======================
 */

/**
 * Save current run (snapshot all tables + config)
 */
app.post('/api/runs/save', express.json(), (req, res) => {
  const { dbPath, runName, runDescription, config } = req.body

  console.log('[Save Run] Request received:', { dbPath, runName, runDescription, hasConfig: !!config })

  if (!dbPath || !runName || !config) {
    console.error('[Save Run] Missing required fields')
    return res.status(400).json({ error: 'Missing required fields: dbPath, runName, config' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }

    // Capture snapshot of all relevant tables
    const snapshot = {}

    db.serialize(() => {
      // Get staged_file with csv_content
      db.all('SELECT * FROM staged_file', (err, rows) => {
        if (err) {
          console.error('[Save Run] Failed to query staged_file:', err.message)
          db.close()
          return res.status(500).json({ error: 'Failed to query staged_file: ' + err.message })
        }
        snapshot.staged_file = rows

        // Get scenario
        db.all('SELECT * FROM scenario', (err, rows) => {
          if (err) {
            db.close()
            return res.status(500).json({ error: 'Failed to query scenario: ' + err.message })
          }
          snapshot.scenario = rows

          // Get scenario_drivers
          db.all('SELECT * FROM scenario_drivers', (err, rows) => {
            if (err) {
              db.close()
              return res.status(500).json({ error: 'Failed to query scenario_drivers: ' + err.message })
            }
            snapshot.scenario_drivers = rows

            // Get statement_result
            db.all('SELECT * FROM statement_result', (err, rows) => {
              if (err) {
                db.close()
                return res.status(500).json({ error: 'Failed to query statement_result: ' + err.message })
              }
              snapshot.statement_result = rows

              // Get pl_result
              db.all('SELECT * FROM pl_result', (err, rows) => {
                if (err) {
                  db.close()
                  return res.status(500).json({ error: 'Failed to query pl_result: ' + err.message })
                }
                snapshot.pl_result = rows

                // Get bs_result
                db.all('SELECT * FROM bs_result', (err, rows) => {
                  if (err) {
                    db.close()
                    return res.status(500).json({ error: 'Failed to query bs_result: ' + err.message })
                  }
                  snapshot.bs_result = rows

                  // Get cf_result
                  db.all('SELECT * FROM cf_result', (err, rows) => {
                    if (err) {
                      db.close()
                      return res.status(500).json({ error: 'Failed to query cf_result: ' + err.message })
                    }
                    snapshot.cf_result = rows

                    // Get carbon_result
                    db.all('SELECT * FROM carbon_result', (err, rows) => {
                      if (err) {
                        db.close()
                        return res.status(500).json({ error: 'Failed to query carbon_result: ' + err.message })
                      }
                      snapshot.carbon_result = rows

                      // Get statement_mapping
                      db.all('SELECT * FROM statement_mapping', (err, rows) => {
                        if (err) {
                          db.close()
                          return res.status(500).json({ error: 'Failed to query statement_mapping: ' + err.message })
                        }
                        snapshot.statement_mapping = rows

                      // Save to saved_runs table
                      const stmt = db.prepare(`
                        INSERT INTO saved_runs (run_name, run_description, config_data, snapshot_data)
                        VALUES (?, ?, ?, ?)
                      `)

                      stmt.run(
                        runName,
                        runDescription || '',
                        JSON.stringify(config),
                        JSON.stringify(snapshot),
                        function (err) {
                          if (err) {
                            console.error('[Save Run] Database insert error:', err.message)
                            db.close()
                            return res.status(500).json({ error: 'Failed to save run: ' + err.message })
                          }

                          console.log('[Save Run] Successfully saved run with ID:', this.lastID)
                          db.close()
                          res.json({ success: true, runId: this.lastID, message: 'Run saved successfully' })
                        }
                      )
                      stmt.finalize()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})

/**
 * List all saved runs
 */
app.get('/api/runs/list', (req, res) => {
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath parameter' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }

    db.all(
      'SELECT run_id, run_name, run_description, saved_at, config_data FROM saved_runs ORDER BY saved_at DESC',
      (err, rows) => {
        db.close()

        if (err) {
          return res.status(500).json({ error: 'Failed to list runs: ' + err.message })
        }

        // Parse config_data for each row
        const runs = rows.map(row => ({
          run_id: row.run_id,
          run_name: row.run_name,
          run_description: row.run_description,
          saved_at: row.saved_at,
          config: JSON.parse(row.config_data)
        }))

        res.json({ success: true, runs })
      }
    )
  })
})

/**
 * Restore a saved run
 */
app.post('/api/runs/restore', express.json(), (req, res) => {
  const { dbPath, runId } = req.body

  if (!dbPath || !runId) {
    return res.status(400).json({ error: 'Missing required fields: dbPath, runId' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }

    // Get the saved run
    db.get('SELECT snapshot_data, config_data FROM saved_runs WHERE run_id = ?', [runId], (err, row) => {
      if (err) {
        db.close()
        return res.status(500).json({ error: 'Failed to retrieve run: ' + err.message })
      }

      if (!row) {
        db.close()
        return res.status(404).json({ error: 'Run not found' })
      }

      const snapshot = JSON.parse(row.snapshot_data)
      const config = JSON.parse(row.config_data)

      db.serialize(() => {
        // Wrap entire restore in a transaction for atomicity
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Failed to begin transaction:', err)
            db.close()
            return res.status(500).json({ error: 'Failed to begin transaction: ' + err.message })
          }
        })

        // Clear only OUTPUT data - preserve templates and definitions
        console.log('[Restore Run] Clearing output data...')
        db.run('DELETE FROM statement_result')
        db.run('DELETE FROM pl_result')
        db.run('DELETE FROM bs_result')
        db.run('DELETE FROM cf_result')
        db.run('DELETE FROM carbon_result')

        // Clear INPUT data for this specific run
        db.run('DELETE FROM staged_file')
        db.run('DELETE FROM scenario')
        db.run('DELETE FROM scenario_drivers')

        // DO NOT delete: entity, statement_template, line_item_template, formula, validation_rule, etc.
        console.log('[Restore Run] Cleared transient data, preserving schema definitions')

        // Restore staged_file
        if (snapshot.staged_file && snapshot.staged_file.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO staged_file (file_id, file_name, file_type, row_count, uploaded_at, is_valid, csv_content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          snapshot.staged_file.forEach(row => {
            stmt.run(row.file_id, row.file_name, row.file_type, row.row_count, row.uploaded_at, row.is_valid, row.csv_content)
          })
          stmt.finalize()
        }

        // Restore scenario with ALL required fields
        if (snapshot.scenario && snapshot.scenario.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO scenario (
              scenario_id, code, name, description, parent_scenario_id,
              json_drivers, statement_template_id, tax_strategy_id,
              base_currency, enable_lineage_tracking, created_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          snapshot.scenario.forEach(row => {
            stmt.run(
              row.scenario_id,
              row.code,
              row.name || row.code,  // Use code as fallback for name
              row.description,
              row.parent_scenario_id,
              row.json_drivers || '[]',
              row.statement_template_id,
              row.tax_strategy_id || 1,
              row.base_currency || 'USD',
              row.enable_lineage_tracking !== undefined ? row.enable_lineage_tracking : 1,
              row.created_at,
              row.created_by
            )
          })
          stmt.finalize()
        }

        // Restore scenario_drivers with current schema
        if (snapshot.scenario_drivers && snapshot.scenario_drivers.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO scenario_drivers (
              entity_id, scenario_id, period_id, driver_code, value, unit_code, is_populated
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          snapshot.scenario_drivers.forEach(row => {
            stmt.run(
              row.entity_id || '97',  // Use saved entity_id or default
              row.scenario_id,
              row.period_id,
              row.driver_code,
              row.value,
              row.unit_code || row.unit || 'CHF',  // Handle old 'unit' field name
              row.is_populated !== undefined ? row.is_populated : 1
            )
          })
          stmt.finalize()
        }

        // Restore statement_result
        if (snapshot.statement_result && snapshot.statement_result.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO statement_result (scenario_id, period_id, entity_id, line_item_code, value, is_populated)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          snapshot.statement_result.forEach(row => {
            stmt.run(
              row.scenario_id,
              row.period_id,
              row.entity_id,
              row.line_item_code,
              row.value,
              row.is_populated !== undefined ? row.is_populated : 1
            )
          })
          stmt.finalize()
        }

        // Restore pl_result
        if (snapshot.pl_result && snapshot.pl_result.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO pl_result (scenario_id, period_id, entity_id, line_item_code, value, is_populated)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          snapshot.pl_result.forEach(row => {
            stmt.run(row.scenario_id, row.period_id, row.entity_id, row.line_item_code, row.value, row.is_populated !== undefined ? row.is_populated : 1)
          })
          stmt.finalize()
        }

        // Restore bs_result
        if (snapshot.bs_result && snapshot.bs_result.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO bs_result (scenario_id, period_id, entity_id, line_item_code, value, is_populated)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          snapshot.bs_result.forEach(row => {
            stmt.run(row.scenario_id, row.period_id, row.entity_id, row.line_item_code, row.value, row.is_populated !== undefined ? row.is_populated : 1)
          })
          stmt.finalize()
        }

        // Restore cf_result
        if (snapshot.cf_result && snapshot.cf_result.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO cf_result (scenario_id, period_id, entity_id, line_item_code, value, is_populated)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          snapshot.cf_result.forEach(row => {
            stmt.run(row.scenario_id, row.period_id, row.entity_id, row.line_item_code, row.value, row.is_populated !== undefined ? row.is_populated : 1)
          })
          stmt.finalize()
        }

        // Restore carbon_result
        if (snapshot.carbon_result && snapshot.carbon_result.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO carbon_result (scenario_id, period_id, entity_id, line_item_code, value, is_populated)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          snapshot.carbon_result.forEach(row => {
            stmt.run(row.scenario_id, row.period_id, row.entity_id, row.line_item_code, row.value, row.is_populated !== undefined ? row.is_populated : 1)
          })
          stmt.finalize()
        }

        // Restore statement_mapping
        if (snapshot.statement_mapping && snapshot.statement_mapping.length > 0) {
          // First clear existing mappings
          db.run('DELETE FROM statement_mapping')

          const stmt = db.prepare(`
            INSERT INTO statement_mapping (mapping_id, template_code, statement_type, company_id, column_mapping, csv_file_name, created_at, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          snapshot.statement_mapping.forEach(row => {
            stmt.run(
              row.mapping_id,
              row.template_code,
              row.statement_type,
              row.company_id,
              row.column_mapping,
              row.csv_file_name,
              row.created_at,
              row.last_updated
            )
          })
          stmt.finalize()
        }

        // Commit the transaction
        db.run('COMMIT', (err) => {
          if (err) {
            console.error('Failed to commit transaction:', err)
            db.run('ROLLBACK')
            db.close()
            return res.status(500).json({ error: 'Failed to restore run: ' + err.message })
          }

          console.log('[Restore Run] Transaction committed successfully')
          db.close()
          res.json({ success: true, config, message: 'Run restored successfully' })
        })
      })
    })
  })
})

/**
 * Delete a saved run
 */
app.delete('/api/runs/:runId', (req, res) => {
  const dbPath = req.query.dbPath
  const runId = req.params.runId

  if (!dbPath || !runId) {
    return res.status(400).json({ error: 'Missing dbPath or runId' })
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to connect to database' })
    }

    db.run('DELETE FROM saved_runs WHERE run_id = ?', [runId], function (err) {
      db.close()

      if (err) {
        return res.status(500).json({ error: 'Failed to delete run: ' + err.message })
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Run not found' })
      }

      res.json({ success: true, message: 'Run deleted successfully' })
    })
  })
})

// ============================================================================
// STAGING TABLE MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * List all staging tables with optional filters
 * GET /api/staging/list?dbPath=...&dataType=scenario&status=pending
 */
app.get('/api/staging/list', async (req, res) => {
  try {
    const { dbPath, dataType, status } = req.query

    if (!dbPath) {
      return res.status(400).json({ error: 'dbPath is required' })
    }

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Database not found' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    const tables = await stagingService.listStagingTables(dataType, status)

    db.close()
    res.json({ success: true, tables })
  } catch (error) {
    console.error('List staging tables error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Find orphaned staging tables (tables exist but not tracked in metadata)
 * GET /api/staging/orphaned?dbPath=...
 * NOTE: Must be before :stagingId route to avoid conflict
 */
app.get('/api/staging/orphaned', async (req, res) => {
  try {
    const { dbPath } = req.query

    if (!dbPath) {
      return res.status(400).json({ error: 'dbPath is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    const orphaned = await stagingService.findOrphanedTables()

    db.close()
    res.json({
      success: true,
      orphanedTables: orphaned,
      count: orphaned.length
    })
  } catch (error) {
    console.error('Find orphaned tables error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Get details of a specific staging table
 * GET /api/staging/:stagingId?dbPath=...
 */
app.get('/api/staging/:stagingId', async (req, res) => {
  try {
    const { dbPath } = req.query
    const { stagingId } = req.params

    if (!dbPath) {
      return res.status(400).json({ error: 'dbPath is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    const info = await stagingService.getStagingInfo(parseInt(stagingId))

    if (!info) {
      db.close()
      return res.status(404).json({ error: 'Staging table not found' })
    }

    db.close()
    res.json({ success: true, staging: info })
  } catch (error) {
    console.error('Get staging info error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Delete a specific staging table
 * DELETE /api/staging/:stagingId?dbPath=...
 */
app.delete('/api/staging/:stagingId', async (req, res) => {
  try {
    const { dbPath } = req.query
    const { stagingId } = req.params

    if (!dbPath) {
      return res.status(400).json({ error: 'dbPath is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    await stagingService.deleteStagingTable(parseInt(stagingId))

    db.close()
    res.json({ success: true, message: 'Staging table deleted successfully' })
  } catch (error) {
    console.error('Delete staging table error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Cleanup old staging tables
 * POST /api/staging/cleanup
 * Body: { dbPath, daysOld }
 */
app.post('/api/staging/cleanup', async (req, res) => {
  try {
    const { dbPath, daysOld = 7 } = req.body

    if (!dbPath) {
      return res.status(400).json({ error: 'dbPath is required' })
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE)
    const stagingService = new StagingService(db)

    const result = await stagingService.cleanupOldTables(daysOld)

    db.close()
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} of ${result.totalFound} old staging tables`,
      deletedCount: result.deletedCount,
      totalFound: result.totalFound
    })
  } catch (error) {
    console.error('Cleanup staging tables error:', error)
    res.status(500).json({ success: false, error: error.message })
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

/**
 * ======================
 * Database Backup/Restore API Endpoints
 * ======================
 */

/**
 * Create database backup
 */
app.post('/api/database/backup', express.json(), (req, res) => {
  const { dbPath } = req.body

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath parameter' })
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const backupPath = path.join(backupDir, `finmodel_backup_${timestamp}.db`)

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // Copy database file
    fs.copyFileSync(dbPath, backupPath)

    console.log(`[Backup] Created backup: ${backupPath}`)
    res.json({ 
      success: true, 
      backupPath,
      timestamp,
      message: 'Backup created successfully' 
    })
  } catch (err) {
    console.error('[Backup] Error:', err.message)
    res.status(500).json({ error: 'Failed to create backup: ' + err.message })
  }
})

/**
 * Delete database backup
 */
app.delete('/api/database/backup', express.json(), (req, res) => {
  const { backupPath } = req.body

  if (!backupPath) {
    return res.status(400).json({ error: 'Missing backupPath parameter' })
  }

  try {
    // Verify the file exists and is in the backups directory
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' })
    }

    // Safety check: ensure the file is in a backups directory
    if (!backupPath.includes('/backups/') && !backupPath.includes('\\backups\\')) {
      return res.status(403).json({ error: 'Can only delete files from backups directory' })
    }

    // Delete the backup file
    fs.unlinkSync(backupPath)

    console.log(`[Backup] Deleted backup: ${backupPath}`)
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    })
  } catch (err) {
    console.error('[Backup] Delete error:', err.message)
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message })
  }
})

/**
 * List available backups
 */
app.get('/api/database/backups', (req, res) => {
  const dbPath = req.query.dbPath

  if (!dbPath) {
    return res.status(400).json({ error: 'Missing dbPath parameter' })
  }

  const backupDir = path.join(path.dirname(dbPath), 'backups')

  try {
    if (!fs.existsSync(backupDir)) {
      return res.json({ success: true, backups: [] })
    }

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fullPath = path.join(backupDir, f)
        const stats = fs.statSync(fullPath)
        return {
          filename: f,
          path: fullPath,
          size: stats.size,
          created: stats.mtime.toISOString()
        }
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created))

    res.json({ success: true, backups: files })
  } catch (err) {
    console.error('[Backups List] Error:', err.message)
    res.status(500).json({ error: 'Failed to list backups: ' + err.message })
  }
})

/**
 * Restore database from backup
 */
app.post('/api/database/restore', express.json(), (req, res) => {
  const { dbPath, backupPath } = req.body

  if (!dbPath || !backupPath) {
    return res.status(400).json({ error: 'Missing dbPath or backupPath parameter' })
  }

  try {
    // Verify backup exists
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' })
    }

    // Create a safety backup of current state before restoring
    const safetyBackupPath = dbPath + '.before_restore'
    fs.copyFileSync(dbPath, safetyBackupPath)

    // Restore from backup
    fs.copyFileSync(backupPath, dbPath)

    console.log(`[Restore] Restored from backup: ${backupPath}`)
    res.json({
      success: true,
      message: 'Database restored successfully',
      safetyBackupPath
    })
  } catch (err) {
    console.error('[Restore] Error:', err.message)
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message })
  }
})

/**
 * Physical Risk Calculation Endpoint
 * POST /api/physical-risk/calculate
 * Body: { scenario_id, dbPath }
 */
app.post('/api/physical-risk/calculate', express.json(), async (req, res) => {
  const { scenario_id, dbPath } = req.body

  if (!scenario_id || !dbPath) {
    return res.status(400).json({ error: 'Missing scenario_id or dbPath' })
  }

  console.log(`[Physical Risk] Starting calculation for scenario ${scenario_id}`)

  let db = null

  try {
    // Open database
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error('[Physical Risk] Database connection error:', err)
        return res.status(500).json({ error: 'Failed to connect to database: ' + err.message })
      }
    })

    // Set short timeout and disable WAL mode to avoid persistent locks
    await new Promise((resolve, reject) => {
      db.run('PRAGMA busy_timeout = 5000', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    await new Promise((resolve, reject) => {
      db.run('PRAGMA journal_mode = DELETE', (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Promisify database methods
    const dbAll = (query, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err)
          else resolve(rows)
        })
      })
    }

    const dbRun = (query, params = []) => {
      return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
          if (err) reject(err)
          else resolve(this)
        })
      })
    }

    // Get hazard map IDs linked to this scenario
    // First get the scenario code for this scenario_id
    const scenarioInfo = await dbAll(`SELECT code FROM scenario WHERE scenario_id = ?`, [scenario_id])
    if (scenarioInfo.length === 0) {
      console.log(`[Physical Risk] Scenario ${scenario_id} not found`)
      db.close()
      return res.json({ success: true, message: 'Scenario not found', calculated: false })
    }
    const scenarioCode = scenarioInfo[0].code

    // Get hazard map links with peril type from the mapping table
    const hazardMapLinks = await dbAll(`
      SELECT DISTINCT
        hms.mapping_id as hazard_map_id,
        hmm.peril_type as peril_type
      FROM hazard_map_scenario hms
      JOIN hazard_map_mapping hmm ON hms.mapping_id = hmm.mapping_id
      WHERE hms.scenario_code = ?
    `, [scenarioCode])

    if (hazardMapLinks.length === 0) {
      console.log(`[Physical Risk] No hazard maps linked to scenario ${scenario_id}`)
      db.close()
      return res.json({ success: true, message: 'No hazard maps found for scenario', calculated: false })
    }

    console.log(`[Physical Risk] Found ${hazardMapLinks.length} hazard map(s)`)

    // Get all locations
    const locations = await dbAll(`SELECT * FROM location`)

    if (locations.length === 0) {
      console.log(`[Physical Risk] No locations found`)
      db.close()
      return res.json({ success: true, message: 'No locations found', calculated: false })
    }

    console.log(`[Physical Risk] Found ${locations.length} location(s)`)

    // Get all damage curves
    const damageCurves = await dbAll(`SELECT * FROM damage_curve`)

    if (damageCurves.length === 0) {
      console.log(`[Physical Risk] No damage curves found`)
      db.close()
      return res.json({ success: true, message: 'No damage curves found', calculated: false })
    }

    console.log(`[Physical Risk] Found ${damageCurves.length} damage curve(s)`)

    // Clear previous results for this scenario
    await dbRun(`DELETE FROM physical_risk_result WHERE scenario_id = ?`, [scenario_id])

    // Process each hazard map
    for (const hazardMapLink of hazardMapLinks) {
      console.log(`[Physical Risk] Processing hazard map ${hazardMapLink.hazard_map_id} (peril: ${hazardMapLink.peril_type})`)

      // Get file_id for this hazard map from hazard_map_mapping table
      // mapping_id is the primary key in hazard_map_mapping
      const mapMappingInfo = await dbAll(`
        SELECT file_id FROM hazard_map_mapping WHERE mapping_id = ?
      `, [hazardMapLink.hazard_map_id])

      if (mapMappingInfo.length === 0) {
        console.log(`[Physical Risk] No hazard map mapping found for mapping_id ${hazardMapLink.hazard_map_id}`)
        continue
      }

      const fileId = mapMappingInfo[0].file_id

      // Get the staging table name from staging_metadata
      const stagingInfo = await dbAll(`
        SELECT staging_table_name FROM staging_metadata WHERE file_id = ? AND data_type = 'hazard_map'
      `, [fileId])

      if (stagingInfo.length === 0) {
        console.log(`[Physical Risk] No staging table found for file_id ${fileId}`)
        continue
      }

      const stagingTableName = stagingInfo[0].staging_table_name

      // Validate table name format for security
      if (!/^staging_hazard_map(_\d+)?$/.test(stagingTableName)) {
        console.log(`[Physical Risk] Invalid staging table name format: ${stagingTableName}`)
        continue
      }

      console.log(`[Physical Risk] Loading grid data from ${stagingTableName} for file_id ${fileId}...`)

      // Get all grid points from the dynamic staging table
      const hazardMapGrid = await dbAll(`
        SELECT * FROM ${security.quoteIdentifier(stagingTableName)}
      `)

      if (hazardMapGrid.length === 0) {
        console.log(`[Physical Risk] No grid points found in ${stagingTableName}`)
        continue
      }

      console.log(`[Physical Risk] Loaded ${hazardMapGrid.length} grid points`)

      // Build grid data from all grid points
      const gridData = buildGridFromHazardMap(hazardMapGrid)

      // Call Python interpolation service
      const interpolatedResults = await callPythonInterpolation(
        locations,
        gridData,
        hazardMapLink.peril_type
      )

      // Calculate damages and save results
      await calculateAndSaveDamages(
        db,
        dbRun,
        scenario_id,
        locations,
        interpolatedResults,
        damageCurves,
        hazardMapLink.peril_type
      )
    }

    // Aggregate to entity level and populate scenario_drivers
    await aggregateToDrivers(db, dbAll, dbRun, scenario_id)

    // Close database connection BEFORE sending response to avoid lock issues
    await new Promise((resolve) => {
      db.close((err) => {
        if (err) console.error('[Physical Risk] Error closing database:', err)
        resolve()
      })
    })

    console.log(`[Physical Risk] Calculation completed successfully`)
    res.json({ success: true, message: 'Physical risk calculated successfully', calculated: true })

  } catch (err) {
    console.error('[Physical Risk] Error:', err)
    // Close database on error too
    if (db) {
      await new Promise((resolve) => {
        db.close((err) => {
          if (err) console.error('[Physical Risk] Error closing database:', err)
          resolve()
        })
      })
    }
    res.status(500).json({ error: 'Physical risk calculation failed: ' + err.message })
  }
})

/**
 * Build grid data structure from hazard map staging table rows
 * @param {Array} hazardMapGrid - Array of grid point rows from dynamic staging table
 */
function buildGridFromHazardMap(hazardMapGrid) {
  const gridLats = []
  const gridLons = []
  const gridValues = []
  const gridVariances = []

  if (hazardMapGrid.length === 0) {
    return {
      grid_lats: [],
      grid_lons: [],
      grid_values: [],
      grid_variances: [],
      n_periods: 0
    }
  }

  // Parse dynamic period columns from first row
  // Columns are like: period_1_intensity_m, period_2_intensity_m, ..., period_1_variance, period_2_variance, ...
  const firstRow = hazardMapGrid[0]
  const periodCols = []
  const varianceCols = []

  for (const key in firstRow) {
    if (key.match(/^period_\d+_intensity/) || key.match(/^period_\d+$/) && !key.includes('var')) {
      periodCols.push(key)
    } else if (key.match(/^period_\d+_var/)) {
      varianceCols.push(key)
    }
  }

  // Sort columns numerically
  periodCols.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0])
    const numB = parseInt(b.match(/\d+/)[0])
    return numA - numB
  })

  varianceCols.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)[0])
    const numB = parseInt(b.match(/\d+/)[0])
    return numA - numB
  })

  // Process each grid point
  for (const row of hazardMapGrid) {
    gridLats.push(parseFloat(row.latitude))
    gridLons.push(parseFloat(row.longitude))

    const values = []
    const variances = []

    for (const col of periodCols) {
      values.push(parseFloat(row[col]) || 0)
    }

    for (const col of varianceCols) {
      variances.push(parseFloat(row[col]) || 0)
    }

    gridValues.push(values)
    gridVariances.push(variances)
  }

  return {
    grid_lats: gridLats,
    grid_lons: gridLons,
    grid_values: gridValues,
    grid_variances: gridVariances,
    n_periods: periodCols.length
  }
}

/**
 * Simple bilinear interpolation (replaces Python service)
 */
async function callPythonInterpolation(locations, gridData, perilType) {
  const nPoints = gridData.grid_lats.length
  const nPeriods = gridData.n_periods

  console.log(`[Physical Risk] Performing bilinear interpolation for ${perilType}`)
  console.log(`[Physical Risk] Grid: ${nPoints} points, ${nPeriods} periods`)
  console.log(`[Physical Risk] Targets: ${locations.length} locations`)

  const results = []

  for (const location of locations) {
    const targetLat = location.latitude
    const targetLon = location.longitude

    // Find the 4 nearest grid points for bilinear interpolation
    let closestPoints = []

    for (let i = 0; i < nPoints; i++) {
      const gridLat = gridData.grid_lats[i]
      const gridLon = gridData.grid_lons[i]

      // Calculate simple distance (not haversine for speed)
      const dist = Math.sqrt(
        Math.pow(targetLat - gridLat, 2) +
        Math.pow(targetLon - gridLon, 2)
      )

      closestPoints.push({ index: i, dist, lat: gridLat, lon: gridLon })
    }

    // Sort by distance and take 4 closest
    closestPoints.sort((a, b) => a.dist - b.dist)
    closestPoints = closestPoints.slice(0, 4)

    // Interpolate values for each period
    const interpolatedValues = []
    const interpolatedVariances = []

    for (let period = 0; period < nPeriods; period++) {
      if (closestPoints[0].dist < 0.01) {
        // Very close to a grid point, use it directly
        const idx = closestPoints[0].index
        interpolatedValues.push(gridData.grid_values[idx][period])
        interpolatedVariances.push(gridData.grid_variances[idx][period])
      } else {
        // Inverse distance weighted average
        let totalWeight = 0
        let weightedValue = 0
        let weightedVariance = 0

        for (const point of closestPoints) {
          const weight = 1.0 / (point.dist + 0.0001) // Avoid division by zero
          weightedValue += gridData.grid_values[point.index][period] * weight
          weightedVariance += gridData.grid_variances[point.index][period] * weight
          totalWeight += weight
        }

        interpolatedValues.push(weightedValue / totalWeight)
        interpolatedVariances.push(weightedVariance / totalWeight)
      }
    }

    results.push({
      location_id: location.location_id,
      latitude: targetLat,
      longitude: targetLon,
      values: interpolatedValues,
      variances: interpolatedVariances,
      method: 'bilinear'
    })
  }

  console.log(`[Physical Risk] Interpolation completed using bilinear method`)
  return results
}

/**
 * Calculate damages and save to physical_risk_result table
 */
async function calculateAndSaveDamages(db, dbRun, scenario_id, locations, interpolatedResults, damageCurves, perilType) {
  console.log(`[Physical Risk] Calculating damages for ${locations.length} locations`)

  let insertCount = 0

  for (let locIdx = 0; locIdx < locations.length; locIdx++) {
    const location = locations[locIdx]
    const assetValues = JSON.parse(location.json_values || '{}')
    const interpResult = interpolatedResults[locIdx]

    for (let period = 0; period < interpResult.values.length; period++) {
      const intensity = interpResult.values[period]
      const spatialVariance = interpResult.variances[period]

      // Find matching damage curves for this location's archetype and peril (case-insensitive)
      const curves = damageCurves.filter(c =>
        c.peril_type.toUpperCase() === perilType.toUpperCase() &&
        c.archetype === location.archetype
      )

      console.log(`[Physical Risk] Loc ${locIdx}, Period ${period}: intensity=${intensity}, peril=${perilType}, curves found=${curves.length}`)

      for (const curve of curves) {
        const valueType = curve.value_type
        const assetValue = assetValues[valueType] || 0

        if (assetValue === 0) continue

        // Interpolate damage percentage from curve
        const curvePoints = JSON.parse(curve.curve_points)
        const curveVariances = JSON.parse(curve.curve_variance || '[]')

        const damagePct = interpolateCurve(curvePoints, intensity)
        const curveVar = interpolateCurve(curveVariances, intensity)

        // Calculate damage amount
        const damageAmount = damagePct * assetValue

        // Propagate variance: σ²_total = σ²_spatial + σ²_curve
        const totalVariance = spatialVariance + curveVar

        // Save result
        try {
          await dbRun(`
            INSERT INTO physical_risk_result
            (scenario_id, location_id, peril_type, value_type, period_id,
             intensity_value, damage_pct, damage_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            scenario_id, location.location_id, perilType,
            valueType, period, intensity, damagePct, damageAmount
          ])
          insertCount++
        } catch (err) {
          console.error(`[Physical Risk] Insert error:`, err.message)
        }
      }
    }
  }

  console.log(`[Physical Risk] Damage calculation completed, inserted ${insertCount} result(s)`)
}

/**
 * Interpolate curve value at given x
 */
function interpolateCurve(points, x) {
  if (points.length === 0) return 0

  // Sort points by x
  points.sort((a, b) => a[0] - b[0])

  // Clamp below minimum
  if (x <= points[0][0]) return points[0][1]

  // Clamp above maximum
  if (x >= points[points.length - 1][0]) return points[points.length - 1][1]

  // Find bracketing points and interpolate
  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i][0] && x <= points[i + 1][0]) {
      const x0 = points[i][0], y0 = points[i][1]
      const x1 = points[i + 1][0], y1 = points[i + 1][1]
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    }
  }

  return 0
}

/**
 * Aggregate location-level results to entity drivers
 */
async function aggregateToDrivers(db, dbAll, dbRun, scenario_id) {
  console.log(`[Physical Risk] Aggregating to entity-level drivers`)

  // Load peril-driver mapping from damage_curve_mapping table
  // Use the most recent mapping that has proper structure: {"DRIVER_CODE": [{"peril_type": "X", "value_type": "Y"}]}
  const mappingRows = await dbAll(`
    SELECT peril_driver_mapping
    FROM damage_curve_mapping
    WHERE peril_driver_mapping IS NOT NULL
    AND peril_driver_mapping != '[]'
    AND peril_driver_mapping LIKE '%{%'
    AND peril_driver_mapping LIKE '%"peril_type"%'
    AND peril_driver_mapping LIKE '%"value_type"%'
    ORDER BY created_at DESC
    LIMIT 1
  `)

  if (mappingRows.length === 0) {
    console.log(`[Physical Risk] No driver mapping configured`)
    return
  }

  const perilDriverMapping = JSON.parse(mappingRows[0].peril_driver_mapping)
  console.log(`[Physical Risk] Using driver mapping:`, perilDriverMapping)

  // Get all physical risk results for this scenario
  const results = await dbAll(`
    SELECT
      prr.peril_type,
      prr.value_type,
      prr.period_id,
      prr.damage_amount
    FROM physical_risk_result prr
    WHERE prr.scenario_id = ?
  `, [scenario_id])

  if (results.length === 0) {
    console.log(`[Physical Risk] No results to aggregate`)
    return
  }

  // Aggregate by (driver_code, period) - drivers are scenario-level, not entity-level
  const aggregated = {}

  for (const result of results) {
    // Find which driver(s) this peril/value_type maps to
    for (const [driverCode, mappings] of Object.entries(perilDriverMapping)) {
      for (const mapping of mappings) {
        if (mapping.peril_type === result.peril_type && mapping.value_type === result.value_type) {
          const key = `${driverCode}|${result.period_id}`
          aggregated[key] = (aggregated[key] || 0) + result.damage_amount
        }
      }
    }
  }

  const driverCodes = [...new Set(Object.keys(perilDriverMapping))]
  if (driverCodes.length > 0) {
    const placeholders = driverCodes.map(() => '?').join(',')
    await dbRun(`
      DELETE FROM scenario_drivers
      WHERE scenario_id = ? AND driver_code IN (${placeholders})
    `, [scenario_id, ...driverCodes])
  }

  // Insert new driver values
  let insertCount = 0
  for (const [key, totalDamage] of Object.entries(aggregated)) {
    const [driverCode, period] = key.split('|')
    await dbRun(`
      INSERT INTO scenario_drivers (scenario_id, driver_code, period_id, value, unit_code)
      VALUES (?, ?, ?, ?, 'CHF')
    `, [scenario_id, driverCode, parseInt(period), -totalDamage]) // Negative = loss
    insertCount++
  }

  console.log(`[Physical Risk] Populated ${insertCount} driver values for ${driverCodes.length} driver code(s)`)
}

