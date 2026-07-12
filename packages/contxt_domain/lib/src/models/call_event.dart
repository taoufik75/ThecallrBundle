import 'enums.dart';

/// Trace d'une interaction passée. Alimente les composantes d'apprentissage
/// (récence, fréquence) du moteur. Surtout exploité en phase 2.
class CallEvent {
  const CallEvent({
    required this.phoneNumberId,
    required this.direction,
    required this.channel,
    required this.occurredAt,
    this.succeeded,
  });

  final String phoneNumberId;
  final CallDirection direction;
  final CallChannel channel;
  final DateTime occurredAt;
  final bool? succeeded;
}
