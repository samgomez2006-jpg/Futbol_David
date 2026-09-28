import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({ Preferences: { get: async () => ({ value: null }), set: async () => {}, remove: async () => {} } }));

const { enqueue } = await import('./store');

describe('outbox', () => {
  it('fusiona mutaciones del mismo registro quedándose con la última', () => {
    let q = enqueue([], { table: 'players', op: 'upsert', rowId: '1', row: { name: 'a' } });
    q = enqueue(q, { table: 'players', op: 'upsert', rowId: '2', row: { name: 'b' } });
    q = enqueue(q, { table: 'players', op: 'upsert', rowId: '1', row: { name: 'c' } });
    expect(q).toHaveLength(2);
    expect(q.find((m) => m.rowId === '1')?.row).toEqual({ name: 'c' });
    q = enqueue(q, { table: 'players', op: 'delete', rowId: '1' });
    expect(q.find((m) => m.rowId === '1')?.op).toBe('delete');
    expect(q).toHaveLength(2);
  });
});
