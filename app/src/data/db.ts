import * as SQLite from 'expo-sqlite';
import {
  makeContact,
  makePhoneNumber,
  type CallChannel,
  type CallDirection,
  type CallEvent,
  type Contact,
  type ContactOverrides,
  type PhoneLabel,
  type PhoneStatus,
  type RawContact,
  type Sphere,
} from 'contxt-domain';
import { rawContactFromJson, rawContactToJson } from './serialize';

/**
 * Persistance locale des contacts unifiés via expo-sqlite. Source de vérité
 * locale du MVP (aucune donnée ne quitte l'appareil).
 *
 * Schéma volontairement simple : contacts + numéros. Les fenêtres de dispo et
 * l'historique d'appels seront ajoutés quand la phase 2 les exploitera.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync('contxt.db');
  return dbPromise;
}

export async function initDb(): Promise<void> {
  const d = await db();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      sphere TEXT NOT NULL,
      is_favorite_pinned INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS phone_numbers (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL,
      e164 TEXT NOT NULL,
      label TEXT NOT NULL,
      sphere TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      last_verified_at INTEGER,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS raw_contacts (
      source_id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS decisions (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS call_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      occurred_at INTEGER NOT NULL,
      succeeded INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_call_events_time ON call_events(occurred_at);
  `);
}

// --- Historique d'appels (récence/fréquence pour le moteur) ---

/** Enregistre un événement d'appel. Ignore silencieusement les doublons exacts. */
export async function saveCallEvent(ev: CallEvent): Promise<void> {
  const d = await db();
  await d.runAsync(
    `INSERT INTO call_events (phone_number_id, direction, channel, occurred_at, succeeded)
     VALUES (?, ?, ?, ?, ?)`,
    ev.phoneNumberId,
    ev.direction,
    ev.channel,
    ev.occurredAt.getTime(),
    ev.succeeded === undefined ? null : ev.succeeded ? 1 : 0,
  );
}

interface CallEventRow {
  phone_number_id: string;
  direction: string;
  channel: string;
  occurred_at: number;
  succeeded: number | null;
}

/** Charge les événements d'appel des `sinceDays` derniers jours. */
export async function loadRecentCallEvents(sinceDays = 30): Promise<CallEvent[]> {
  const d = await db();
  const cutoff = Date.now() - sinceDays * 24 * 3600 * 1000;
  const rows = await d.getAllAsync<CallEventRow>(
    'SELECT * FROM call_events WHERE occurred_at > ? ORDER BY occurred_at DESC',
    cutoff,
  );
  return rows.map((r) => ({
    phoneNumberId: r.phone_number_id,
    direction: r.direction as CallDirection,
    channel: r.channel as CallChannel,
    occurredAt: new Date(r.occurred_at),
    succeeded: r.succeeded === null ? undefined : r.succeeded === 1,
  }));
}

// --- Fiches brutes importées (matière première de l'unification) ---

/**
 * Remplace les fiches brutes d'un fournisseur donné (device, google…), sans
 * toucher aux autres sources. Permet d'ajouter/rafraîchir Google sans effacer
 * le carnet natif, et inversement.
 */
export async function saveRawsForProvider(
  provider: string,
  raws: readonly RawContact[],
): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.runAsync('DELETE FROM raw_contacts WHERE source_id LIKE ?', `${provider}:%`);
    for (const r of raws) {
      await d.runAsync(
        'INSERT OR REPLACE INTO raw_contacts (source_id, json) VALUES (?, ?)',
        r.sourceId,
        rawContactToJson(r),
      );
    }
  });
}

export async function loadRaws(): Promise<RawContact[]> {
  const d = await db();
  const rows = await d.getAllAsync<{ json: string }>('SELECT json FROM raw_contacts');
  return rows.map((r) => rawContactFromJson(r.json));
}

// --- Décisions de l'utilisateur (fusions manuelles, groupes ignorés) ---

