import { ApiError, type ApiErrorBody } from './client'

/**
 * Centralized French labels for every error `code` the backend can emit.
 * Keeping this in one place avoids the case where a raw English code
 * (e.g. `no_outgoing_edge`) leaks into a user-facing toast just because a
 * caller forgot to translate it.
 *
 * Grouped by emitter for readability — order is informational only, lookups
 * are O(1).
 */
const MESSAGES: Record<string, string> = {
  // ── PatientRuns / advance.ts ─────────────────────────────────────────────
  workflow_already_finished:
    'Ce parcours est déjà terminé — réinitialise-le pour le rejouer.',
  unhandled_outcome:
    'Aucune sortie ne correspond au statut choisi. Vérifie la configuration du nœud.',
  no_outgoing_edge:
    'Ce nœud n\'a aucune sortie pour ce statut — relie-le à un autre nœud avant d\'avancer.',
  current_node_missing:
    'Le nœud courant du parcours est introuvable — le workflow a peut-être été modifié.',

  // ── Graph validation (already mirrored in validation-messages.ts; kept
  //    here so toasts surfaced outside the editor stay translated too) ────
  no_start: 'Le workflow doit avoir un nœud de départ.',
  multiple_starts: 'Il ne peut y avoir qu\'un seul nœud de départ.',
  no_end: 'Le workflow doit avoir au moins un nœud de fin.',
  start_position_x_must_be_zero: 'Le nœud Départ doit rester à la première colonne.',
  start_position_y_must_be_default: 'Le nœud Départ doit rester sur la ligne par défaut.',
  edge_dangling: 'Une connexion pointe vers un nœud qui n\'existe plus.',
  self_loop: 'Un nœud ne peut pas être relié à lui-même.',
  edge_into_start: 'Le nœud Départ ne peut pas recevoir de connexion.',
  edge_from_end: 'Un nœud Fin ne peut pas avoir de sortie.',
  duplicate_source_handle: 'Cette sortie est déjà utilisée par une autre connexion.',
  no_path_start_to_end: 'Aucun nœud Fin n\'est atteignable depuis le Départ.',
  unreachable_node: 'Ce nœud n\'est pas relié au flux principal depuis le Départ.',
  status_not_in_channel: 'Un statut sélectionné n\'existe pas pour ce canal.',
  duplicate_output_id: 'Deux sorties partagent le même identifiant.',
  status_overlap_in_multi: 'Un même statut apparaît dans plusieurs sorties.',
  invalid_source_handle_for_simple: 'Le mode simple n\'accepte que les sorties Succès / Échec.',
  invalid_source_handle_for_multi: 'Cette connexion ne correspond à aucune sortie configurée.',
  cycle: 'Un cycle a été détecté — le workflow doit rester acyclique.',
  incomplete_status_coverage: 'Certains statuts ne sont routés vers aucune sortie.',

  // ── Frontend-side response drift (Zod re-parse after fetch) ──────────────
  response_drift: 'Réponse du serveur inattendue — schéma incompatible. Recharge la page.',
  not_array: 'Réponse du serveur inattendue — format invalide.'
}

/**
 * Translate a backend error code into a French sentence safe to show in a toast.
 * Falls back to the caller-provided `fallback`, then to a generic message — the
 * raw English code is never returned (so a forgotten translation degrades to a
 * polite "Erreur" instead of leaking jargon).
 */
export function friendlyApiError(code: string | undefined, fallback?: string): string {
  if (code && MESSAGES[code]) return MESSAGES[code]!
  return fallback ?? 'Une erreur est survenue, réessaye dans un instant.'
}

/**
 * Top-level helper for `mutation.onError(e => …)`: handles both `ApiError`
 * (extracts the first error item's code) and any other thrown value. The
 * `fallback` is what the user sees when (a) the error isn't an ApiError or
 * (b) the code isn't in the registry and no specific message is available.
 */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const first = err.body.errors?.[0]
    return friendlyApiError(first?.code, fallback)
  }
  return fallback
}

/** Lower-level access if a call site needs the raw body item (rare). */
export function firstErrorItem(body: ApiErrorBody | undefined): { code?: string; message?: string } | undefined {
  return body?.errors?.[0]
}
