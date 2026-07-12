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
 *   (confiance basse) et non encore tranchés par l'utilisateur.
 */
export interface UnifyResult {
  readonly contacts: Contact[];
  readonly reviewSuggestions: MergeGroup[];
  /**
   * Index e-mail (normalisé minuscule) → identifiant du contact unifié. Sert à
   * relier les participants d'un événement d'agenda aux bons contacts.
   */
  readonly emailIndex: Map<string, string>;
}

export interface UnifyOptions {
  /** Service de dédup (injectable pour les tests). */
  readonly dedupe?: DedupeService;
  /**
   * Fusions confirmées par l'utilisateur : chaque entrée est un ensemble de
   * `sourceId` que l'utilisateur a déclarés comme une même personne. Traitées
   * comme un signal fort (fusion appliquée).
   */
  readonly manualMerges?: readonly (readonly string[])[];
  /**
   * Groupes que l'utilisateur a choisi d'ignorer : chaque entrée est l'ensemble
   * des `sourceId` du groupe. Ces groupes ne réapparaissent plus en revue.
   */
  readonly dismissed?: readonly (readonly string[])[];
}

/**
 * Transforme des `RawContact` importés en `Contact` unifiés, en appliquant le
 * `DedupeService` et les décisions de l'utilisateur :
 * - fusion automatique des groupes de **confiance haute** (numéro/e-mail) ;
 * - fusion des **fusions manuelles** confirmées ;
 * - les groupes de **confiance basse** restants (ni fusionnés, ni ignorés) sont
 *   renvoyés pour revue.
 *
 * Déterministe : les identifiants dérivent du contenu, jamais de l'horloge.
 */
export function unifyContacts(
  raws: readonly RawContact[],
  options: UnifyOptions = {},
): UnifyResult {
  const dedupe = options.dedupe ?? new DedupeService();
  const manualMerges = options.manualMerges ?? [];
  const dismissedKeys = new Set((options.dismissed ?? []).map(keyOf));

  const groups = dedupe.findDuplicates(raws);
  const indexBySource = new Map(raws.map((r, i) => [r.sourceId, i]));
  const uf = new UnionFind(raws.length);

  // Signaux forts : fusion automatique.
  for (const g of groups) {
    if (g.confidence === 'high') {
      unionSources(uf, g.members.map((m) => m.sourceId), indexBySource);
    }
  }
  // Confirmations manuelles.
  for (const set of manualMerges) unionSources(uf, set, indexBySource);

  // Composantes connexes → contacts.
  const components = new Map<number, number[]>();
  for (let i = 0; i < raws.length; i++) {
    const root = uf.find(i);
    const list = components.get(root);
    if (list) list.push(i);
    else components.set(root, [i]);
  }
  const contacts: Contact[] = [];
  const emailIndex = new Map<string, string>();
  for (const idxs of components.values()) {
    const members = idxs.map((i) => raws[i]!);
    const contact = buildContact(members);
    contacts.push(contact);
    for (const m of members) {
      for (const email of m.emails) {
        emailIndex.set(email.trim().toLowerCase(), contact.id);
      }
    }
  }

  // Revue : groupes de confiance basse encore séparés et non ignorés.
  const reviewSuggestions = groups.filter((g) => {
    if (g.confidence !== 'low') return false;
    if (dismissedKeys.has(keyOf(g.members.map((m) => m.sourceId)))) return false;
    const roots = new Set(
      g.members.map((m) => uf.find(indexBySource.get(m.sourceId)!)),
    );
    return roots.size > 1; // pas encore fusionnés
  });

  return { contacts, reviewSuggestions, emailIndex };
}

/** Clé canonique d'un ensemble de sourceIds (indépendante de l'ordre). */
function keyOf(sourceIds: readonly string[]): string {
  return [...sourceIds].sort().join('|');
}

function unionSources(
  uf: UnionFind,
  sourceIds: readonly string[],
  indexBySource: ReadonlyMap<string, number>,
): void {
  const indices = sourceIds
    .map((s) => indexBySource.get(s))
    .filter((i): i is number => i !== undefined);
  for (let k = 1; k < indices.length; k++) uf.union(indices[0]!, indices[k]!);
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

  return makeContact({ id, displayName: named.displayName, phoneNumbers });
}

/** Identifiant de contact stable, dérivé des sources triées. */
function contactIdFor(members: readonly RawContact[]): string {
  return members
    .map((m) => `${m.provider}:${m.externalId}`)
    .sort()
    .join('|');
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
function labeledPhonesOf(
  c: RawContact,
): readonly { e164: string; rawLabel?: string }[] {
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
    return { label: 'fixeBureau', sphere: 'pro' };
  }
  if (/(home|domicile|maison|fixe|landline)/.test(l)) {
    return { label: 'domicile', sphere: 'perso' };
  }
  return { label: 'autre', sphere: 'mixte' };
}

/** Union-find avec compression de chemin. */
class UnionFind {
  private readonly parent: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!;
      x = this.parent[x]!;
    }
    return x;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}
