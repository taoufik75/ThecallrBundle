/**
 * Modèles unifiés de Contxt. Types purs, sans dépendance UI.
 *
 * On utilise des unions de chaînes littérales plutôt que des enums TS : plus
 * simples à sérialiser (JSON, base) et idiomatiques côté React Native.
 */

/** Sphère d'un contact ou d'un numéro. */
export type Sphere = 'pro' | 'perso' | 'mixte';

/** Type/étiquette d'un numéro. */
export type PhoneLabel =
  | 'mobilePerso'
  | 'mobilePro'
  | 'fixeBureau'
  | 'domicile'
  | 'autre';

/**
 * État de fraîcheur d'un numéro.
 * - `active`  : valide, proposable.
 * - `suspect` : signalé douteux, fortement pénalisé.
 * - `retired` : périmé, jamais proposé (mais conservé).
 */
export type PhoneStatus = 'active' | 'suspect' | 'retired';

/** Nature d'une fenêtre de disponibilité. */
export type AvailabilityKind = 'preferred' | 'avoid';

export type CallDirection = 'outgoing' | 'incoming' | 'missed';
export type CallChannel = 'call' | 'sms';

/** Provenance d'une fiche importée. */
export type ContactProvider = 'device' | 'google' | 'carddav';

/**
 * Fenêtre de joignabilité d'un numéro.
 * `daysOfWeek` : 1 = lundi … 7 = dimanche (comme Date.getDay() décalé, voir helpers).
 * Bornes en minutes depuis minuit (540 = 09:00).
 */
export interface Availability {
  readonly daysOfWeek: ReadonlySet<number>;
  readonly startMinute: number;
  readonly endMinute: number;
  readonly kind: AvailabilityKind;
}

/** Un numéro typé et contextualisé. Plusieurs par contact. */
export interface PhoneNumber {
  readonly id: string;
  /** Numéro normalisé E.164 — clé de comparaison/déduplication. */
  readonly e164: string;
  readonly label: PhoneLabel;
  readonly sphere: Sphere;
  /** Préférence de base fixée par l'utilisateur (0 = neutre). */
  readonly priority: number;
  readonly status: PhoneStatus;
  readonly lastVerifiedAt?: Date;
  readonly availabilities: readonly Availability[];
}

/** Personne unifiée, issue de la fusion d'une ou plusieurs fiches sources. */
export interface Contact {
  readonly id: string;
  readonly displayName: string;
  readonly sphere: Sphere;
  /** Favori épinglé : force la présence en tête, indépendamment du score. */
  readonly isFavoritePinned: boolean;
  readonly phoneNumbers: readonly PhoneNumber[];
}

/** Trace d'une interaction passée (récence/fréquence, surtout phase 2). */
export interface CallEvent {
  readonly phoneNumberId: string;
  readonly direction: CallDirection;
  readonly channel: CallChannel;
  readonly occurredAt: Date;
  readonly succeeded?: boolean;
}

/**
 * Événement d'agenda (lecture seule). `participantContactIds` est résolu en
 * amont par la couche data — le moteur reste purement algorithmique.
 */
export interface CalendarEvent {
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly participantContactIds: ReadonlySet<string>;
}

/** Instantané de tout ce dont le moteur a besoin pour classer les contacts. */
export interface ContextSnapshot {
  readonly now: Date;
  readonly contacts: readonly Contact[];
  readonly upcomingEvents: readonly CalendarEvent[];
  readonly history: readonly CallEvent[];
}

/** Résultat unitaire du moteur. */
export interface Suggestion {
  readonly contact: Contact;
  readonly bestNumber: PhoneNumber;
  readonly score: number;
  /** Explications lisibles, triées par poids décroissant. */
  readonly reasons: readonly string[];
}

/** Fiche brute importée, avant unification (matière première du dedupe). */
export interface RawContact {
  readonly sourceId: string;
  readonly provider: ContactProvider;
  /** Identifiant stable côté source — garantit l'idempotence des ré-imports. */
  readonly externalId: string;
  readonly displayName: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly emails: ReadonlySet<string>;
  readonly phoneE164s: ReadonlySet<string>;
}

/** Signal ayant motivé un rapprochement. */
export type MatchReason = 'samePhone' | 'sameEmail' | 'similarName';

/** Confiance d'un groupe de doublons. */
export type MergeConfidence = 'high' | 'low';

/** Groupe de fiches désignant vraisemblablement la même personne. */
export interface MergeGroup {
  readonly members: readonly RawContact[];
  readonly reasons: ReadonlySet<MatchReason>;
  readonly confidence: MergeConfidence;
}

/** Aperçu non destructif de la fiche unifiée résultant d'une fusion. */
export interface MergedContactDraft {
  readonly displayName: string;
  readonly givenName?: string;
  readonly familyName?: string;
  readonly emails: ReadonlySet<string>;
  readonly phoneE164s: ReadonlySet<string>;
  readonly sourceIds: readonly string[];
}

// --- Fabriques pratiques (valeurs par défaut) ---

export function makePhoneNumber(
  init: Pick<PhoneNumber, 'id' | 'e164' | 'label' | 'sphere'> &
    Partial<PhoneNumber>,
): PhoneNumber {
  return {
    priority: 0,
    status: 'active',
    availabilities: [],
    ...init,
  };
}

export function makeContact(
  init: Pick<Contact, 'id' | 'displayName'> & Partial<Contact>,
): Contact {
  return {
    sphere: 'mixte',
    isFavoritePinned: false,
    phoneNumbers: [],
    ...init,
  };
}

/** Numéros qu'un moteur a le droit de proposer (les périmés sont exclus). */
export function proposableNumbers(contact: Contact): PhoneNumber[] {
  return contact.phoneNumbers.filter((n) => n.status !== 'retired');
}

/** Vrai si `when` tombe dans la fenêtre (jour ISO 1-7 + plage horaire). */
export function availabilityMatches(a: Availability, when: Date): boolean {
  const isoDay = ((when.getDay() + 6) % 7) + 1; // JS 0=dim → ISO 1=lun..7=dim
  if (!a.daysOfWeek.has(isoDay)) return false;
  const minutes = when.getHours() * 60 + when.getMinutes();
  return minutes >= a.startMinute && minutes < a.endMinute;
}
