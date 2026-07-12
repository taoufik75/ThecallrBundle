import * as SQLite from 'expo-sqlite';
import {
  makeContact,
  makePhoneNumber,
  type Contact,
  type PhoneLabel,
  type PhoneStatus,
  type Sphere,
} from 'contxt-domain';

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
  `);
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
