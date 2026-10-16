import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202610160001_settings_approval_comments.sql?raw'

describe('settings approval comment migration', () => {
  it('requires an unlocked settings session for both RPCs', () => {
    expect(migration.match(/perform private\.require_repair_settings_session\(p_session_token\);/g)).toHaveLength(2)
  })

  it('limits editable workflow actions to the three approval steps', () => {
    expect(migration).toContain("action.action in ('approve', 'reject')")
    expect(migration).toContain("v_step_code = 'supervisor' and v_action.from_status = 'pending_supervisor'")
    expect(migration).toContain("v_step_code = 'department_manager' and v_action.from_status = 'pending_department_manager'")
    expect(migration).toContain("v_step_code = 'factory_manager' and v_action.from_status = 'pending_factory_manager'")
  })

  it('supports the three legacy approver metadata keys without changing identity fields', () => {
    expect(migration).toContain("when 'supervisor' then 'supervisor_note'")
    expect(migration).toContain("when 'department_manager' then 'department_manager_note'")
    expect(migration).toContain("when 'factory_manager' then 'factory_manager_note'")
    expect(migration).not.toMatch(/set\s+actor_name_snapshot\s*=/)
    expect(migration).not.toMatch(/set\s+created_at\s*=/)
  })

  it('records request and approval-comment values in the existing immutable audit trail', () => {
    expect(migration).toContain("jsonb_build_object('approval_comments', v_comments_before)")
    expect(migration).toContain("jsonb_build_object('approval_comments', v_comments_after)")
    expect(migration).toContain('insert into private.repair_settings_audit')
  })

  it('exposes both RPCs only to authenticated users', () => {
    expect(migration).toContain('grant execute on function public.list_repair_settings_approval_comments(text, uuid)')
    expect(migration).toContain('grant execute on function public.update_repair_settings_request_with_comments(')
    expect(migration).toContain('to authenticated;')
  })
})
