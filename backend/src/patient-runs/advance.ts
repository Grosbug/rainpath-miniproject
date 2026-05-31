import type { Graph } from '@rainpath/shared';

export type AdvanceErrorCode =
  | 'workflow_already_finished'
  | 'unhandled_outcome'
  | 'no_outgoing_edge'
  | 'current_node_missing';

export class AdvanceError extends Error {
  constructor(
    public readonly code: AdvanceErrorCode,
    public readonly status: number,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'AdvanceError';
  }
}

interface Ctx {
  graph: Graph;
  currentNodeId: string;
  outcome?: string;
}

type ResolvedHandle = { type: 'single' } | { type: 'handle'; handle: string };

function resolveHandle(
  node: Graph['nodes'][number],
  outcome: string | undefined,
): ResolvedHandle {
  const data = node.data;

  if (data.kind === 'start') return { type: 'single' };

  if (
    data.kind === 'send_email' ||
    data.kind === 'send_sms' ||
    data.kind === 'send_whatsapp' ||
    data.kind === 'send_postal'
  ) {
    const out = data.params.output;

    if (out.mode === 'simple') {
      if (outcome && out.successCondition.statuses.includes(outcome)) {
        return { type: 'handle', handle: 'success' };
      }
      return { type: 'handle', handle: 'failure' };
    }

    // multi
    if (!outcome) {
      throw new AdvanceError('unhandled_outcome', 422, {
        nodeId: node.id,
        outcome: null,
        availableStatuses: out.outputs.flatMap((o) => o.condition.statuses),
      });
    }
    const match = out.outputs.find((o) =>
      o.condition.statuses.includes(outcome),
    );
    if (!match) {
      throw new AdvanceError('unhandled_outcome', 422, {
        nodeId: node.id,
        outcome,
        availableStatuses: out.outputs.flatMap((o) => o.condition.statuses),
      });
    }
    return { type: 'handle', handle: match.id };
  }

  throw new AdvanceError('workflow_already_finished', 400, { nodeId: node.id });
}

/**
 * Resolve the next node ID given the current node and an optional outcome.
 * Throws `AdvanceError` with a typed code on any failure.
 */
export function resolveAdvance(ctx: Ctx): {
  nextNodeId: string;
  outcome?: string;
} {
  const current = ctx.graph.nodes.find((n) => n.id === ctx.currentNodeId);
  if (!current) {
    throw new AdvanceError('current_node_missing', 500, {
      nodeId: ctx.currentNodeId,
    });
  }

  if (current.data.kind === 'end') {
    throw new AdvanceError('workflow_already_finished', 400, {
      nodeId: current.id,
    });
  }

  const resolved = resolveHandle(current, ctx.outcome);

  let edge: Graph['edges'][number] | undefined;
  if (resolved.type === 'single') {
    edge = ctx.graph.edges.find(
      (e) => e.source === current.id && !e.sourceHandle,
    );
    if (!edge) {
      const outgoing = ctx.graph.edges.filter((e) => e.source === current.id);
      if (outgoing.length === 1) edge = outgoing[0];
    }
  } else {
    edge = ctx.graph.edges.find(
      (e) => e.source === current.id && e.sourceHandle === resolved.handle,
    );
  }

  if (!edge) {
    throw new AdvanceError('no_outgoing_edge', 422, {
      nodeId: current.id,
      handle: resolved.type === 'handle' ? resolved.handle : null,
    });
  }

  // Only propagate outcome when it was actually used to pick a specific handle
  if (resolved.type === 'handle') {
    return { nextNodeId: edge.target, outcome: ctx.outcome };
  }
  return { nextNodeId: edge.target };
}
