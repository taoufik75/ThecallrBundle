import {
  availabilityMatches,
  proposableNumbers,
  type Contact,
  type ContextSnapshot,
  type PhoneNumber,
  type Suggestion,
} from './models';

/**
 * Poids du score additif. Constantes au MVP ; ajustés par apprentissage en
 * phase 2 sans changer la structure (donc sans perdre l'explicabilité).
 */
export interface ScoringWeights {
  readonly time: number;
  readonly event: number;
  readonly recency: number;
  readonly frequency: number;
  readonly preference: number;
  readonly stalePenalty: number;
  readonly sphereMismatchPenalty: number;
}

export const defaultWeights: ScoringWeights = {
  time: 0.3,
  event: 0.3,
  recency: 0.12,
  frequency: 0.1,
  preference: 0.1,
  stalePenalty: 0.35,
  sphereMismatchPenalty: 0.2,
};

interface ScoredNumber {
  readonly number: PhoneNumber;
  readonly score: number;
  readonly reasons: string[];
}

interface WeightedReason {
  readonly weight: number;
  readonly text: string;
}

const WORK_START_MINUTE = 8 * 60;
const WORK_END_MINUTE = 19 * 60;
const MINUTES_PER_DAY = 60 * 24;
const LN2 = Math.log(2);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Jour ISO 1-7 (1 = lundi … 7 = dimanche) à partir d'une Date. */
const isoDay = (d: Date): number => ((d.getDay() + 6) % 7) + 1;

const minutesOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();

const diffMinutes = (a: Date, b: Date): number =>
  (a.getTime() - b.getTime()) / 60000;

/**
 * Moteur de suggestion contextuelle.
 *
 * Pur et déterministe : à instantané égal, sortie égale. `now` provient du
 * snapshot (jamais de l'horloge) pour rester testable.
 */
export class ContextEngine {
  constructor(private readonly weights: ScoringWeights = defaultWeights) {}

