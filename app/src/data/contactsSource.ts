import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import type { CalendarEvent, RawContact } from 'contxt-domain';
import {
  nativeContactToRaw,
  nativeEventToCalendarEvent,
  type NativeContact,
} from './mappers';

/**
 * Importe les contacts du carnet natif de l'appareil et les convertit en
 * `RawContact` (numéros normalisés E.164). Retourne une liste vide si la
 * permission est refusée.
 */
export async function importDeviceContacts(): Promise<RawContact[]> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.FirstName,
      Contacts.Fields.LastName,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
    ],
  });

  return data.map((c) =>
    nativeContactToRaw({
      id: c.id ?? '',
      name: c.name,
      firstName: c.firstName,
      lastName: c.lastName,
      phoneNumbers: c.phoneNumbers?.map((p) => ({ number: p.number, label: p.label })),
      emails: c.emails?.map((e) => ({ email: e.email })),
    } satisfies NativeContact),
  );
}

/**
 * Lit les événements d'agenda à venir (fenêtre `hours`) et les convertit en
 * `CalendarEvent`, en résolvant les participants via `emailToContactId`.
 * Retourne une liste vide si la permission est refusée.
 */
export async function readUpcomingEvents(
  emailToContactId: ReadonlyMap<string, string>,
  hours = 24,
): Promise<CalendarEvent[]> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return [];

  const now = new Date();
  const until = new Date(now.getTime() + hours * 3600 * 1000);
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = calendars.map((c) => c.id);
  if (ids.length === 0) return [];

  const events = await Calendar.getEventsAsync(ids, now, until);
  const result: CalendarEvent[] = [];
  for (const e of events) {
    let attendeeEmails: string[] = [];
    try {
      const attendees = await Calendar.getAttendeesForEventAsync(e.id);
      attendeeEmails = attendees
        .map((a) => a.email)
        .filter((x): x is string => Boolean(x));
    } catch {
      // getAttendeesForEventAsync n'est pas dispo partout ; on ignore.
    }
    result.push(
      nativeEventToCalendarEvent(
        { title: e.title, startDate: e.startDate, endDate: e.endDate, attendeeEmails },
        emailToContactId,
      ),
    );
  }
  return result;
}
