import { DedupeService } from './dedupeService';
import {
  makeContact,
  makePhoneNumber,
  type Contact,
  type MergeGroup,
  type PhoneLabel,
  type PhoneNumber,
  type RawContact,
  type Sphere,
} from './models';

/**
 * Résultat de l'unification d'un lot de fiches brutes.
 * - `contacts` : les contacts unifiés, prêts pour le moteur.
 * - `reviewSuggestions` : groupes de doublons **non** fusionnés automatiquement
 *   (confiance basse), à confirmer par l'utilisateur.
 */
export interface UnifyResult {
  readonly contacts: Contact[];
  readonly reviewSuggestions: MergeGroup[];
}

/**
 * Transforme des `RawContact` importés en `Contact` unifiés, en appliquant le
 * `DedupeService` :
 * - les groupes de **confiance haute** (numéro/e-mail partagé) sont fusionnés
 *   automatiquement en une seule fiche ;
 * - les groupes de **confiance basse** (nom proche seulement) ne sont PAS
 *   fusionnés — chaque membre reste un contact, et le groupe est renvoyé pour
 *   revue manuelle.
 *
 * Déterministe : les identifiants produits dérivent du contenu, pas de l'horloge.
 */
export function unifyContacts(
  raws: readonly RawContact[],
  dedupe: DedupeService = new DedupeService(),
): UnifyResult {
  const groups = dedupe.findDuplicates(raws);
  const highGroups = groups.filter((g) => g.confidence === 'high');
  const reviewSuggestions = groups.filter((g) => g.confidence === 'low');

  const mergedSourceIds = new Set<string>();
  for (const g of highGroups) {
    for (const m of g.members) mergedSourceIds.add(m.sourceId);
  }

  const contacts: Contact[] = [];

  // 1. Un contact fusionné par groupe de confiance haute.
  for (const g of highGroups) {
    contacts.push(buildContact(g.members));
  }

  // 2. Un contact par fiche non absorbée dans une fusion automatique.
  for (const raw of raws) {
    if (!mergedSourceIds.has(raw.sourceId)) contacts.push(buildContact([raw]));
  }

  return { contacts, reviewSuggestions };
}

/** Construit une fiche unifiée à partir d'une ou plusieurs fiches brutes. */
export function buildContact(members: readonly RawContact[]): Contact {
  const id = contactIdFor(members);
  const named = mostComplete(members);

  const seen = new Set<string>();
  const phoneNumbers: PhoneNumber[] = [];
  for (const m of members) {
    for (const rp of labeledPhonesOf(m)) {
      if (seen.has(rp.e164)) continue;
      seen.add(rp.e164);
      const { label, sphere } = mapRawLabel(rp.rawLabel);
      phoneNumbers.push(
        makePhoneNumber({ id: rp.e164, e164: rp.e164, label, sphere }),
      );
    }
  }

  return makeContact({
    id,
    displayName: named.displayName,
    phoneNumbers,
  });
}

/** Identifiant de contact stable, dérivé des sources triées. */
function contactIdFor(members: readonly RawContact[]): string {
  const ids = members.map((m) => `${m.provider}:${m.externalId}`).sort();
  return ids.join('|');
}

function mostComplete(members: readonly RawContact[]): RawContact {
  let best = members[0]!;
  for (const m of members) {
    if (completeness(m) > completeness(best)) best = m;
  }
  return best;
}

function completeness(c: RawContact): number {
  let score = c.displayName.trim().length;
  if (c.givenName) score += 2;
  if (c.familyName) score += 2;
  return score;
}

/** Numéros étiquetés d'une fiche ; retombe sur `phoneE164s` si absents. */
function labeledPhonesOf(c: RawContact): readonly { e164: string; rawLabel?: string }[] {
  if (c.labeledPhones && c.labeledPhones.length > 0) return c.labeledPhones;
  return [...c.phoneE164s].map((e164) => ({ e164 }));
}

/**
 * Mappe l'étiquette native d'un numéro vers un type + une sphère Contxt.
 * Heuristique volontairement simple, ajustable ; le défaut est neutre.
 */
export function mapRawLabel(rawLabel?: string): {
  label: PhoneLabel;
  sphere: Sphere;
} {
  const l = (rawLabel ?? '').toLowerCase();
  if (/(iphone|mobile|cell|portable|perso)/.test(l)) {
    return { label: 'mobilePerso', sphere: 'perso' };
  }
  if (/(work|bureau|office|pro|travail|boulot)/.test(l)) {
    // On ne peut pas distinguer mobile pro d'un fixe pro sans plus d'info :
    // par défaut fixe bureau, sphère pro.
    return { label: 'fixeBureau', sphere: 'pro' };
  }
  if (/(home|domicile|maison|fixe|landline)/.test(l)) {
    return { label: 'domicile', sphere: 'perso' };
  }
  return { label: 'autre', sphere: 'mixte' };
}
