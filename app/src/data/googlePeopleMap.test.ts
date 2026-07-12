import { describe, expect, it } from 'vitest';
import { DedupeService, type RawContact } from 'contxt-domain';
import { googlePersonToRaw, type GooglePerson } from './googlePeopleMap';
import { nativeContactToRaw } from './mappers';

describe('googlePersonToRaw', () => {
  it('mappe une personne Google, provider = google, numéros E.164', () => {
    const person: GooglePerson = {
      resourceName: 'people/c1',
      names: [{ displayName: 'Marie Curie', givenName: 'Marie', familyName: 'Curie' }],
      phoneNumbers: [{ value: '06 12 34 56 78', type: 'mobile' }],
      emailAddresses: [{ value: 'marie@lab.fr' }],
    };
    const raw = googlePersonToRaw(person);

    expect(raw.provider).toBe('google');
    expect(raw.sourceId).toBe('google:people/c1');
    expect(raw.displayName).toBe('Marie Curie');
    expect([...raw.phoneE164s]).toEqual(['+33612345678']);
    expect([...raw.emails]).toEqual(['marie@lab.fr']);
  });
});

describe('dédup inter-sources (device ↔ google)', () => {
  it('rapproche la même personne présente dans le carnet et dans Google', () => {
    const device: RawContact = nativeContactToRaw({
      id: 'd1',
      name: 'Jean Dupont',
      phoneNumbers: [{ number: '06 12 34 56 78', label: 'mobile' }],
    });
    const google: RawContact = googlePersonToRaw({
      resourceName: 'people/c9',
      names: [{ displayName: 'J. Dupont' }],
      phoneNumbers: [{ value: '+33612345678' }], // même numéro
    });

    const groups = new DedupeService().findDuplicates([device, google]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.confidence).toBe('high');
    expect(groups[0]!.reasons.has('samePhone')).toBe(true);
    // Une fiche de chaque source.
    const providers = groups[0]!.members.map((m) => m.provider).sort();
    expect(providers).toEqual(['device', 'google']);
  });
});
