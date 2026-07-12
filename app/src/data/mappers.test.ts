import { describe, expect, it } from 'vitest';
import { normalizeToE164 } from './phone';
import {
  nativeContactToRaw,
  nativeEventToCalendarEvent,
  type NativeContact,
} from './mappers';

describe('normalizeToE164', () => {
  it('normalise un numéro national FR en E.164', () => {
    expect(normalizeToE164('06 12 34 56 78')).toBe('+33612345678');
    expect(normalizeToE164('01.40.00.00.00')).toBe('+33140000000');
  });
  it('conserve un numéro déjà international', () => {
    expect(normalizeToE164('+33612345678')).toBe('+33612345678');
  });
  it('retourne null pour une entrée invalide', () => {
    expect(normalizeToE164('12')).toBeNull();
    expect(normalizeToE164('')).toBeNull();
    expect(normalizeToE164(undefined)).toBeNull();
  });
});

describe('nativeContactToRaw', () => {
  it('mappe un contact natif, normalise et dédoublonne les numéros', () => {
    const native: NativeContact = {
      id: 'abc',
      firstName: 'Jean',
      lastName: 'Dupont',
      phoneNumbers: [
        { number: '06 12 34 56 78', label: 'mobile' },
        { number: '+33612345678', label: 'iphone' }, // doublon après normalisation
        { number: '01 40 00 00 00', label: 'work' },
        { number: 'pas-un-numero' }, // ignoré
      ],
      emails: [{ email: 'jean@x.fr' }],
    };

    const raw = nativeContactToRaw(native);

    expect(raw.externalId).toBe('abc');
    expect(raw.sourceId).toBe('device:abc');
    expect(raw.displayName).toBe('Jean Dupont');
    expect([...raw.phoneE164s].sort()).toEqual(['+33140000000', '+33612345678']);
    expect(raw.labeledPhones).toHaveLength(2);
    expect([...raw.emails]).toEqual(['jean@x.fr']);
  });

  it('retombe sur un nom par défaut si aucun nom', () => {
    const raw = nativeContactToRaw({ id: '1' });
    expect(raw.displayName).toBe('(sans nom)');
    expect(raw.phoneE164s.size).toBe(0);
  });
});

describe('nativeEventToCalendarEvent', () => {
  it('résout les participants via la table e-mail → contact', () => {
    const map = new Map([['camille@x.fr', 'camille']]);
    const ev = nativeEventToCalendarEvent(
      {
        title: 'Point projet',
        startDate: '2024-01-08T09:18:00.000Z',
        endDate: '2024-01-08T09:48:00.000Z',
        attendeeEmails: ['CAMILLE@x.fr', 'inconnu@y.fr'],
      },
      map,
    );

    expect(ev.title).toBe('Point projet');
    expect([...ev.participantContactIds]).toEqual(['camille']);
    expect(ev.start instanceof Date).toBe(true);
  });
});
