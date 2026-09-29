import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

let database

export function getDatabase() {
  if (database) {
    return database
  }

  const databasePath = resolve(
    process.env.SQLITE_DATABASE_PATH || './database/autocare.sqlite',
  )
  mkdirSync(dirname(databasePath), { recursive: true })

  database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON;')

  const schemaPath = fileURLToPath(
    new URL('../database/schema.sql', import.meta.url),
  )
  database.exec(readFileSync(schemaPath, 'utf8'))

  const userColumns = database.prepare('PRAGMA table_info(users)').all()
  if (!userColumns.some((column) => column.name === 'token_version')) {
    database.exec(
      'ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0',
    )
  }

  return database
}
