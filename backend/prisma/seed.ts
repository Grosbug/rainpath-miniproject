import { PrismaClient } from '@prisma/client'
import {
  NodeTemplateBody, Graph,
  type EmailParams, type SmsParams, type WhatsAppParams, type PostalParams,
  type PostalAddress, type PatientGender,
  type RunHistoryEntry,
  START_Y,
  prettifyLayout,
  validateGraph
} from '@rainpath/shared'

const prisma = new PrismaClient()

// ---------- Channel template bodies (reused by templates AND by workflow nodes) ----------

const emailRelance: EmailParams = {
  subject: 'Relance — règlement de votre examen',
  body: "Bonjour,\n\nNous n'avons pas encore reçu le règlement…\n\nCordialement.",
  output: { mode: 'simple', successCondition: { statuses: ['delivered', 'opened', 'clicked', 'unopened'] } }
}

const emailFerme: EmailParams = {
  subject: 'Dernière relance',
  body: 'Bonjour,\n\nCeci est notre dernier rappel.\n\nCordialement.',
  output: {
    mode: 'multi',
    outputs: [
      { id: 'eng',    label: 'Engagé',     condition: { statuses: ['opened', 'clicked'] } },
      { id: 'no_eng', label: 'Pas engagé', condition: { statuses: ['delivered', 'unopened'] } },
      { id: 'fail',   label: 'Échec',      condition: { statuses: ['bounced', 'rejected'] } }
    ]
  }
}

const smsCourt: SmsParams = {
  body: 'Bonjour, votre examen est en attente de règlement. Détails par mail.',
  output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
}

const whatsappCourt: WhatsAppParams = {
  body: 'Bonjour, votre examen est en attente de règlement. *Merci de régulariser.*',
  output: { mode: 'simple', successCondition: { statuses: ['delivered', 'read'] } }
}

const postalSuivi: PostalParams = {
  body: 'Courrier postal de rappel.',
  tracked: true,
  output: { mode: 'simple', successCondition: { statuses: ['delivered'] } }
}

const postalNonSuivi: PostalParams = {
  body: 'Courrier postal simple.',
  tracked: false,
  output: { mode: 'simple', successCondition: { statuses: ['sent'] } }
}

const TEMPLATES = [
  { name: 'Email — première relance',  kind: 'send_email',    params: emailRelance },
  { name: 'Email — rappel ferme',      kind: 'send_email',    params: emailFerme },
  { name: 'SMS — court',               kind: 'send_sms',      params: smsCourt },
  { name: 'WhatsApp — message court',  kind: 'send_whatsapp', params: whatsappCourt },
  { name: 'Postal — suivi',            kind: 'send_postal',   params: postalSuivi },
  { name: 'Postal — non suivi',        kind: 'send_postal',   params: postalNonSuivi }
]

// ---------- Workflow scenarios ----------

interface SeededWorkflow {
  name: string
  description: string
  graph: Graph
}

// Lane y-offsets used to separate parallel branches visually in the editor.
// Offsets from START_Y; the patient canvas honors authored y straight through.
const LANE_DELTA = 160

/** Original quick-start case — a single email then end. */
function buildSimpleRelance(): SeededWorkflow {
  return {
    name: 'Exemple — Relance simple',
    description: 'Un email à J+7 puis fin à J+30.',
    graph: {
      nodes: [
        { id: 'start', position: { x: 0,  y: START_Y }, data: { kind: 'start' } },
        { id: 'email', position: { x: 7,  y: START_Y }, data: { kind: 'send_email', params: emailRelance } },
        { id: 'end',   position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'email', daysAfter: 7 },
        { id: 'e2', source: 'email', target: 'end',   daysAfter: 23, sourceHandle: 'success' }
      ]
    }
  }
}

