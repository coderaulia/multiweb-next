/**
 * Default tenant ID used during the migration period.
 * All existing data is backfilled to this tenant.
 * This constant will be removed once the store layer is refactored to the factory pattern (Phase C-3).
 */
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';
export const DEFAULT_TENANT_SLUG = 'default';
