/**
 * Map validation codes from `shared/validateGraph` to user-facing French messages.
 * The raw `message` from validation is dev-oriented; this layer is what surfaces to users.
 */
const MESSAGES: Record<string, string> = {
  no_start: 'Le workflow doit avoir un nœud de départ',
  multiple_starts: 'Il ne peut y avoir qu\'un seul nœud de départ',
  no_end: 'Le workflow doit avoir au moins un nœud de fin',
  start_position_x_must_be_zero: 'Le nœud Départ doit rester à la première colonne',
  start_position_y_must_be_default: 'Le nœud Départ doit rester sur la ligne par défaut',
  edge_dangling: 'Une connexion pointe vers un nœud qui n\'existe plus',
  self_loop: 'Un nœud ne peut pas être relié à lui-même',
  edge_into_start: 'Le nœud Départ ne peut pas recevoir de connexion',
  edge_from_end: 'Un nœud Fin ne peut pas avoir de sortie',
  duplicate_source_handle: 'Cette sortie est déjà utilisée par une autre connexion',
  no_path_start_to_end: 'Aucun nœud Fin n\'est atteignable depuis le Départ — le parcours s\'arrête au premier nœud',
  unreachable_node: 'Ce nœud n\'est pas relié au flux principal depuis le Départ',
  status_not_in_channel: 'Un statut sélectionné n\'existe pas pour ce canal',
  duplicate_output_id: 'Deux sorties partagent le même identifiant',
  status_overlap_in_multi: 'Un même statut apparaît dans plusieurs sorties',
  invalid_source_handle_for_simple: 'Le mode simple n\'accepte que les sorties Succès / Échec',
  invalid_source_handle_for_multi: 'Cette connexion ne correspond à aucune sortie configurée',
  cycle: 'Un cycle a été détecté — le workflow doit rester acyclique',
  incomplete_status_coverage: 'Certains statuts ne sont routés vers aucune sortie'
}

export function friendlyValidationMessage(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? 'Erreur de validation'
}
