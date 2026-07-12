import type { RawContact, RawPhone } from 'contxt-domain';
import type { CountryCode } from 'libphonenumber-js';
import { normalizeToE164 } from './phone';

/** Formes minimales d'une personne renvoyée par l'API Google People. */
export interface GooglePersonName {
  readonly displayName?: string;
  readonly givenName?: string;
  readonly familyName?: string;
}
export interface GooglePersonPhone {
  readonly value?: string;
  readonly type?: string;
  readonly formattedType?: string;
}
export interface GooglePersonEmail {
  readonly value?: string;
}
export interface GooglePerson {
  /** ex. "people/c12345" — identifiant stable. */
  readonly resourceName: string;
  readonly names?: readonly GooglePersonName[];
  readonly phoneNumbers?: readonly GooglePersonPhone[];
  readonly emailAddresses?: readonly GooglePersonEmail[];
}

/** Convertit une personne Google People en `RawContact` (provider = google). */
export function googlePersonToRaw(
  p: GooglePerson,
  region: CountryCode = 'FR',
): RawContact {
  const name = p.names?.[0];

  const e164s = new Set<string>();
  const labeledPhones: RawPhone[] = [];
  for (const ph of p.phoneNumbers ?? []) {
    const e164 = normalizeToE164(ph.value, region);
    if (!e164 || e164s.has(e164)) continue;
    e164s.add(e164);
    labeledPhones.push({ e164, rawLabel: ph.type ?? ph.formattedType });
  }

  const emails = new Set<string>();
  for (const em of p.emailAddresses ?? []) {
    if (em.value) emails.add(em.value);
  }

  const displayName =
    name?.displayName?.trim() ||
    [name?.givenName, name?.familyName].filter(Boolean).join(' ').trim() ||
    '(sans nom)';

  return {
    sourceId: `google:${p.resourceName}`,
    provider: 'google',
    externalId: p.resourceName,
    displayName,
    givenName: name?.givenName,
    familyName: name?.familyName,
    emails,
    phoneE164s: e164s,
    labeledPhones,
  };
}