/** 3-channel escalation: email → SMS → postal, each falling back on failure. */
function buildCascadeMultiCanal(): SeededWorkflow {
  return {
    name: 'Cascade multi-canal — Email · SMS · Courrier',
    description: "Email à J+5 ; si échec, SMS à J+8 ; si échec, courrier suivi à J+13. Conclut succès ou échec.",
    graph: {
      nodes: [
        { id: 'start',  position: { x: 0,  y: START_Y },                  data: { kind: 'start' } },
        { id: 'email',  position: { x: 5,  y: START_Y },                  data: { kind: 'send_email',  params: emailRelance } },
        { id: 'sms',    position: { x: 8,  y: START_Y + LANE_DELTA },     data: { kind: 'send_sms',    params: smsCourt } },
        { id: 'postal', position: { x: 13, y: START_Y + LANE_DELTA * 2 }, data: { kind: 'send_postal', params: postalSuivi } },
        { id: 'end',    position: { x: 20, y: START_Y },                  data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e_s_email',    source: 'start',  target: 'email',  daysAfter: 5 },
        { id: 'e_email_ok',   source: 'email',  target: 'end',    daysAfter: 15, sourceHandle: 'success' },
        { id: 'e_email_sms',  source: 'email',  target: 'sms',    daysAfter: 3,  sourceHandle: 'failure' },
        { id: 'e_sms_ok',     source: 'sms',    target: 'end',    daysAfter: 12, sourceHandle: 'success' },
        { id: 'e_sms_postal', source: 'sms',    target: 'postal', daysAfter: 5,  sourceHandle: 'failure' },
        { id: 'e_postal_ok',  source: 'postal', target: 'end',    daysAfter: 7,  sourceHandle: 'success' },
        { id: 'e_postal_ko',  source: 'postal', target: 'end',    daysAfter: 7,  sourceHandle: 'failure' }
      ]
    }
  }
}

/** Multi-output email segments patients by engagement, each branch follows its own path. */
function buildEngagementSegmentation(): SeededWorkflow {
  return {
    name: 'Engagement & segmentation — Suivi adaptatif',
    description: "Email à J+3 segmenté : engagé (fin), passif (SMS de relance), échec d'envoi (courrier).",
    graph: {
      nodes: [
        { id: 'start',      position: { x: 0,  y: START_Y },                  data: { kind: 'start' } },
        { id: 'email_seg',  position: { x: 3,  y: START_Y },                  data: { kind: 'send_email',  params: emailFerme } },
        { id: 'sms_rappel', position: { x: 10, y: START_Y + LANE_DELTA },     data: { kind: 'send_sms',    params: smsCourt } },
        { id: 'postal_alt', position: { x: 8,  y: START_Y + LANE_DELTA * 2 }, data: { kind: 'send_postal', params: postalNonSuivi } },
        { id: 'end',        position: { x: 20, y: START_Y },                  data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e_s_email',    source: 'start',      target: 'email_seg',  daysAfter: 3 },
        { id: 'e_eng',        source: 'email_seg',  target: 'end',        daysAfter: 17, sourceHandle: 'eng' },
        { id: 'e_no_eng',     source: 'email_seg',  target: 'sms_rappel', daysAfter: 7,  sourceHandle: 'no_eng' },
        { id: 'e_fail',       source: 'email_seg',  target: 'postal_alt', daysAfter: 5,  sourceHandle: 'fail' },
        { id: 'e_sms_end',    source: 'sms_rappel', target: 'end',        daysAfter: 10, sourceHandle: 'success' },
        { id: 'e_postal_end', source: 'postal_alt', target: 'end',        daysAfter: 12, sourceHandle: 'success' }
      ]
    }
  }
}

/** Three monthly postal reminders — full-traditional path for patients without digital channels. */
function buildPostalSuiviLongTerme(): SeededWorkflow {
  return {
    name: 'Suivi long terme — Postal mensuel',
    description: "Trois courriers suivis espacés d'un mois (J+30, J+60, J+90).",
    graph: {
      nodes: [
        { id: 'start', position: { x: 0,   y: START_Y }, data: { kind: 'start' } },
        { id: 'p1',    position: { x: 30,  y: START_Y }, data: { kind: 'send_postal', params: postalSuivi } },
        { id: 'p2',    position: { x: 60,  y: START_Y }, data: { kind: 'send_postal', params: postalSuivi } },
        { id: 'p3',    position: { x: 90,  y: START_Y }, data: { kind: 'send_postal', params: postalSuivi } },
        { id: 'end',   position: { x: 120, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'p1',  daysAfter: 30 },
        { id: 'e2', source: 'p1',    target: 'p2',  daysAfter: 30, sourceHandle: 'success' },
        { id: 'e3', source: 'p2',    target: 'p3',  daysAfter: 30, sourceHandle: 'success' },
        { id: 'e4', source: 'p3',    target: 'end', daysAfter: 30, sourceHandle: 'success' }
      ]
    }
  }
}

/** Single quick WhatsApp ping — mobile-first urgent reminder. */
function buildExpressWhatsApp(): SeededWorkflow {
  return {
    name: 'Express WhatsApp — Rappel rapide',
    description: 'Un seul message WhatsApp à J+3, fin à J+10.',
    graph: {
      nodes: [
        { id: 'start',    position: { x: 0,  y: START_Y }, data: { kind: 'start' } },
        { id: 'whatsapp', position: { x: 3,  y: START_Y }, data: { kind: 'send_whatsapp', params: whatsappCourt } },
        { id: 'end',      position: { x: 10, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e1', source: 'start',    target: 'whatsapp', daysAfter: 3 },
        { id: 'e2', source: 'whatsapp', target: 'end',      daysAfter: 7, sourceHandle: 'success' }
      ]
    }
  }
}

const WORKFLOWS: SeededWorkflow[] = [
  buildSimpleRelance(),
  buildCascadeMultiCanal(),
  buildEngagementSegmentation(),
  buildPostalSuiviLongTerme(),
  buildExpressWhatsApp()
]

// ---------- Patient profiles ----------

// Service stores address as JSON-encoded PostalAddress in the TEXT `address`
// column (the legacy `postalCode` column is no longer read). Plain-string
// addresses written by older seeds parse back to `null` — the patient run UI
// then treats those patients as having no postal coordinates.
function addr(street: string, postalCode: string, city: string): string {
  const a: PostalAddress = { street, postalCode, city, country: 'France' }
  return JSON.stringify(a)
}

interface SeededPatient {
  firstName: string
  lastName: string
  gender: PatientGender
  email: string | null
  phone: string | null
  whatsapp: string | null
  /** JSON-encoded PostalAddress, or null. */
  address: string | null
}

const SAMPLE_PATIENTS: SeededPatient[] = [
  // All four channels.
  {
    firstName: 'Alice', lastName: 'Durand', gender: 'female',
    email: 'alice.durand@example.com', phone: '+33 6 12 34 56 78',
    whatsapp: '+33 6 12 34 56 78', address: addr('12 rue de la Paix', '75002', 'Paris')
  },
  // Email + SMS + postal (no WhatsApp).
  {
    firstName: 'Bruno', lastName: 'Martin', gender: 'male',
    email: 'bruno.martin@example.com', phone: '+33 6 23 45 67 89',
    whatsapp: null, address: addr('4 avenue des Champs', '69002', 'Lyon')
  },
  // SMS + WhatsApp + postal (no email).
  {
    firstName: 'Camille', lastName: 'Rousseau', gender: 'female',
    email: null, phone: '+33 6 34 56 78 90',
    whatsapp: '+33 6 34 56 78 90', address: addr('8 rue du Vieux Port', '13002', 'Marseille')
  },
  // Email only — digital-first patient without phone or address on file.
  {
    firstName: 'David', lastName: 'Lefèvre', gender: 'male',
    email: 'david.lefevre@example.com', phone: null,
    whatsapp: null, address: null
  },
  // Postal only — elderly patient with no digital channels.
  {
    firstName: 'Élodie', lastName: 'Bernard', gender: 'female',
    email: null, phone: null,
    whatsapp: null, address: addr('27 rue des Tilleuls', '33000', 'Bordeaux')
  },
  // SMS only — basic mobile, no smartphone / email / address.
  {
    firstName: 'François', lastName: 'Petit', gender: 'male',
    email: null, phone: '+33 6 45 67 89 01',
    whatsapp: null, address: null
  },
  // Email + WhatsApp — typical expat / remote profile.
  {
    firstName: 'Géraldine', lastName: 'Moreau', gender: 'female',
    email: 'geraldine.moreau@example.com', phone: null,
    whatsapp: '+33 6 56 78 90 12', address: null
  },
  // No channels at all — edge case for empty-actionable paths.
  {
    firstName: 'Hugo', lastName: 'Renaud', gender: 'male',
    email: null, phone: null,
    whatsapp: null, address: null
  },
  // Email + postal — traditional/digital mix, no mobile.
  {
    firstName: 'Inès', lastName: 'Dubois', gender: 'female',
    email: 'ines.dubois@example.com', phone: null,
    whatsapp: null, address: addr('3 place Bellecour', '69002', 'Lyon')
  },
  // SMS + WhatsApp — mobile-only.
  {
    firstName: 'Julien', lastName: 'Lambert', gender: 'male',
    email: null, phone: '+33 6 67 89 01 23',
    whatsapp: '+33 6 67 89 01 23', address: null
  }
]

// ---------- Patient runs (pre-seeded combinations) ----------

interface SeededRun {
  patient: { firstName: string; lastName: string }
  /** Match by Workflow.name — kept verbatim from the WORKFLOWS array. */
  workflowName: string
  title: string
  /** Number of days in the past for the run's startDate. 0 = today. */
  startOffsetDays?: number
}

const SAMPLE_RUNS: SeededRun[] = [
  // Alice has every channel — pair her with the multi-output segmentation flow.
  {
    patient: { firstName: 'Alice', lastName: 'Durand' },
    workflowName: 'Engagement & segmentation — Suivi adaptatif',
    title: 'Alice — Segmentation engagement', startOffsetDays: 3
  },
  // Bruno has email + SMS + postal — the cascade is a perfect fit.
  {
    patient: { firstName: 'Bruno', lastName: 'Martin' },
    workflowName: 'Cascade multi-canal — Email · SMS · Courrier',
    title: 'Bruno — Cascade complète', startOffsetDays: 7
  },
  // Camille has WhatsApp — short Express demo.
  {
    patient: { firstName: 'Camille', lastName: 'Rousseau' },
    workflowName: 'Express WhatsApp — Rappel rapide',
    title: 'Camille — Rappel WhatsApp'
  },
  // David only has email — the original simple relance flow.
  {
    patient: { firstName: 'David', lastName: 'Lefèvre' },
    workflowName: 'Exemple — Relance simple',
    title: 'David — Relance email', startOffsetDays: 14
  },
  // Élodie only has a postal address — the long-term postal flow is the only one she can complete.
  {
    patient: { firstName: 'Élodie', lastName: 'Bernard' },
    workflowName: 'Suivi long terme — Postal mensuel',
    title: 'Élodie — Suivi postal trimestriel', startOffsetDays: 30
  },
  // François has SMS only — interesting failure path: email fails (no addr), SMS works, postal fails.
  {
    patient: { firstName: 'François', lastName: 'Petit' },
    workflowName: 'Cascade multi-canal — Email · SMS · Courrier',
    title: 'François — Cascade avec canaux manquants', startOffsetDays: 5
  },
  // Géraldine has WhatsApp.
  {
    patient: { firstName: 'Géraldine', lastName: 'Moreau' },
    workflowName: 'Express WhatsApp — Rappel rapide',
    title: 'Géraldine — Ping WhatsApp'
  },
  // Hugo has zero channels — every send_* node will surface the "missing contact" warning.
  {
    patient: { firstName: 'Hugo', lastName: 'Renaud' },
    workflowName: 'Exemple — Relance simple',
    title: 'Hugo — Cas limite sans canaux'
  },
  // Inès has email + postal — segmentation flow exercises both eng/no_eng and fail->postal paths.
  {
    patient: { firstName: 'Inès', lastName: 'Dubois' },
    workflowName: 'Engagement & segmentation — Suivi adaptatif',
    title: 'Inès — Segmentation email/postal', startOffsetDays: 2
  },
  // Julien has SMS + WhatsApp.
  {
    patient: { firstName: 'Julien', lastName: 'Lambert' },
    workflowName: 'Express WhatsApp — Rappel rapide',
    title: 'Julien — WhatsApp mobile-only'
  }
]

// ---------- Seeding ----------

async function main() {
  for (const t of TEMPLATES) {
    NodeTemplateBody.parse({ kind: t.kind, params: t.params })
  }
  for (const w of WORKFLOWS) {
    Graph.parse(w.graph)
  }

  // Additive seed: each item is inserted only if no row with the same identifier
  // exists yet. Lets the demo dataset evolve across runs without wiping the DB,
  // and preserves any data the user authored through the UI in between.
  // Dedup keys (no unique constraint in the schema, so we hand-check):
  //   - NodeTemplate / Workflow : by `name`
  //   - PatientProfile          : by `firstName + lastName`
  // Soft-deleted rows still count as "present" and are NOT re-seeded — wipe
  // those manually if you want them back.

  let insertedTemplates = 0
  for (const t of TEMPLATES) {
    const existing = await prisma.nodeTemplate.findFirst({ where: { name: t.name } })
    if (existing) continue
    await prisma.nodeTemplate.create({
      data: { name: t.name, kind: t.kind, params: JSON.stringify(t.params) }
    })
    insertedTemplates++
  }
  console.log(`✓ node templates: +${insertedTemplates} new, ${TEMPLATES.length - insertedTemplates} already present`)

  let insertedWorkflows = 0
  for (const w of WORKFLOWS) {
    const existing = await prisma.workflow.findFirst({ where: { name: w.name } })
    if (existing) continue
    // Run the same prettify pass the in-app "Réorganiser" button uses, so
    // freshly-seeded workflows open with the same clean layout as one the user
    // would produce by clicking the button. Pure-fn on the graph — no side
    // effects on the source-of-truth seed object.
    const prettified = prettifyLayout(w.graph)
    const isValid = validateGraph(prettified).errors.length === 0
    await prisma.workflow.create({
      data: {
        name: w.name,
        description: w.description,
        graph: JSON.stringify(prettified),
        isValid
      }
    })
    insertedWorkflows++
  }
  console.log(`✓ workflows: +${insertedWorkflows} new, ${WORKFLOWS.length - insertedWorkflows} already present`)

  let insertedPatients = 0
  for (const p of SAMPLE_PATIENTS) {
    const existing = await prisma.patientProfile.findFirst({
      where: { firstName: p.firstName, lastName: p.lastName }
    })
    if (existing) continue
    await prisma.patientProfile.create({ data: p })
    insertedPatients++
  }
  console.log(`✓ patient profiles: +${insertedPatients} new, ${SAMPLE_PATIENTS.length - insertedPatients} already present`)

  // Patient runs depend on the patients + workflows being in the DB, so they're
  // seeded last. Each run is dedup'd by (patientId, workflowId, title) — re-runs
  // never duplicate even if the workflow's name/graph changed in between.
  let insertedRuns = 0
  let unresolvedRuns = 0
  let presentRuns = 0
  for (const r of SAMPLE_RUNS) {
    const patient = await prisma.patientProfile.findFirst({
      where: { firstName: r.patient.firstName, lastName: r.patient.lastName }
    })
    const workflow = await prisma.workflow.findFirst({ where: { name: r.workflowName } })
    if (!patient || !workflow) {
      console.warn(
        `⚠ skipping run "${r.title}" — ` +
        (!patient ? `patient ${r.patient.firstName} ${r.patient.lastName} missing. ` : '') +
        (!workflow ? `workflow "${r.workflowName}" missing.` : '')
      )
      unresolvedRuns++
      continue
    }
    const existing = await prisma.patientRun.findFirst({
      where: { patientId: patient.id, workflowId: workflow.id, title: r.title }
    })
    if (existing) { presentRuns++; continue }

    const graph = JSON.parse(workflow.graph) as Graph
    const startNode = graph.nodes.find(n => n.data.kind === 'start')
    if (!startNode) {
      console.warn(`⚠ skipping run "${r.title}" — workflow "${r.workflowName}" has no start node`)
      unresolvedRuns++
      continue
    }

    const startDate = new Date(Date.now() - (r.startOffsetDays ?? 0) * 24 * 60 * 60 * 1000)
    const history: RunHistoryEntry[] = [{ nodeId: startNode.id, enteredAt: startDate.toISOString() }]

    await prisma.patientRun.create({
      data: {
        workflowId: workflow.id,
        patientId: patient.id,
        title: r.title,
        currentNodeId: startNode.id,
        focusedNodeId: startNode.id,
        history: JSON.stringify(history),
        startDate
      }
    })
    insertedRuns++
  }
  console.log(
    `✓ patient runs: +${insertedRuns} new, ${presentRuns} already present` +
    (unresolvedRuns > 0 ? `, ${unresolvedRuns} unresolved` : '')
  )
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
