import { useCallback, useEffect, useState } from 'react';
import {
  ContextEngine,
  unifyContacts,
  type ContextSnapshot,
  type MergeGroup,
  type Suggestion,
} from 'contxt-domain';
import { importDeviceContacts, readUpcomingEvents } from './contactsSource';
import {
  initDb,
  loadDecision,
  loadRaws,
  saveDecision,
  saveRaws,
} from './db';
import { buildSampleSnapshot } from './sampleSnapshot';

const engine = new ContextEngine();

const KEY_MERGES = 'manualMerges';
const KEY_DISMISSED = 'dismissed';

export interface NowData {
  readonly suggestions: Suggestion[];
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

    const [manualMerges, dismissed] = await Promise.all([
      loadDecision(KEY_MERGES),
      loadDecision(KEY_DISMISSED),
    ]);

    const unified = unifyContacts(raws, { manualMerges, dismissed });

    const events = await readUpcomingEvents(new Map());
    const snapshot: ContextSnapshot = {
      now: new Date(),
      contacts: unified.contacts,
      upcomingEvents: events,
      history: [],
    };
    return {
      suggestions: engine.rank(snapshot),
      reviewSuggestions: unified.reviewSuggestions,
      usingSample: false,
    };
  } catch {
    return sampleData();
  }
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
}

/** Hook React : charge au montage, et expose fusion/ignore avec rechargement. */
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

  return { ...state, reload: load, merge, ignore };
}
