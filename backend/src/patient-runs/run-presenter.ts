import type { Graph, PatientGender, PostalAddress } from '@rainpath/shared';
import { parsePostalAddress } from '../patient-profiles/postal-address-codec';
import { buildRunSimulationState } from './run-state';
import { type RunHistoryEntry, parseRunHistory } from './run-history-codec';

/**
 * Row shapes (only the columns we read) — avoids importing the generated Prisma
 * types and keeps this module decoupled from the ORM. Both raw rows and the
 * Graph come from the caller (who owns the workflow decoding step).
 */
export type PatientRunRow = {
  id: string;
  workflowId: string;
  patientId: string;
  title: string;
  currentNodeId: string | null;
  focusedNodeId: string | null;
  history: string;
  startDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkflowMetaRow = {
  id: string;
  name: string;
};

export type PatientRow = {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  deletedAt: Date | null;
};

export type PatientRunFull = {
  id: string;
  title: string;
  workflowId: string;
  workflow: { id: string; name: string; graph: Graph };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    gender: PatientGender;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    address: PostalAddress | null;
    deletedAt: string | null;
  };
  currentNodeId: string | null;
  focusedNodeId: string | null;
  activeFrontiers: string[];
  actionableNodeIds: string[];
  history: RunHistoryEntry[];
  startDate: string;
  createdAt: string;
  updatedAt: string;
};

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/**
 * Build the full `PatientRunFull` response from the three rows that compose it
 * plus the already-decoded workflow graph. Centralised so create / get / advance
 * / focus / reset all emit byte-identical shapes — drift here used to be the
 * source of subtle frontend regressions where one endpoint forgot e.g.
 * `activeFrontiers`.
 */
export function toPatientRunFull(
  run: PatientRunRow,
  workflow: WorkflowMetaRow,
  patient: PatientRow,
  graph: Graph,
): PatientRunFull {
  const history = parseRunHistory(run.history);
  const gender: PatientGender = patient.gender === 'female' ? 'female' : 'male';
  const sim = buildRunSimulationState(
    graph,
    history,
    run.focusedNodeId ?? run.currentNodeId,
  );

  return {
    id: run.id,
    title: run.title,
    workflowId: run.workflowId,
    workflow: { id: workflow.id, name: workflow.name, graph },
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      name: fullName(patient),
      gender,
      email: patient.email,
      phone: patient.phone,
      whatsapp: patient.whatsapp,
      address: parsePostalAddress(patient.address),
      deletedAt: patient.deletedAt ? patient.deletedAt.toISOString() : null,
    },
    currentNodeId: sim.currentNodeId,
    focusedNodeId: sim.focusedNodeId,
    activeFrontiers: sim.activeFrontiers,
    actionableNodeIds: sim.actionableNodeIds,
    history,
    startDate: run.startDate.toISOString(),
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
