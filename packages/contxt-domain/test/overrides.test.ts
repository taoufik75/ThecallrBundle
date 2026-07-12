import { describe, expect, it } from 'vitest';
import {
  applyOverrides,
  makeContact,
  makePhoneNumber,
  type Contact,
  type ContactOverrides,
} from '../src/index';

function contact(): Contact {
  return makeContact({
    id: 'c1',
    displayName: 'Jean',
    phoneNumbers: [
      makePhoneNumber({ id: '+33612345678', e164: '+33612345678', label: 'autre', sphere: 'mixte' }),
    ],
  });
}

describe('applyOverrides', () => {
  it('épingle un contact en favori', () => {
    const overrides: ContactOverrides = { c1: { isFavoritePinned: true } };
    const [c] = applyOverrides([contact()], overrides);
    expect(c!.isFavoritePinned).toBe(true);
  });

  it('réécrit type, sphère, statut et priorité d\'un numéro', () => {
    const overrides: ContactOverrides = {
      c1: {
        phones: {
          '+33612345678': {
            label: 'mobilePro',
            sphere: 'pro',
            status: 'retired',
            priority: 3,
          },
        },
      },
    };
    const [c] = applyOverrides([contact()], overrides);
    const n = c!.phoneNumbers[0]!;
    expect(n.label).toBe('mobilePro');
    expect(n.sphere).toBe('pro');
    expect(n.status).toBe('retired');
    expect(n.priority).toBe(3);
  });

  it('laisse un champ non spécifié inchangé', () => {
    const overrides: ContactOverrides = {
      c1: { phones: { '+33612345678': { status: 'suspect' } } },
    };
    const [c] = applyOverrides([contact()], overrides);
    const n = c!.phoneNumbers[0]!;
    expect(n.status).toBe('suspect');
    expect(n.label).toBe('autre'); // inchangé
  });

  it('ne touche pas un contact sans override', () => {
    const original = contact();
    const [c] = applyOverrides([original], {});
    expect(c).toBe(original); // même référence
  });
});
