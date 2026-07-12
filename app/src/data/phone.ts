import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Normalise un numéro saisi/importé en E.164 (ex. "06 12 34 56 78" → "+33612345678").
 * Retourne `null` si le numéro est invalide. La région par défaut sert à
 * interpréter les numéros nationaux sans indicatif.
 */
export function normalizeToE164(
  input: string | undefined | null,
  defaultRegion: CountryCode = 'FR',
): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input, defaultRegion);
  return parsed?.isValid() ? parsed.number : null;
}
