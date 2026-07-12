import 'availability.dart';
import 'enums.dart';

/// Un numéro de téléphone, typé et contextualisé.
///
/// Un contact peut en porter plusieurs. Le champ [e164] est la clé de
/// comparaison/déduplication et doit toujours être au format E.164.
class PhoneNumber {
  const PhoneNumber({
    required this.id,
    required this.e164,
    required this.label,
    required this.sphere,
    this.priority = 0,
    this.status = PhoneStatus.active,
    this.lastVerifiedAt,
    this.availabilities = const [],
  });

  final String id;
  final String e164;
  final PhoneLabel label;
  final Sphere sphere;

  /// Préférence de base fixée par l'utilisateur (0 = neutre).
  final int priority;

  final PhoneStatus status;
  final DateTime? lastVerifiedAt;
  final List<Availability> availabilities;

  /// Un numéro périmé n'est jamais proposé par le moteur.
  bool get isProposable => status != PhoneStatus.retired;
}
