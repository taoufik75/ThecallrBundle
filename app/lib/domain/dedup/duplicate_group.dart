import '../entities/contact_record.dart';

/// Niveau de confiance d'un regroupement de doublons.
enum MatchConfidence {
  /// Numéro ou email strictement identique : quasi-certain.
  high('Certain'),

  /// Noms très proches + un signal faible (même société, initiales…).
  medium('Probable'),

  /// Noms proches seulement : à faire valider par l'utilisateur.
  low('À vérifier');

  const MatchConfidence(this.label);
  final String label;
}

/// Un ensemble d'enregistrements considérés comme le même contact réel.
class DuplicateGroup {
  DuplicateGroup({
    required this.records,
    required this.confidence,
    required this.reasons,
  });

  /// Les enregistrements bruts qui composent le doublon (taille >= 2).
  final List<ContactRecord> records;

  final MatchConfidence confidence;

  /// Explications lisibles (« Même numéro +33612345678 », « Noms identiques »).
  final List<String> reasons;

  int get size => records.length;

  @override
  String toString() =>
      'DuplicateGroup(${confidence.name}, ${records.length} records: '
      '${records.map((r) => r.effectiveName).join(" / ")})';
}
