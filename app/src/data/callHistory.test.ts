import { describe, expect, it } from 'vitest';
import { androidCallLogToEvents } from './callLogMap';

describe('androidCallLogToEvents', () => {
  it('normalise le numéro et mappe le type vers la direction', () => {
    const events = androidCallLogToEvents([
      { phoneNumber: '06 12 34 56 78', type: 'OUTGOING', timestamp: 1704700000000 },
      { phoneNumber: '+33140000000', type: 'INCOMING', timestamp: '1704700100000' },
      { phoneNumber: '01 40 00 00 01', type: 'MISSED', timestamp: 1704700200000 },
    ]);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ phoneNumberId: '+33612345678', direction: 'outgoing' });
    expect(events[1]).toMatchObject({ phoneNumberId: '+33140000000', direction: 'incoming' });
    expect(events[2]!.direction).toBe('missed');
    expect(events[0]!.occurredAt instanceof Date).toBe(true);
  });

  it('ignore les entrées au numéro ou timestamp invalide', () => {
    const events = androidCallLogToEvents([
      { phoneNumber: 'inconnu', type: 'OUTGOING', timestamp: 1704700000000 },
      { phoneNumber: '+33612345678', type: 'OUTGOING' }, // timestamp manquant
      { type: 'OUTGOING', timestamp: 1704700000000 }, // numéro manquant
    ]);
    expect(events).toHaveLength(0);
  });
});
