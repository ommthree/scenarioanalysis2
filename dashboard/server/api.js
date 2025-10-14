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

// Load statements endpoint
app.post('/api/statements/load', upload.single('file'), async (req, res) => {
  try {
    const { statementType, dbPath } = req.body
    const file = req.file

    if (!file || !statementType || !dbPath) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Read and parse CSV
    const fileContent = fs.readFileSync(file.path, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    // Connect to database
    const db = new sqlite3.Database(dbPath)

    // Create statement table if not exists
    const tableName = `statement_${statementType}`

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // Get columns from first record
        const columns = Object.keys(records[0])
        const columnDefs = columns.map(col => `"${col}" TEXT`).join(', ')

        db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ${columnDefs},
          imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) return reject(err)
        })

        // Insert records
        const placeholders = columns.map(() => '?').join(', ')
        const stmt = db.prepare(`INSERT INTO ${tableName} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`)

        let inserted = 0
        for (const record of records) {
          const values = columns.map(col => record[col])
          stmt.run(values, (err) => {
            if (err) console.error('Insert error:', err)
            else inserted++
          })
        }

        stmt.finalize((err) => {
          if (err) return reject(err)
          resolve(inserted)
        })
      })
    })

    db.close()

    // Clean up uploaded file
    fs.unlinkSync(file.path)

    res.json({
      success: true,
      message: `Imported ${records.length} rows into ${tableName}`,
      rowCount: records.length
    })

  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: error.message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
