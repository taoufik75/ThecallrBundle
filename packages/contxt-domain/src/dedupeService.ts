import type {
  MatchReason,
  MergeConfidence,
  MergedContactDraft,
  MergeGroup,
  RawContact,
} from './models';

/**
 * Détecte les fiches en double parmi des `RawContact` importés et prépare des
 * fusions **suggérées** (non destructives).
 *
 * Stratégie (cf. docs/03) : on relie deux fiches partageant un signal fort
 * (numéro ou e-mail identique) ou des noms très proches, puis on regroupe les
 * composantes connexes (union-find). Un groupe avec signal fort est de confiance
 * `high` ; un groupe fondé sur le seul nom est `low` (revue manuelle).
 */
export class DedupeService {
  constructor(private readonly nameSimilarityThreshold = 0.85) {}

  /** Groupes de doublons (taille ≥ 2), confiance haute d'abord puis par taille. */
  findDuplicates(contacts: readonly RawContact[]): MergeGroup[] {
    const n = contacts.length;
    const uf = new UnionFind(n);
    const edges: Edge[] = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const reasons = this.reasonsFor(contacts[i]!, contacts[j]!);
        if (reasons.size === 0) continue;
        uf.union(i, j);
        edges.push({ a: i, b: j, reasons });
      }
    }

    const byRoot = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      const list = byRoot.get(root);
      if (list) list.push(i);
      else byRoot.set(root, [i]);
    }

    const groups: MergeGroup[] = [];
    for (const indices of byRoot.values()) {
      if (indices.length < 2) continue;
      const indexSet = new Set(indices);
      const reasons = new Set<MatchReason>();
      for (const e of edges) {
        if (indexSet.has(e.a) && indexSet.has(e.b)) {
          for (const r of e.reasons) reasons.add(r);
        }
      }
      groups.push({
        members: indices.map((i) => contacts[i]!),
        reasons,
        confidence: confidenceOf(reasons),
      });
    }

    groups.sort((a, b) => {
      const ca = a.confidence === 'high' ? 1 : 0;
      const cb = b.confidence === 'high' ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return b.members.length - a.members.length;
    });
    return groups;
  }

  /**
   * Aperçu de fusion : union des numéros/e-mails, nom le plus complet retenu.
   * Ne modifie rien.
   */
  buildDraft(group: MergeGroup): MergedContactDraft {
    const emails = new Set<string>();
    const phones = new Set<string>();
    const sourceIds: string[] = [];
    let bestNamed: RawContact | null = null;

    for (const m of group.members) {
      for (const e of m.emails) emails.add(e);
      for (const p of m.phoneE164s) phones.add(p);
      sourceIds.push(m.sourceId);
      if (nameCompleteness(m) > nameCompleteness(bestNamed)) bestNamed = m;
    }

    const chosen = bestNamed ?? group.members[0]!;
    return {
      displayName: chosen.displayName,
      givenName: chosen.givenName,
      familyName: chosen.familyName,
      emails,
      phoneE164s: phones,
      sourceIds,
    };
  }

  private reasonsFor(a: RawContact, b: RawContact): Set<MatchReason> {
    const reasons = new Set<MatchReason>();
    if (intersects(a.phoneE164s, b.phoneE164s)) reasons.add('samePhone');
    if (intersects(normalizedEmails(a), normalizedEmails(b))) {
      reasons.add('sameEmail');
    }
    if (this.nameSimilarity(a, b) >= this.nameSimilarityThreshold) {
      reasons.add('similarName');
    }
    return reasons;
  }

  private nameSimilarity(a: RawContact, b: RawContact): number {
    const na = normalizeName(a.displayName);
    const nb = normalizeName(b.displayName);
    if (na.length === 0 || nb.length === 0) return 0;
    if (na === nb) return 1;
    const dist = levenshtein(na, nb);
    return 1 - dist / Math.max(na.length, nb.length);
  }
}

function confidenceOf(reasons: ReadonlySet<MatchReason>): MergeConfidence {
  return reasons.has('samePhone') || reasons.has('sameEmail') ? 'high' : 'low';
}

function nameCompleteness(c: RawContact | null): number {
  if (c === null) return -1;
  let score = c.displayName.trim().length;
  if (c.givenName) score += 2;
  if (c.familyName) score += 2;
  return score;
}

function normalizedEmails(c: RawContact): Set<string> {
  return new Set([...c.emails].map((e) => e.trim().toLowerCase()));
}

function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) return true;
  return false;
}

/** Minuscules, accents retirés, ponctuation supprimée, espaces réduits. */
function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques combinés
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distance de Levenshtein (rolling rows). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 0; i < a.length; i++) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j]! + 1,
        previous[j + 1]! + 1,
        previous[j]! + cost,
      );
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length]!;
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

interface Edge {
  readonly a: number;
  readonly b: number;
  readonly reasons: Set<MatchReason>;
}
