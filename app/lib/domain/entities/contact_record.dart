import 'contact_field.dart';
import 'contact_source.dart';

/// Un enregistrement de contact.
///
/// Sert à deux étages :
///  * **avant fusion** : chaque enregistrement provient d'une seule source
///    ([sources] contient un seul élément) ;
///  * **après fusion** : l'enregistrement canonique réunit plusieurs sources
///    ([sources] et [mergedFrom] les listent), avec les champs consolidés.
class ContactRecord {
  ContactRecord({
    required this.id,
    required this.source,
    this.displayName = '',
    this.firstName = '',
    this.lastName = '',
    this.company = '',
    List<PhoneNumber>? phones,
    List<EmailAddress>? emails,
    this.updatedAt,
    Set<ContactSource>? sources,
    List<String>? mergedFrom,
  })  : phones = List.unmodifiable(phones ?? const []),
        emails = List.unmodifiable(emails ?? const []),
        sources = Set.unmodifiable(sources ?? {source}),
        mergedFrom = List.unmodifiable(mergedFrom ?? const []);

  /// Identifiant stable et préfixé par la source, ex. `device:42`, `google:abc`.
  final String id;

  /// Source d'origine de cet enregistrement (pour un canonique fusionné :
  /// la source la plus fiable ayant contribué).
  final ContactSource source;

  final String displayName;
  final String firstName;
  final String lastName;
  final String company;

  final List<PhoneNumber> phones;
  final List<EmailAddress> emails;

  final DateTime? updatedAt;

  /// Toutes les sources ayant contribué à cet enregistrement.
  final Set<ContactSource> sources;

  /// Les identifiants des enregistrements bruts fusionnés dans ce canonique.
  final List<String> mergedFrom;

  bool get isMerged => mergedFrom.length > 1;

  /// Nom exploitable : [displayName] si présent, sinon reconstruit.
  String get effectiveName {
    final dn = displayName.trim();
    if (dn.isNotEmpty) return dn;
    final joined = '$firstName $lastName'.trim();
    if (joined.isNotEmpty) return joined;
    if (company.trim().isNotEmpty) return company.trim();
    if (phones.isNotEmpty) return phones.first.raw;
    if (emails.isNotEmpty) return emails.first.raw;
    return 'Sans nom';
  }

  /// Score de complétude [0..1] : sert à choisir le meilleur nom lors des fusions.
  double get completeness {
    var score = 0.0;
    if (displayName.trim().isNotEmpty) score += 2;
    if (firstName.trim().isNotEmpty) score += 1;
    if (lastName.trim().isNotEmpty) score += 1;
    if (company.trim().isNotEmpty) score += 1;
    score += phones.length.clamp(0, 3);
    score += emails.length.clamp(0, 3);
    return score / 11.0;
  }

  ContactRecord copyWith({
    String? id,
    ContactSource? source,
    String? displayName,
    String? firstName,
    String? lastName,
    String? company,
    List<PhoneNumber>? phones,
    List<EmailAddress>? emails,
    DateTime? updatedAt,
    Set<ContactSource>? sources,
    List<String>? mergedFrom,
  }) {
    return ContactRecord(
      id: id ?? this.id,
      source: source ?? this.source,
      displayName: displayName ?? this.displayName,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      company: company ?? this.company,
      phones: phones ?? this.phones,
      emails: emails ?? this.emails,
      updatedAt: updatedAt ?? this.updatedAt,
      sources: sources ?? this.sources,
      mergedFrom: mergedFrom ?? this.mergedFrom,
    );
  }

  @override
  String toString() =>
      'ContactRecord($id, "${effectiveName}", '
      '${phones.length} tel, ${emails.length} mail)';
}
