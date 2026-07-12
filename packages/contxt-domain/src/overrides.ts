import type { Contact, PhoneLabel, PhoneStatus, Sphere } from './models';

/**
 * Édition utilisateur d'un numéro (tous les champs sont optionnels : seuls les
 * champs présents écrasent la valeur déduite à l'import).
 */
export interface PhoneOverride {
  readonly label?: PhoneLabel;
  readonly sphere?: Sphere;
  readonly status?: PhoneStatus;
  readonly priority?: number;
}

/** Édition utilisateur d'un contact. */
export interface ContactOverride {
  readonly isFavoritePinned?: boolean;
  /** Overrides par numéro, indexés par E.164. */
  readonly phones?: Readonly<Record<string, PhoneOverride>>;
}

/** Ensemble des overrides, indexés par identifiant de contact. */
export type ContactOverrides = Readonly<Record<string, ContactOverride>>;

/**
 * Applique les éditions de l'utilisateur aux contacts unifiés.
 *
 * Séparé de l'unification : les contacts sont reconstruits depuis les fiches
 * brutes à chaque chargement, puis « repeints » par les overrides. Comme les
 * identifiants (contact et E.164 du numéro) sont stables, une édition survit
 * aux ré-imports. Fonction pure.
 */
export function applyOverrides(
  contacts: readonly Contact[],
  overrides: ContactOverrides,
): Contact[] {
  return contacts.map((c) => {
    const ov = overrides[c.id];
    if (!ov) return c;

    const phoneNumbers = c.phoneNumbers.map((p) => {
      const po = ov.phones?.[p.e164];
      if (!po) return p;
      return {
        ...p,
        label: po.label ?? p.label,
        sphere: po.sphere ?? p.sphere,
        status: po.status ?? p.status,
        priority: po.priority ?? p.priority,
      };
    });

    return {
      ...c,
      isFavoritePinned: ov.isFavoritePinned ?? c.isFavoritePinned,
      phoneNumbers,
    };
  });
}
