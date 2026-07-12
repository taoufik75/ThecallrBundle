import type { CalendarEvent, ContactProvider, RawContact, RawPhone } from 'contxt-domain';
import type { CountryCode } from 'libphonenumber-js';
import { normalizeToE164 } from './phone';

/**
 * Formes natives minimales attendues des modules Expo. On les redéclare ici
 * (plutôt que d'importer les types d'`expo-contacts`/`expo-calendar`) pour que
 * ces mappers restent **purs** — donc testables sans les modules natifs.
 */
export interface NativePhone {
  readonly number?: string;
  readonly label?: string;
}
export interface NativeEmail {
  readonly email?: string;
}
export interface NativeContact {
  readonly id: string;
  readonly name?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phoneNumbers?: readonly NativePhone[];
  readonly emails?: readonly NativeEmail[];
}
export interface NativeEvent {
  readonly title?: string;
  readonly startDate: string | Date;
  readonly endDate: string | Date;
  readonly attendeeEmails?: readonly string[];
}

/** Convertit un contact natif en `RawContact` (numéros normalisés E.164). */
export function nativeContactToRaw(
  c: NativeContact,
  provider: ContactProvider = 'device',
  region: CountryCode = 'FR',
): RawContact {
  const e164s = new Set<string>();
  const labeledPhones: RawPhone[] = [];
  for (const p of c.phoneNumbers ?? []) {
    const e164 = normalizeToE164(p.number, region);
    if (!e164 || e164s.has(e164)) continue;
    e164s.add(e164);
    labeledPhones.push({ e164, rawLabel: p.label });
  }

  const emails = new Set<string>();
  for (const em of c.emails ?? []) {
    if (em.email) emails.add(em.email);
  }

  const displayName =
    c.name?.trim() ||
    [c.firstName, c.lastName].filter(Boolean).join(' ').trim() ||
    '(sans nom)';

  return {
    sourceId: `${provider}:${c.id}`,
    provider,
    externalId: c.id,
    displayName,
    givenName: c.firstName,
    familyName: c.lastName,
    emails,
    phoneE164s: e164s,
    labeledPhones,
  };
}

/**
 * Convertit un événement natif en `CalendarEvent`. Les participants sont résolus
 * en amont : `emailToContactId` mappe l'e-mail d'un participant vers l'id du
 * contact unifié correspondant.
 */
export function nativeEventToCalendarEvent(
  e: NativeEvent,
  emailToContactId: ReadonlyMap<string, string>,
): CalendarEvent {
  const participantContactIds = new Set<string>();
  for (const email of e.attendeeEmails ?? []) {
    const id = emailToContactId.get(email.trim().toLowerCase());
    if (id) participantContactIds.add(id);
  }
  return {
    title: e.title ?? '(sans titre)',
    start: new Date(e.startDate),
    end: new Date(e.endDate),
    participantContactIds,
  };
}
