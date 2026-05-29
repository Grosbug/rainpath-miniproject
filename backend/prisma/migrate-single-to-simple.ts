/**
 * One-shot migration: rewrite legacy `output: { mode: 'single' }` blobs into
 * `mode: 'simple'` with channel-appropriate success statuses, and tag outgoing
 * edges from those nodes with `sourceHandle: 'success'`. Run once after
 * upgrading the schema (`pnpm --filter @rainpath/backend exec tsx prisma/migrate-single-to-simple.ts`).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CHANNEL_SUCCESS: Record<string, string[]> = {
  send_email:    ['delivered', 'opened', 'clicked', 'unopened'],
  send_sms:      ['delivered'],
  send_whatsapp: ['delivered', 'read'],
  send_postal_tracked:   ['delivered'],
  send_postal_untracked: ['sent']
}

function channelKey(node: any): string | null {
  const k = node?.data?.kind
  if (k === 'send_postal') return node.data.params.tracked ? 'send_postal_tracked' : 'send_postal_untracked'
  if (k === 'send_email' || k === 'send_sms' || k === 'send_whatsapp') return k
  return null
}

function migrateOutput(node: any): boolean {
  const params = node?.data?.params
  if (!params?.output || params.output.mode !== 'single') return false
  const ck = channelKey(node)
  if (!ck) return false
  params.output = { mode: 'simple', successCondition: { statuses: CHANNEL_SUCCESS[ck] } }
  return true
}

async function migrateWorkflows() {
  const rows = await prisma.workflow.findMany()
  let migrated = 0
  for (const row of rows) {
    const graph = JSON.parse(row.graph) as { nodes: any[]; edges: any[] }
    const upgradedNodes = new Set<string>()
    for (const node of graph.nodes) {
      if (migrateOutput(node)) upgradedNodes.add(node.id)
    }
    if (upgradedNodes.size === 0) continue
    for (const edge of graph.edges) {
      if (upgradedNodes.has(edge.source) && edge.sourceHandle === undefined) {
        edge.sourceHandle = 'success'
      }
    }
    await prisma.workflow.update({ where: { id: row.id }, data: { graph: JSON.stringify(graph) } })
    migrated++
    console.log(`✓ workflow "${row.name}" — migrated ${upgradedNodes.size} node(s)`)
  }
  console.log(`${migrated}/${rows.length} workflow(s) updated`)
}

async function migrateTemplates() {
  const rows = await prisma.nodeTemplate.findMany()
  let migrated = 0
  for (const row of rows) {
    const params = JSON.parse(row.params)
    const fakeNode = { data: { kind: row.kind, params } }
    if (!migrateOutput(fakeNode)) continue
    await prisma.nodeTemplate.update({ where: { id: row.id }, data: { params: JSON.stringify(params) } })
    migrated++
    console.log(`✓ template "${row.name}" — migrated`)
  }
  console.log(`${migrated}/${rows.length} template(s) updated`)
}

async function main() {
  await migrateTemplates()
  await migrateWorkflows()
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