/** Lit une décision stockée (tableau de groupes de sourceIds), [] par défaut. */
export async function loadDecision(key: string): Promise<string[][]> {
  const d = await db();
  const row = await d.getFirstAsync<{ json: string }>(
    'SELECT json FROM decisions WHERE key = ?',
    key,
  );
  return row ? (JSON.parse(row.json) as string[][]) : [];
}

export async function saveDecision(key: string, value: string[][]): Promise<void> {
  const d = await db();
  await d.runAsync(
    'INSERT OR REPLACE INTO decisions (key, json) VALUES (?, ?)',
    key,
    JSON.stringify(value),
  );
}

// --- Éditions de l'utilisateur (overrides de contacts / numéros) ---

const OVERRIDES_KEY = 'overrides';

export async function loadOverrides(): Promise<ContactOverrides> {
  const d = await db();
  const row = await d.getFirstAsync<{ json: string }>(
    'SELECT json FROM decisions WHERE key = ?',
    OVERRIDES_KEY,
  );
  return row ? (JSON.parse(row.json) as ContactOverrides) : {};
}

export async function saveOverrides(value: ContactOverrides): Promise<void> {
  const d = await db();
  await d.runAsync(
    'INSERT OR REPLACE INTO decisions (key, json) VALUES (?, ?)',
    OVERRIDES_KEY,
    JSON.stringify(value),
  );
}

/** Remplace intégralement les contacts stockés (import idempotent au MVP). */
export async function saveContacts(contacts: readonly Contact[]): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.execAsync('DELETE FROM phone_numbers; DELETE FROM contacts;');
    for (const c of contacts) {
      await d.runAsync(
        'INSERT INTO contacts (id, display_name, sphere, is_favorite_pinned) VALUES (?, ?, ?, ?)',
        c.id,
        c.displayName,
        c.sphere,
        c.isFavoritePinned ? 1 : 0,
      );
      for (const n of c.phoneNumbers) {
        await d.runAsync(
          `INSERT INTO phone_numbers
             (id, contact_id, e164, label, sphere, priority, status, last_verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          n.id,
          c.id,
          n.e164,
          n.label,
          n.sphere,
          n.priority,
          n.status,
          n.lastVerifiedAt ? n.lastVerifiedAt.getTime() : null,
        );
      }
    }
  });
}

interface ContactRow {
  id: string;
  display_name: string;
  sphere: string;
  is_favorite_pinned: number;
}
interface PhoneRow {
  id: string;
  contact_id: string;
  e164: string;
  label: string;
  sphere: string;
  priority: number;
  status: string;
  last_verified_at: number | null;
}

/** Charge tous les contacts unifiés depuis la base. */
export async function loadContacts(): Promise<Contact[]> {
  const d = await db();
  const contactRows = await d.getAllAsync<ContactRow>('SELECT * FROM contacts');
  const phoneRows = await d.getAllAsync<PhoneRow>('SELECT * FROM phone_numbers');

  const phonesByContact = new Map<string, PhoneRow[]>();
  for (const p of phoneRows) {
    const list = phonesByContact.get(p.contact_id);
    if (list) list.push(p);
    else phonesByContact.set(p.contact_id, [p]);
  }

  return contactRows.map((row) =>
    makeContact({
      id: row.id,
      displayName: row.display_name,
      sphere: row.sphere as Sphere,
      isFavoritePinned: row.is_favorite_pinned === 1,
      phoneNumbers: (phonesByContact.get(row.id) ?? []).map((p) =>
        makePhoneNumber({
          id: p.id,
          e164: p.e164,
          label: p.label as PhoneLabel,
          sphere: p.sphere as Sphere,
          priority: p.priority,
          status: p.status as PhoneStatus,
          lastVerifiedAt: p.last_verified_at ? new Date(p.last_verified_at) : undefined,
        }),
      ),
    }),
  );
}
