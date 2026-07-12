import { useCallback, useEffect, useState } from 'react';
import {
  ContextEngine,
  unifyContacts,
  type ContextSnapshot,
  type MergeGroup,
  type Suggestion,
} from 'contxt-domain';
import { importDeviceContacts, readUpcomingEvents } from './contactsSource';
import { initDb, loadContacts, saveContacts } from './db';
import { buildSampleSnapshot } from './sampleSnapshot';

const engine = new ContextEngine();

export interface NowData {
  readonly suggestions: Suggestion[];
  readonly reviewSuggestions: MergeGroup[];
  /** Vrai si l'on affiche les données de démo (pas de contacts réels/permission). */
  readonly usingSample: boolean;
}

/**
 * Charge les données de l'écran « Maintenant » :
 * 1. ouvre la base ; s'il y a déjà des contacts, les utilise ;
 * 2. sinon importe le carnet natif, unifie (dedupe), persiste ;
 * 3. lit l'agenda pour contextualiser ;
 * 4. classe via le moteur.
 * Repli systématique sur la démo en cas de permission refusée ou d'erreur, pour
 * que l'app montre toujours quelque chose (ex. dans Expo Go sans autorisation).
 */
export async function loadNowData(): Promise<NowData> {
  try {
    await initDb();
    let contacts = await loadContacts();
    let reviewSuggestions: MergeGroup[] = [];

    if (contacts.length === 0) {
      const raws = await importDeviceContacts();
      if (raws.length > 0) {
        const unified = unifyContacts(raws);
        contacts = unified.contacts;
        reviewSuggestions = unified.reviewSuggestions;
        await saveContacts(contacts);
      }
    }

    if (contacts.length === 0) {
      return sampleData();
    }

    const events = await readUpcomingEvents(new Map());
    const snapshot: ContextSnapshot = {
      now: new Date(),
      contacts,
      upcomingEvents: events,
      history: [],
    };
    return {
      suggestions: engine.rank(snapshot),
      reviewSuggestions,
      usingSample: false,
    };
  } catch {
    return sampleData();
  }
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

/** Hook React : charge les données au montage et expose un rechargement. */
export function useNowData(): HookState & { reload: () => void } {
  const [state, setState] = useState<HookState>({ loading: true, data: null });

  const load = useCallback(() => {
    setState({ loading: true, data: null });
    void loadNowData().then((data) => setState({ loading: false, data }));
  }, []);

  useEffect(load, [load]);

  return { ...state, reload: load };
}
