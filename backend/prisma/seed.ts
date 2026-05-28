import { PrismaClient } from '@prisma/client'
import {
  NodeTemplateBody, Graph,
  type EmailParams, type SmsParams, type WhatsAppParams, type PostalParams, type ConditionParams,
  START_Y
} from '@rainpath/shared'

const prisma = new PrismaClient()

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
      { id: 'eng', label: 'Engagé', condition: { statuses: ['opened', 'clicked'] } },
      { id: 'no_eng', label: 'Pas engagé', condition: { statuses: ['delivered', 'unopened'] } },
      { id: 'fail', label: 'Échec', condition: { statuses: ['bounced', 'rejected'] } }
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
  output: { mode: 'single' }
}

const condEmail: ConditionParams = {
  conditionType: 'data_available',
  expression: 'patient.email'
}

const condWhatsapp: ConditionParams = {
  conditionType: 'data_available',
  expression: 'patient.whatsapp'
}

const TEMPLATES = [
  { name: 'Email — première relance', kind: 'send_email', params: emailRelance },
  { name: 'Email — rappel ferme', kind: 'send_email', params: emailFerme },
  { name: 'SMS — court', kind: 'send_sms', params: smsCourt },
  { name: 'WhatsApp — message court', kind: 'send_whatsapp', params: whatsappCourt },
  { name: 'Postal — suivi', kind: 'send_postal', params: postalSuivi },
  { name: 'Postal — non suivi', kind: 'send_postal', params: postalNonSuivi },
  { name: 'Condition — email connu', kind: 'condition', params: condEmail },
  { name: 'Condition — WhatsApp dispo', kind: 'condition', params: condWhatsapp }
]

// Build a small example workflow: J+7 email → end at J+30 (simplistic but valid)
function buildExampleWorkflow(): { name: string; description: string; graph: Graph } {
  const startId = 'start-1'
  const emailId = 'email-1'
  const endId = 'end-1'
  return {
    name: 'Exemple — Relance simple',
    description: "Workflow d'exemple seedé au démarrage",
    graph: {
      nodes: [
        { id: startId, position: { x: 0, y: START_Y }, data: { kind: 'start' } },
        { id: emailId, position: { x: 7, y: START_Y }, data: { kind: 'send_email', params: emailRelance } },
        { id: endId, position: { x: 30, y: START_Y }, data: { kind: 'end' } }
      ],
      edges: [
        { id: 'e-s-email', source: startId, target: emailId, daysAfter: 7 },
        { id: 'e-email-end', source: emailId, target: endId, daysAfter: 23 }
      ]
    }
  }
}

async function main() {
  // Validate each template body with Zod before inserting
  for (const t of TEMPLATES) {
    NodeTemplateBody.parse({ kind: t.kind, params: t.params })
  }

  // Idempotent seed: only insert if there are no templates yet (developers can wipe DB to reseed)
  const count = await prisma.nodeTemplate.count()
  if (count === 0) {
    for (const t of TEMPLATES) {
      await prisma.nodeTemplate.create({
        data: { name: t.name, kind: t.kind, params: JSON.stringify(t.params) }
      })
    }
    console.log(`✓ ${TEMPLATES.length} node templates seeded`)
  } else {
    console.log(`= ${count} node templates already present — skipping`)
  }

  const wfCount = await prisma.workflow.count()
  if (wfCount === 0) {
    const wf = buildExampleWorkflow()
    Graph.parse(wf.graph) // sanity check
    await prisma.workflow.create({
      data: { name: wf.name, description: wf.description, graph: JSON.stringify(wf.graph) }
    })
    console.log('✓ Example workflow seeded')
  } else {
    console.log(`= ${wfCount} workflows already present — skipping`)
  }
}

main()
  .catch(err => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
