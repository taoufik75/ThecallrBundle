import 'calendar_event.dart';
import 'call_event.dart';
import 'contact.dart';

/// Instantané de tout ce dont le moteur a besoin pour classer les contacts.
///
/// Le moteur est déterministe : à instantané égal, sortie égale. `now` est
/// injecté (jamais lu depuis l'horloge) pour garder cette propriété testable.
class ContextSnapshot {
  const ContextSnapshot({
    required this.now,
    required this.contacts,
    this.upcomingEvents = const [],
    this.history = const [],
  });

  final DateTime now;
  final List<Contact> contacts;
  final List<CalendarEvent> upcomingEvents;
  final List<CallEvent> history;
}
