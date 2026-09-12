import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/202609120001_repair_email_production_cutover.sql?raw'

describe('production repair email recipient migration', () => {
  it('preserves old outbox rows and only claims messages created after cutover', () => {
    expect(migration).toContain("notification.created_at >= timestamptz '2026-09-12 15:10:15+00'")
    expect(migration).not.toContain('Skipped at production email cutover')
  })

  it('includes the current action actor among workflow recipients', () => {
    expect(migration).toContain('select action.actor_id')
    expect(migration).toContain('and action.actor_id is not null')
    expect(migration).not.toContain('action.id <> v_action.id')
    expect(migration).not.toContain('action.actor_id is distinct from v_action.actor_id')
  })

  it('keeps recipient deduplication at the database query level', () => {
    expect(migration).toMatch(/select v_request\.requester_id as recipient_id\s+union\s+select action\.actor_id/)
  })
})
