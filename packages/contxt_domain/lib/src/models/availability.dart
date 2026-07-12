import 'enums.dart';

/// Fenêtre de joignabilité rattachée à un numéro.
///
/// Les jours sont exprimés selon [DateTime.weekday] (1 = lundi … 7 = dimanche).
/// Les bornes horaires sont en minutes depuis minuit (ex. 540 = 09:00).
class Availability {
  const Availability({
    required this.daysOfWeek,
    required this.startMinute,
    required this.endMinute,
    this.kind = AvailabilityKind.preferred,
  });

  final Set<int> daysOfWeek;
  final int startMinute;
  final int endMinute;
  final AvailabilityKind kind;

  /// Vrai si [when] tombe dans cette fenêtre (jour + plage horaire).
  bool matches(DateTime when) {
    if (!daysOfWeek.contains(when.weekday)) return false;
    final minutes = when.hour * 60 + when.minute;
    return minutes >= startMinute && minutes < endMinute;
  }
}
