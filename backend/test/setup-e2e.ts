import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export default async function globalSetup() {
  const dbPath = join(__dirname, 'e2e.db')
  if (existsSync(dbPath)) unlinkSync(dbPath)
  process.env.DATABASE_URL = `file:${dbPath}`
  execSync('pnpm exec prisma db push --skip-generate', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
  })
}
