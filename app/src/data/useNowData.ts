import { useCallback, useEffect, useState } from 'react';
import {
  applyOverrides,
  ContextEngine,
  unifyContacts,
  type Contact,
  type ContactOverride,
  type ContextSnapshot,
  type MergeGroup,
  type PhoneOverride,
  type Suggestion,
} from 'contxt-domain';
import { importDeviceContacts, readUpcomingEvents } from './contactsSource';
import { importAndroidCallLog, recordCall } from './callHistory';
import {
  initDb,
  loadDecision,
  loadOverrides,
  loadRaws,
  loadRecentCallEvents,
  saveCallEvent,
  saveDecision,
  saveOverrides,
  saveRaws,
} from './db';
import { buildSampleSnapshot } from './sampleSnapshot';

const engine = new ContextEngine();

const KEY_MERGES = 'manualMerges';
const KEY_DISMISSED = 'dismissed';

export interface NowData {
  readonly suggestions: Suggestion[];
  /** Tous les contacts unifiés (y compris ceux sans suggestion), pour l'édition. */
  readonly contacts: Contact[];
  readonly reviewSuggestions: MergeGroup[];
  /** Vrai si l'on affiche les données de démo (pas de contacts réels/permission). */
  readonly usingSample: boolean;
}

/**
 * Charge les données de l'écran « Maintenant » :
 * 1. ouvre la base ; importe le carnet natif au premier lancement et met les
 *    fiches brutes en cache ;
 * 2. relit les décisions de l'utilisateur (fusions confirmées, groupes ignorés) ;
 * 3. unifie (dedupe + décisions) → contacts + doublons à revoir ;
 * 4. lit l'agenda et classe via le moteur.
 * Repli sur la démo en cas de permission refusée ou d'erreur.
 */
export async function loadNowData(): Promise<NowData> {
  try {
    await initDb();

    let raws = await loadRaws();
    if (raws.length === 0) {
      raws = await importDeviceContacts();
      if (raws.length > 0) await saveRaws(raws);
    }
    if (raws.length === 0) return sampleData();

    const [manualMerges, dismissed, overrides] = await Promise.all([
      loadDecision(KEY_MERGES),
      loadDecision(KEY_DISMISSED),
      loadOverrides(),
    ]);

    const unified = unifyContacts(raws, { manualMerges, dismissed });
    const contacts = applyOverrides(unified.contacts, overrides);

    // Journal d'appels Android système (no-op tant qu'un module natif n'est pas
    // branché) : on persiste les nouveaux événements.
    for (const ev of await importAndroidCallLog()) await saveCallEvent(ev);
    const history = await loadRecentCallEvents(30);

    // Relie les participants d'agenda aux contacts via leurs e-mails.
    const events = await readUpcomingEvents(unified.emailIndex);
    const snapshot: ContextSnapshot = {
      now: new Date(),
      contacts,
      upcomingEvents: events,
      history,
    };
    return {
      suggestions: engine.rank(snapshot),
      contacts,
      reviewSuggestions: unified.reviewSuggestions,
      usingSample: false,
    };
  } catch {
    return sampleData();
  }
}

/** Fusionne un patch de contact dans les overrides persistés. */
export async function editContact(
  contactId: string,
  patch: ContactOverride,
): Promise<void> {
  const overrides = { ...(await loadOverrides()) };
  overrides[contactId] = { ...overrides[contactId], ...patch };
  await saveOverrides(overrides);
}

/** Fusionne un patch de numéro (par E.164) dans les overrides persistés. */
export async function editPhone(
  contactId: string,
  e164: string,
  patch: PhoneOverride,
): Promise<void> {
  const overrides = { ...(await loadOverrides()) };
  const current = overrides[contactId] ?? {};
  const phones = { ...current.phones };
  phones[e164] = { ...phones[e164], ...patch };
  overrides[contactId] = { ...current, phones };
  await saveOverrides(overrides);
}

/** Confirme la fusion d'un groupe (persiste la décision). */
export async function confirmMerge(sourceIds: readonly string[]): Promise<void> {
  const merges = await loadDecision(KEY_MERGES);
  merges.push([...sourceIds]);
  await saveDecision(KEY_MERGES, merges);
}

/** Ignore un groupe de doublons (ne sera plus proposé). */
export async function dismissGroup(sourceIds: readonly string[]): Promise<void> {
  const dismissed = await loadDecision(KEY_DISMISSED);
  dismissed.push([...sourceIds]);
  await saveDecision(KEY_DISMISSED, dismissed);
}

function sampleData(): NowData {
  const snapshot = buildSampleSnapshot(new Date());
  return {
    suggestions: engine.rank(snapshot),
    contacts: [...snapshot.contacts],
    reviewSuggestions: [],
    usingSample: true,
  };
}

interface HookState {
  readonly loading: boolean;
  readonly data: NowData | null;
}

export interface NowDataApi extends HookState {
  reload: () => void;
  merge: (group: MergeGroup) => void;
  ignore: (group: MergeGroup) => void;
  updateContact: (contactId: string, patch: ContactOverride) => void;
  updatePhone: (contactId: string, e164: string, patch: PhoneOverride) => void;
  /** Journalise un appel sortant (alimente récence/fréquence au prochain chargement). */
  logCall: (e164: string) => void;
}

/** Hook React : charge au montage, et expose les mutations avec rechargement. */
export function useNowData(): NowDataApi {
  const [state, setState] = useState<HookState>({ loading: true, data: null });

  const load = useCallback(() => {
    setState({ loading: true, data: null });
    void loadNowData().then((data) => setState({ loading: false, data }));
  }, []);

  useEffect(load, [load]);

  const merge = useCallback(
    (group: MergeGroup) => {
      void confirmMerge(group.members.map((m) => m.sourceId)).then(load);
    },
    [load],
  );

  const ignore = useCallback(
    (group: MergeGroup) => {
      void dismissGroup(group.members.map((m) => m.sourceId)).then(load);
    },
    [load],
  );

  const updateContact = useCallback(
    (contactId: string, patch: ContactOverride) => {
      void editContact(contactId, patch).then(load);
    },
    [load],
  );

  const updatePhone = useCallback(
    (contactId: string, e164: string, patch: PhoneOverride) => {
      void editPhone(contactId, e164, patch).then(load);
    },
    [load],
  );

  const logCall = useCallback((e164: string) => {
    void recordCall(e164);
  }, []);

  return {
    ...state,
    reload: load,
    merge,
    ignore,
    updateContact,
    updatePhone,
    logCall,
  };
}
