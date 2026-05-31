import type { PostalAddress } from '@rainpath/shared';

/**
 * Single source of truth for marshalling `PostalAddress` to/from the TEXT column
 * Prisma exposes for SQLite. Previously this logic was duplicated inside
 * `PatientProfilesService.parseAddress` and `PatientRunsService.parsePatientAddress`,
 * which drifted on every shape change. Both services now go through this module.
 */
export function serializePostalAddress(
  addr: PostalAddress | null | undefined,
): string | null {
  if (!addr) return null;
  return JSON.stringify(addr);
}

export function parsePostalAddress(raw: string | null): PostalAddress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'street' in parsed &&
      'postalCode' in parsed &&
      'city' in parsed
    ) {
      return parsed as PostalAddress;
    }
    return null;
  } catch {
    return null;
  }
}
