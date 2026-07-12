import { describe, expect, it } from 'vitest';
import {
  mapRawLabel,
  unifyContacts,
  type ContactProvider,
  type RawContact,
  type RawPhone,
} from '../src/index';

function raw(init: {
  sourceId: string;
  provider?: ContactProvider;
  displayName: string;
  givenName?: string;
  familyName?: string;
  emails?: string[];
  phones?: RawPhone[];
}): RawContact {
  const phones = init.phones ?? [];
  return {
    sourceId: init.sourceId,
    provider: init.provider ?? 'device',
    externalId: init.sourceId,
    displayName: init.displayName,
    givenName: init.givenName,
    familyName: init.familyName,
    emails: new Set(init.emails ?? []),
    phoneE164s: new Set(phones.map((p) => p.e164)),
    labeledPhones: phones,
  };
}

describe('unifyContacts', () => {
  it('fusionne automatiquement un groupe de confiance haute (numéro partagé)', () => {
    const { contacts, reviewSuggestions } = unifyContacts([
      raw({
        sourceId: 'a',
        displayName: 'J. Dupont',
        phones: [{ e164: '+33612345678', rawLabel: 'mobile' }],
      }),
      raw({
        sourceId: 'b',
        displayName: 'Jean Dupont',
        givenName: 'Jean',
        familyName: 'Dupont',
        phones: [
          { e164: '+33612345678', rawLabel: 'mobile' },
          { e164: '+33140000000', rawLabel: 'work' },
        ],
      }),
    ]);

    expect(contacts).toHaveLength(1);
    expect(reviewSuggestions).toHaveLength(0);
    const c = contacts[0]!;
    // Nom le plus complet retenu.
    expect(c.displayName).toBe('Jean Dupont');
    // Numéros unifiés et dédupliqués par E.164.
    expect(c.phoneNumbers.map((n) => n.e164).sort()).toEqual([
      '+33140000000',
      '+33612345678',
    ]);
    // Typage dérivé des étiquettes natives.
    const work = c.phoneNumbers.find((n) => n.e164 === '+33140000000')!;
    expect(work.sphere).toBe('pro');
  });

  it('ne fusionne PAS un groupe de confiance basse mais le signale', () => {
    const { contacts, reviewSuggestions } = unifyContacts([
      raw({ sourceId: 'a', displayName: 'Jean Dupont' }),
      raw({ sourceId: 'b', displayName: 'Jean Dupond' }), // nom proche seulement
    ]);

    expect(contacts).toHaveLength(2); // restent séparés
    expect(reviewSuggestions).toHaveLength(1); // proposés à la revue
    expect(reviewSuggestions[0]!.confidence).toBe('low');
  });

  it('une fusion manuelle réunit un groupe de confiance basse et le sort de la revue', () => {
    const raws = [
      raw({ sourceId: 'a', displayName: 'Jean Dupont', phones: [{ e164: '+33611111111' }] }),
      raw({ sourceId: 'b', displayName: 'Jean Dupond', phones: [{ e164: '+33622222222' }] }),
    ];
    const { contacts, reviewSuggestions } = unifyContacts(raws, {
      manualMerges: [['a', 'b']],
    });

    expect(contacts).toHaveLength(1); // fusionnés par décision utilisateur
    expect(contacts[0]!.phoneNumbers.map((n) => n.e164).sort()).toEqual([
      '+33611111111',
      '+33622222222',
    ]);
    expect(reviewSuggestions).toHaveLength(0); // plus rien à trancher
  });

  it('un groupe ignoré ne réapparaît plus en revue mais reste séparé', () => {
    const raws = [
      raw({ sourceId: 'a', displayName: 'Jean Dupont' }),
      raw({ sourceId: 'b', displayName: 'Jean Dupond' }),
    ];
    const { contacts, reviewSuggestions } = unifyContacts(raws, {
      dismissed: [['a', 'b']],
    });

    expect(contacts).toHaveLength(2); // restent distincts
    expect(reviewSuggestions).toHaveLength(0); // masqués
  });

  it('construit un index e-mail → id de contact (pour l\'agenda)', () => {
    const { contacts, emailIndex } = unifyContacts([
      raw({
        sourceId: 'a',
        displayName: 'Camille',
        emails: ['Camille@X.fr'],
        phones: [{ e164: '+33612345678' }],
      }),
    ]);
    const id = contacts[0]!.id;
    // Normalisé en minuscules.
    expect(emailIndex.get('camille@x.fr')).toBe(id);
  });

  it('l\'index e-mail pointe vers le contact fusionné après fusion manuelle', () => {
    const { contacts, emailIndex } = unifyContacts(
      [
        raw({ sourceId: 'a', displayName: 'Léa', emails: ['lea.perso@x.fr'] }),
        raw({ sourceId: 'b', displayName: 'Léa Martin', emails: ['lea.pro@y.fr'] }),
      ],
      { manualMerges: [['a', 'b']] },
    );
    expect(contacts).toHaveLength(1);
    const id = contacts[0]!.id;
    expect(emailIndex.get('lea.perso@x.fr')).toBe(id);
    expect(emailIndex.get('lea.pro@y.fr')).toBe(id);
  });

  it('laisse passer les fiches uniques telles quelles', () => {
    const { contacts } = unifyContacts([
      raw({ sourceId: 'solo', displayName: 'Alice', phones: [{ e164: '+33611111111' }] }),
    ]);

    expect(contacts).toHaveLength(1);
    expect(contacts[0]!.displayName).toBe('Alice');
  });

  it('produit des identifiants déterministes', () => {
    const input = [
      raw({ sourceId: 'a', displayName: 'X', phones: [{ e164: '+33600000000' }] }),
      raw({ sourceId: 'b', displayName: 'X2', phones: [{ e164: '+33600000000' }] }),
    ];
    const first = unifyContacts(input).contacts.map((c) => c.id);
    const second = unifyContacts(input).contacts.map((c) => c.id);
    expect(first).toEqual(second);
  });
});

describe('mapRawLabel', () => {
  it('mobile/iphone → mobile perso', () => {
    expect(mapRawLabel('iPhone')).toEqual({ label: 'mobilePerso', sphere: 'perso' });
    expect(mapRawLabel('mobile')).toEqual({ label: 'mobilePerso', sphere: 'perso' });
  });
  it('work → sphère pro', () => {
    expect(mapRawLabel('work').sphere).toBe('pro');
  });
  it('home → domicile perso', () => {
    expect(mapRawLabel('home')).toEqual({ label: 'domicile', sphere: 'perso' });
  });
  it('inconnu → neutre', () => {
    expect(mapRawLabel(undefined)).toEqual({ label: 'autre', sphere: 'mixte' });
  });
});
