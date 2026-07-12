import { describe, expect, it } from 'vitest';
import type { RawContact } from 'contxt-domain';
import { rawContactFromJson, rawContactToJson } from './serialize';

describe('sérialisation RawContact', () => {
  it('round-trip : préserve les champs et reconstruit les Set', () => {
    const raw: RawContact = {
      sourceId: 'device:42',
      provider: 'device',
      externalId: '42',
      displayName: 'Jean Dupont',
      givenName: 'Jean',
      familyName: 'Dupont',
      emails: new Set(['jean@x.fr']),
      phoneE164s: new Set(['+33612345678', '+33140000000']),
      labeledPhones: [
        { e164: '+33612345678', rawLabel: 'mobile' },
        { e164: '+33140000000', rawLabel: 'work' },
      ],
    };

    const back = rawContactFromJson(rawContactToJson(raw));

    expect(back.sourceId).toBe('device:42');
    expect(back.displayName).toBe('Jean Dupont');
    expect(back.emails).toEqual(new Set(['jean@x.fr']));
    expect(back.phoneE164s).toEqual(new Set(['+33612345678', '+33140000000']));
    expect(back.labeledPhones).toHaveLength(2);
    expect(back.labeledPhones?.[0]).toEqual({ e164: '+33612345678', rawLabel: 'mobile' });
  });

  it('gère les champs optionnels absents', () => {
    const raw: RawContact = {
      sourceId: 'device:1',
      provider: 'device',
      externalId: '1',
      displayName: 'Solo',
      emails: new Set(),
      phoneE164s: new Set(),
    };
    const back = rawContactFromJson(rawContactToJson(raw));
    expect(back.givenName).toBeUndefined();
    expect(back.labeledPhones).toBeUndefined();
    expect(back.phoneE164s.size).toBe(0);
  });
});
