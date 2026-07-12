import type { ContactProvider, RawContact, RawPhone } from 'contxt-domain';

/** Forme JSON-sérialisable d'un `RawContact` (les `Set` deviennent des tableaux). */
interface RawContactJson {
  sourceId: string;
  provider: ContactProvider;
  externalId: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  emails: string[];
  phoneE164s: string[];
  labeledPhones?: RawPhone[];
}

export function rawContactToJson(r: RawContact): string {
  const obj: RawContactJson = {
    sourceId: r.sourceId,
    provider: r.provider,
    externalId: r.externalId,
    displayName: r.displayName,
    givenName: r.givenName,
    familyName: r.familyName,
    emails: [...r.emails],
    phoneE164s: [...r.phoneE164s],
    labeledPhones: r.labeledPhones ? [...r.labeledPhones] : undefined,
  };
  return JSON.stringify(obj);
}

export function rawContactFromJson(json: string): RawContact {
  const o = JSON.parse(json) as RawContactJson;
  return {
    sourceId: o.sourceId,
    provider: o.provider,
    externalId: o.externalId,
    displayName: o.displayName,
    givenName: o.givenName,
    familyName: o.familyName,
    emails: new Set(o.emails ?? []),
    phoneE164s: new Set(o.phoneE164s ?? []),
    labeledPhones: o.labeledPhones,
  };
}
