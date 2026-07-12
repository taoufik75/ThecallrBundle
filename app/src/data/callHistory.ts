import { Platform } from 'react-native';
import type { CallChannel, CallDirection, CallEvent } from 'contxt-domain';
import { saveCallEvent } from './db';

export { androidCallLogToEvents, type AndroidCallLogEntry } from './callLogMap';

/**
 * Enregistre un appel lancé depuis l'app. Multiplateforme (iOS + Android),
 * sans permission spéciale : c'est la source d'apprentissage de base de la
 * récence/fréquence. `phoneNumberId` est l'E.164 (identifiant des numéros).
 */
export async function recordCall(
  e164: string,
  direction: CallDirection = 'outgoing',
  channel: CallChannel = 'call',
): Promise<void> {
  await saveCallEvent({
    phoneNumberId: e164,
    direction,
    channel,
    occurredAt: new Date(),
  });
}

/**
 * Importe le journal d'appels système Android et le persiste.
 *
 * TODO(natif) : nécessite un module natif (ex. `react-native-call-log`) + la
 * permission READ_CALL_LOG et un prebuild. iOS n'expose pas le journal d'appels.
 * En attendant, l'apprentissage s'appuie sur les appels lancés depuis l'app
 * (`recordCall`). Le mapping `androidCallLogToEvents` est prêt à être branché ici.
 */
export async function importAndroidCallLog(): Promise<CallEvent[]> {
  if (Platform.OS !== 'android') return [];
  return [];
}
