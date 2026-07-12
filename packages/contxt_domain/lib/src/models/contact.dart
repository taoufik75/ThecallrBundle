import 'enums.dart';
import 'phone_number.dart';

/// Personne unifiée, résultat de la fusion d'une ou plusieurs fiches sources.
class Contact {
  const Contact({
    required this.id,
    required this.displayName,
    this.sphere = Sphere.mixte,
    this.isFavoritePinned = false,
    this.phoneNumbers = const [],
  });

  final String id;
  final String displayName;
  final Sphere sphere;

  /// Favori épinglé manuellement : force la présence en tête du classement,
  /// indépendamment du score contextuel.
  final bool isFavoritePinned;

  final List<PhoneNumber> phoneNumbers;

  /// Numéros que le moteur a le droit de proposer (les périmés sont exclus).
  Iterable<PhoneNumber> get proposableNumbers =>
      phoneNumbers.where((n) => n.isProposable);
}
