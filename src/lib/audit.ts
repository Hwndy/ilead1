import { supabase } from '@/integrations/supabase/client';

/**
 * Records an action in the platform audit trail.
 * Never throws — auditing must not break the action it is recording.
 */
export async function logAuditEvent(
  action: string,
  options: {
    tableName?: string;
    rowId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
) {
  try {
    await (supabase as any).rpc('log_audit_event', {
      p_action: action,
      p_table_name: options.tableName ?? null,
      p_row_id: options.rowId ?? null,
      p_metadata: options.metadata ?? {},
    });
  } catch (error) {
    console.warn('audit log failed', action, error);
  }
}
