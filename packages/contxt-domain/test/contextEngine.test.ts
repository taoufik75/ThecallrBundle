import { describe, expect, it } from 'vitest';
import {
  ContextEngine,
  makeContact,
  makePhoneNumber,
  type Availability,
  type CalendarEvent,
  type CallEvent,
  type Contact,
  type ContextSnapshot,
  type PhoneLabel,
  type PhoneNumber,
  type Sphere,
} from '../src/index';

// Jours de référence : 2024-01-08 = lundi, 2024-01-07 = dimanche (heure locale).
const mondayMorning = new Date(2024, 0, 8, 9, 0);
const mondayMidMorning = new Date(2024, 0, 8, 10, 0);
const sundayEvening = new Date(2024, 0, 7, 21, 0);
const verified = new Date(2024, 0, 8, 8, 0);

function num(
  id: string,
  label: PhoneLabel,
  sphere: Sphere,
  extra: Partial<PhoneNumber> = {},
): PhoneNumber {
  return makePhoneNumber({
    id,
    e164: `+3360000${Math.abs(hash(id)) % 10000}`,
    label,
    sphere,
    lastVerifiedAt: verified,
    ...extra,
  });
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function snapshot(init: Partial<ContextSnapshot> & Pick<ContextSnapshot, 'now' | 'contacts'>): ContextSnapshot {
  return { upcomingEvents: [], history: [], ...init };
}

const engine = new ContextEngine();

describe('ContextEngine.rank — scénarios de spécification', () => {
  it('1. Matin ouvré + RDV imminent → contact du RDV en tête, sur son pro', () => {
    const camille = makeContact({
      id: 'camille',
      displayName: 'Camille Dubois',
      phoneNumbers: [
        num('cam_pro', 'mobilePro', 'pro'),
        num('cam_perso', 'mobilePerso', 'perso'),
      ],
    });
    const bob = makeContact({
      id: 'bob',
      displayName: 'Bob Martin',
      phoneNumbers: [num('bob_perso', 'mobilePerso', 'perso')],
    });

    const event: CalendarEvent = {
      title: 'Point projet',
      start: new Date(mondayMorning.getTime() + 18 * 60000),
      end: new Date(mondayMorning.getTime() + 48 * 60000),
      participantContactIds: new Set(['camille']),
    };

    const ranked = engine.rank(
      snapshot({ now: mondayMorning, contacts: [bob, camille], upcomingEvents: [event] }),
    );

    expect(ranked[0]!.contact.id).toBe('camille');
    expect(ranked[0]!.bestNumber.id).toBe('cam_pro');
    expect(ranked[0]!.reasons).toContain('rendez-vous imminent');
  });

  it('2. Dimanche 21h → le numéro perso est préféré au pro', () => {
    const contact = makeContact({
      id: 'alex',
      displayName: 'Alex',
      phoneNumbers: [
        num('alex_pro', 'fixeBureau', 'pro'),
        num('alex_perso', 'mobilePerso', 'perso'),
      ],
    });

    const ranked = engine.rank(snapshot({ now: sundayEvening, contacts: [contact] }));
    expect(ranked[0]!.bestNumber.id).toBe('alex_perso');
  });

  it("3a. Un numéro périmé n'est jamais proposé ; l'actif remonte", () => {
    const contact = makeContact({
      id: 'chris',
      displayName: 'Chris',
      phoneNumbers: [
        num('chris_old', 'mobilePerso', 'perso', { status: 'retired' }),
        num('chris_new', 'mobilePerso', 'perso'),
      ],
    });

    const ranked = engine.rank(snapshot({ now: sundayEvening, contacts: [contact] }));
    expect(ranked[0]!.bestNumber.id).toBe('chris_new');
  });

  it('3b. Un contact sans aucun numéro proposable est ignoré', () => {
    const contact = makeContact({
      id: 'ghost',
      displayName: 'Ghost',
      phoneNumbers: [num('ghost_old', 'mobilePerso', 'perso', { status: 'retired' })],
    });

    const ranked = engine.rank(snapshot({ now: sundayEvening, contacts: [contact] }));
    expect(ranked).toHaveLength(0);
  });

  it("3c. Un numéro suspect est déclassé au profit de l'actif", () => {
    const contact = makeContact({
      id: 'dana',
      displayName: 'Dana',
      phoneNumbers: [
        num('dana_suspect', 'mobilePerso', 'perso', { status: 'suspect' }),
        num('dana_ok', 'mobilePerso', 'perso'),
      ],
    });

    const ranked = engine.rank(snapshot({ now: sundayEvening, contacts: [contact] }));
    expect(ranked[0]!.bestNumber.id).toBe('dana_ok');
  });

  it('4. Un favori épinglé est en tête même hors de son créneau', () => {
    const pinned = makeContact({
      id: 'vip',
      displayName: 'VIP',
      isFavoritePinned: true,
      phoneNumbers: [num('vip_pro', 'fixeBureau', 'pro')],
    });
    const regular = makeContact({
      id: 'reg',
      displayName: 'Régulier',
      phoneNumbers: [num('reg_perso', 'mobilePerso', 'perso')],
    });

    const ranked = engine.rank(snapshot({ now: sundayEvening, contacts: [regular, pinned] }));
    expect(ranked[0]!.contact.id).toBe('vip');
    expect(ranked[0]!.reasons).toContain('favori épinglé');
    // Le régulier scorerait plus haut sans l'épinglage.
    expect(ranked[0]!.score).toBeLessThan(ranked[ranked.length - 1]!.score);
  });

  it('5. Entre un créneau à éviter et un créneau préféré, le préféré gagne', () => {
    const windowMon = new Set([1]); // lundi (ISO)
    const avoid: Availability = {
      daysOfWeek: windowMon,
      startMinute: 9 * 60,
      endMinute: 12 * 60,
      kind: 'avoid',
    };
    const preferred: Availability = { ...avoid, kind: 'preferred' };

    const contact = makeContact({
      id: 'sam',
      displayName: 'Sam',
      phoneNumbers: [
        num('sam_avoid', 'mobilePerso', 'perso', { availabilities: [avoid] }),
        num('sam_pref', 'fixeBureau', 'perso', { availabilities: [preferred] }),
      ],
    });

    const ranked = engine.rank(snapshot({ now: mondayMidMorning, contacts: [contact] }));
    expect(ranked[0]!.bestNumber.id).toBe('sam_pref');
  });
});

describe('Propriétés du moteur', () => {
  it('déterminisme : même instantané → même sortie', () => {
    const contact = makeContact({
      id: 'x',
      displayName: 'X',
      phoneNumbers: [
        num('x1', 'mobilePerso', 'perso'),
        num('x2', 'mobilePro', 'pro'),
      ],
    });
    const snap = snapshot({ now: mondayMorning, contacts: [contact] });

    const a = engine.rank(snap);
    const b = engine.rank(snap);
    expect(a.length).toBe(b.length);
    a.forEach((s, i) => {
      expect(s.bestNumber.id).toBe(b[i]!.bestNumber.id);
      expect(s.score).toBe(b[i]!.score);
    });
  });

  it("la fréquence d'appels fait remonter un contact", () => {
    const often = makeContact({
      id: 'often',
      displayName: 'Souvent',
      phoneNumbers: [num('often_n', 'mobilePerso', 'perso')],
    });
    const rare = makeContact({
      id: 'rare',
      displayName: 'Rarement',
      phoneNumbers: [num('rare_n', 'mobilePerso', 'perso')],
    });

    const history: CallEvent[] = [];
    for (let i = 1; i <= 8; i++) {
      history.push({
        phoneNumberId: 'often_n',
        direction: 'outgoing',
        channel: 'call',
        occurredAt: new Date(mondayMorning.getTime() - i * 24 * 3600 * 1000),
      });
    }

    const ranked = engine.rank(
      snapshot({ now: mondayMorning, contacts: [rare, often], history }),
    );
    expect(ranked[0]!.contact.id).toBe('often');
    expect(ranked[0]!.reasons).toContain("vous l'appelez souvent");
  });
});