  /**
   * Classe les contacts. Les favoris épinglés sont forcés en tête (triés entre
   * eux par score), suivis des autres par score décroissant.
   */
  rank(snapshot: ContextSnapshot): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const contact of snapshot.contacts) {
      const best = this.bestNumberFor(contact, snapshot);
      if (best === null) continue; // aucun numéro proposable
      suggestions.push({
        contact,
        bestNumber: best.number,
        score: best.score,
        reasons: best.reasons,
      });
    }

    suggestions.sort((a, b) => {
      const pa = a.contact.isFavoritePinned ? 1 : 0;
      const pb = b.contact.isFavoritePinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return b.score - a.score;
    });

    return suggestions;
  }

  private bestNumberFor(
    contact: Contact,
    snapshot: ContextSnapshot,
  ): ScoredNumber | null {
    let best: ScoredNumber | null = null;
    for (const number of proposableNumbers(contact)) {
      const scored = this.scoreNumber(contact, number, snapshot);
      if (best === null || scored.score > best.score) best = scored;
    }
    return best;
  }

  private scoreNumber(
    contact: Contact,
    number: PhoneNumber,
    snapshot: ContextSnapshot,
  ): ScoredNumber {
    const now = snapshot.now;
    const w = this.weights;

    const timeFit = this.timeFit(number, now);
    const eventRel = this.eventRelevance(contact, snapshot, now);
    const recency = this.recency(contact, snapshot, now);
    const frequency = this.frequency(contact, snapshot, now);
    const preference = this.userPreference(number);
    const stale = this.stalePenalty(number, now);
    const sphereMismatch = this.sphereMismatch(number, now);

    const score =
      w.time * timeFit +
      w.event * eventRel +
      w.recency * recency +
      w.frequency * frequency +
      w.preference * preference -
      w.stalePenalty * stale -
      w.sphereMismatchPenalty * sphereMismatch;

    const reasons: WeightedReason[] = [];
    if (eventRel > 0) {
      reasons.push({
        weight: w.event * eventRel,
        text: eventRel >= 1 ? 'rendez-vous en cours' : 'rendez-vous imminent',
      });
    }
    if (timeFit >= 1) {
      reasons.push({ weight: w.time * timeFit, text: 'créneau habituel de ce numéro' });
    }
    if (frequency > 0.3) {
      reasons.push({ weight: w.frequency * frequency, text: "vous l'appelez souvent" });
    } else if (recency > 0.5) {
      reasons.push({ weight: w.recency * recency, text: 'interaction récente' });
    }
    if (number.status === 'suspect') {
      reasons.push({ weight: 0, text: 'numéro à confirmer' });
    }
    if (contact.isFavoritePinned) {
      reasons.push({ weight: Number.POSITIVE_INFINITY, text: 'favori épinglé' });
    }

    reasons.sort((a, b) => b.weight - a.weight);
    return { number, score, reasons: reasons.map((r) => r.text) };
  }

  // --- Composantes (chacune normalisée dans [0, 1]) ---

  /** 1.0 dans une fenêtre `preferred`, 0.0 dans un `avoid`, 0.5 sinon. */
  private timeFit(number: PhoneNumber, now: Date): number {
    let matchedPreferred = false;
    for (const a of number.availabilities) {
      if (!availabilityMatches(a, now)) continue;
      if (a.kind === 'avoid') return 0;
      if (a.kind === 'preferred') matchedPreferred = true;
    }
    return matchedPreferred ? 1 : 0.5;
  }

  /**
   * Proximité avec un RDV impliquant le contact, dans [début − 45 min, fin].
   * Pendant l'événement : 1.0. Avant : rampe de 0.6 (à −45 min) à 1.0 (à 0).
   */
  private eventRelevance(
    contact: Contact,
    snapshot: ContextSnapshot,
    now: Date,
  ): number {
    let best = 0;
    for (const e of snapshot.upcomingEvents) {
      if (!e.participantContactIds.has(contact.id)) continue;
      const leadMinutes = diffMinutes(e.start, now);
      if (now >= e.start && now < e.end) {
        best = Math.max(best, 1);
      } else if (leadMinutes > 0 && leadMinutes <= 45) {
        best = Math.max(best, 1 - (leadMinutes / 45) * 0.4);
      }
    }
    return best;
  }

  /** Décroissance exponentielle depuis la dernière interaction (demi-vie 14 j). */
  private recency(contact: Contact, snapshot: ContextSnapshot, now: Date): number {
    const ids = this.numberIds(contact);
    let last: Date | null = null;
    for (const ev of snapshot.history) {
      if (!ids.has(ev.phoneNumberId)) continue;
      if (last === null || ev.occurredAt > last) last = ev.occurredAt;
    }
    if (last === null) return 0;
    const days = diffMinutes(now, last) / MINUTES_PER_DAY;
    return clamp01(Math.exp((-LN2 * days) / 14));
  }

  /** Fréquence sur 30 jours glissants, saturée à 10 interactions. */
  private frequency(contact: Contact, snapshot: ContextSnapshot, now: Date): number {
    const ids = this.numberIds(contact);
    const since = new Date(now.getTime() - 30 * MINUTES_PER_DAY * 60000);
    let count = 0;
    for (const ev of snapshot.history) {
      if (ids.has(ev.phoneNumberId) && ev.occurredAt > since) count++;
    }
    return clamp01(count / 10);
  }

  private userPreference(number: PhoneNumber): number {
    return clamp01(number.priority / 5);
  }

  /** Pénalité de fraîcheur : max si `suspect` ; sinon croît avec l'âge de vérif. */
  private stalePenalty(number: PhoneNumber, now: Date): number {
    if (number.status === 'suspect') return 1;
    const verified = number.lastVerifiedAt;
    if (verified === undefined) return 0.3;
    const days = diffMinutes(now, verified) / MINUTES_PER_DAY;
    return clamp01(days / 365) * 0.5;
  }

  /** Pénalise un numéro hors de sa sphère naturelle. */
  private sphereMismatch(number: PhoneNumber, now: Date): number {
    const inWork = this.isWorkHours(now);
    if (number.sphere === 'pro' && !inWork) return 1;
    if (number.sphere === 'perso' && inWork) return 0.6;
    return 0;
  }

  private isWorkHours(now: Date): boolean {
    const day = isoDay(now);
    if (day < 1 || day > 5) return false;
    const m = minutesOfDay(now);
    return m >= WORK_START_MINUTE && m < WORK_END_MINUTE;
  }

  private numberIds(contact: Contact): Set<string> {
    return new Set(contact.phoneNumbers.map((n) => n.id));
  }
}
