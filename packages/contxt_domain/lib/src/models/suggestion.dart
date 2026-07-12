import 'contact.dart';
import 'phone_number.dart';

/// Résultat unitaire du moteur : un contact, le meilleur numéro à composer,
/// le score obtenu et les raisons explicables affichées à l'utilisateur.
class Suggestion {
  const Suggestion({
    required this.contact,
    required this.bestNumber,
    required this.score,
    required this.reasons,
  });

  final Contact contact;
  final PhoneNumber bestNumber;
  final double score;

  /// Explications lisibles, triées par poids décroissant (ex.
  /// « réunion dans 18 min »). Différenciateur produit autant qu'outil de debug.
  final List<String> reasons;

  @override
  String toString() =>
      '${contact.displayName} · ${bestNumber.e164} '
      '(${score.toStringAsFixed(3)}) ${reasons.join(" · ")}';
}
