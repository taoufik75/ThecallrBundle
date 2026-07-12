/// Événement d'agenda (lecture seule) servant à contextualiser les suggestions.
///
/// [participantContactIds] est résolu en amont : la couche data rapproche les
/// participants de l'événement des contacts unifiés (par email/numéro). Le
/// moteur reste ainsi purement algorithmique.
class CalendarEvent {
  const CalendarEvent({
    required this.title,
    required this.start,
    required this.end,
    this.participantContactIds = const {},
  });

  final String title;
  final DateTime start;
  final DateTime end;
  final Set<String> participantContactIds;
}
