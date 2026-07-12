import type { CallDirection, CallEvent } from 'contxt-domain';
import type { CountryCode } from 'libphonenumber-js';
import { normalizeToE164 } from './phone';

/** Entrée brute du journal d'appels Android (module natif). */
export interface AndroidCallLogEntry {
  readonly phoneNumber?: string;
  /** 'INCOMING' | 'OUTGOING' | 'MISSED' | 'REJECTED' | ... */
  readonly type?: string;
  /** Timestamp en millisecondes (ou chaîne numérique). */
  readonly timestamp?: number | string;
}

function directionFromType(type?: string): CallDirection {
  switch ((type ?? '').toUpperCase()) {
    case 'INCOMING':
      return 'incoming';
    case 'MISSED':
    case 'REJECTED':
      return 'missed';
    default:
      return 'outgoing';
  }
}

/**
 * Convertit des entrées du journal d'appels Android en `CallEvent`, en
 * normalisant le numéro en E.164 (= identifiant du numéro). Fonction pure,
 * testée ; sans dépendance native, donc réutilisable côté tests.
 */
export function androidCallLogToEvents(
  entries: readonly AndroidCallLogEntry[],
  region: CountryCode = 'FR',
): CallEvent[] {
  const events: CallEvent[] = [];
  for (const e of entries) {
    const e164 = normalizeToE164(e.phoneNumber, region);
    if (!e164) continue;
    const ts = typeof e.timestamp === 'string' ? Number(e.timestamp) : e.timestamp;
    if (!ts || Number.isNaN(ts)) continue;
    events.push({
      phoneNumberId: e164,
      direction: directionFromType(e.type),
      channel: 'call',
      occurredAt: new Date(ts),
    });
  }
  return events;
}
