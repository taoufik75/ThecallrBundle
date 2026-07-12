import { describe, expect, it } from 'vitest';
import {
  DedupeService,
  type ContactProvider,
  type RawContact,
} from '../src/index';

function raw(init: {
  sourceId: string;
  provider?: ContactProvider;
  externalId?: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  emails?: string[];
  phones?: string[];
}): RawContact {
  return {
    sourceId: init.sourceId,
    provider: init.provider ?? 'device',
    externalId: init.externalId ?? init.sourceId,
    displayName: init.displayName,
    givenName: init.givenName,
    familyName: init.familyName,
    emails: new Set(init.emails ?? []),
    phoneE164s: new Set(init.phones ?? []),
  };
}

const dedupe = new DedupeService();

describe('DedupeService.findDuplicates', () => {
  it('numéro identique → un groupe de confiance haute', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Jean Dupont', phones: ['+33612345678'] }),
      raw({ sourceId: 'b', displayName: 'J. Dupont (pro)', phones: ['+33612345678'] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toHaveLength(2);
    expect(groups[0]!.confidence).toBe('high');
    expect(groups[0]!.reasons.has('samePhone')).toBe(true);
  });

  it('e-mail identique (casse/espaces ignorés) → confiance haute', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Marie Curie', emails: ['marie@lab.fr'], phones: ['+33600000001'] }),
      raw({ sourceId: 'b', displayName: 'M. Curie', emails: ['  MARIE@LAB.FR '], phones: ['+33600000002'] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.confidence).toBe('high');
    expect(groups[0]!.reasons.has('sameEmail')).toBe(true);
  });

  it('noms très proches sans signal fort → confiance basse', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Jean Dupont' }),
      raw({ sourceId: 'b', displayName: 'Jean Dupond' }), // t→d
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.confidence).toBe('low');
    expect([...groups[0]!.reasons]).toEqual(['similarName']);
  });

  it('accents et ponctuation neutralisés dans la comparaison de nom', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Hélène Éboué' }),
      raw({ sourceId: 'b', displayName: 'Helene Eboue' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.reasons.has('similarName')).toBe(true);
  });

  it('fiches sans rien en commun → aucun groupe', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Alice Martin', phones: ['+33611111111'] }),
      raw({ sourceId: 'b', displayName: 'Bob Durand', phones: ['+33622222222'] }),
    ]);

    expect(groups).toHaveLength(0);
  });

  it('transitivité : A–téléphone–B, B–email–C regroupe les trois', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Paul', phones: ['+33600000009'] }),
      raw({ sourceId: 'b', displayName: 'Paul B', phones: ['+33600000009'], emails: ['paul@x.fr'] }),
      raw({ sourceId: 'c', displayName: 'P. Bernard', emails: ['paul@x.fr'] }),
    ]);

    expect(groups).toHaveLength(1);
    expect(new Set(groups[0]!.members.map((m) => m.sourceId))).toEqual(
      new Set(['a', 'b', 'c']),
    );
    expect(groups[0]!.confidence).toBe('high');
  });

  it('les groupes de confiance haute sont classés avant les bas', () => {
    const groups = dedupe.findDuplicates([
      raw({ sourceId: 'n1', displayName: 'Théo Petit' }),
      raw({ sourceId: 'n2', displayName: 'Theo Petit' }),
      raw({ sourceId: 'p1', displayName: 'X', phones: ['+33633333333'] }),
      raw({ sourceId: 'p2', displayName: 'Y', phones: ['+33633333333'] }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.confidence).toBe('high');
    expect(groups[1]!.confidence).toBe('low');
  });
});

describe('DedupeService.buildDraft', () => {
  it('unifie numéros/e-mails et retient le nom le plus complet', () => {
    // Reliées par nom identique ; numéros/e-mails distincts à fusionner.
    const [group] = dedupe.findDuplicates([
      raw({ sourceId: 'a', displayName: 'Jean Dupont', phones: ['+33612345678'], emails: ['jean@perso.fr'] }),
      raw({
        sourceId: 'b',
        displayName: 'Jean Dupont',
        givenName: 'Jean',
        familyName: 'Dupont',
        phones: ['+33698765432'],
        emails: ['jean@pro.fr'],
      }),
    ]);

    const draft = dedupe.buildDraft(group!);
    expect(draft.displayName).toBe('Jean Dupont');
    expect(draft.givenName).toBe('Jean');
    expect(draft.phoneE164s).toEqual(new Set(['+33612345678', '+33698765432']));
    expect(draft.emails).toEqual(new Set(['jean@perso.fr', 'jean@pro.fr']));
    expect(draft.sourceIds).toEqual(expect.arrayContaining(['a', 'b']));
  });
});

describe('Propriétés', () => {
  it('déterminisme : même entrée → même sortie', () => {
    const input = [
      raw({ sourceId: 'a', displayName: 'Sam', phones: ['+33600000000'] }),
      raw({ sourceId: 'b', displayName: 'Sam', phones: ['+33600000000'] }),
    ];
    const g1 = dedupe.findDuplicates(input);
    const g2 = dedupe.findDuplicates(input);
    expect(g1[0]!.members.map((m) => m.sourceId)).toEqual(
      g2[0]!.members.map((m) => m.sourceId),
    );
  });
});
