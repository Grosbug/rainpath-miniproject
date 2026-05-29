import type { NodeTypes } from '@xyflow/react'
import { StartNode } from './StartNode'
import { EndNode } from './EndNode'
import { SendEmailNode } from './SendEmailNode'
import { SendSmsNode } from './SendSmsNode'
import { SendWhatsAppNode } from './SendWhatsAppNode'
import { SendPostalNode } from './SendPostalNode'

/**
 * React Flow looks up the component by `node.type`. We use `data.kind` as the React Flow type.
 * The Canvas component sets `type = data.kind` when mapping store nodes → RF nodes.
 */
export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  send_email: SendEmailNode,
  send_sms: SendSmsNode,
  send_whatsapp: SendWhatsAppNode,
  send_postal: SendPostalNode
}
