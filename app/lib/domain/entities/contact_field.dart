import 'contact_source.dart';

/// Étiquette d'un moyen de contact (mobile, domicile, bureau…).
enum FieldLabel {
  mobile('Mobile'),
  home('Domicile'),
  work('Bureau'),
  main('Principal'),
  fax('Fax'),
  other('Autre');

  const FieldLabel(this.display);
  final String display;

  static FieldLabel parse(String? raw) {
    switch ((raw ?? '').toLowerCase().trim()) {
      case 'mobile':
      case 'cell':
      case 'iphone':
      case 'portable':
        return FieldLabel.mobile;
      case 'home':
      case 'domicile':
      case 'maison':
        return FieldLabel.home;
      case 'work':
      case 'bureau':
      case 'pro':
      case 'travail':
        return FieldLabel.work;
      case 'main':
      case 'principal':
        return FieldLabel.main;
      case 'fax':
      case 'faxhome':
      case 'faxwork':
        return FieldLabel.fax;
      default:
        return FieldLabel.other;
    }
  }
}

/// Un numéro de téléphone porteur de sa **provenance**.
///
/// [normalized] est la forme canonique E.164 (`+33612345678`) quand elle a pu
/// être calculée — c'est la clé qui sert à comparer et dédupliquer. [raw]
/// conserve la saisie d'origine pour l'affichage et l'audit.
class PhoneNumber {
  const PhoneNumber({
    required this.raw,
    required this.normalized,
    this.label = FieldLabel.mobile,
    this.source = ContactSource.device,
    this.updatedAt,
    this.isPrimary = false,
  });

  final String raw;

  /// Forme E.164, ou `null` si le numéro n'a pas pu être normalisé.
  final String? normalized;

  final FieldLabel label;
  final ContactSource source;

  /// Dernière mise à jour connue côté source (pour arbitrer la fraîcheur).
  final DateTime? updatedAt;

  final bool isPrimary;

  /// Clé de comparaison : la forme normalisée si dispo, sinon les chiffres bruts.
  String get comparisonKey =>
      normalized ?? raw.replaceAll(RegExp(r'[^0-9]'), '');

  bool get isValid => normalized != null;

  PhoneNumber copyWith({
    FieldLabel? label,
    ContactSource? source,
    DateTime? updatedAt,
    bool? isPrimary,
  }) {
    return PhoneNumber(
      raw: raw,
      normalized: normalized,
      label: label ?? this.label,
      source: source ?? this.source,
      updatedAt: updatedAt ?? this.updatedAt,
      isPrimary: isPrimary ?? this.isPrimary,
    );
  }

  @override
  String toString() => 'PhoneNumber(${normalized ?? raw}, ${label.name})';
}

/// Une adresse email porteuse de sa provenance.
class EmailAddress {
  const EmailAddress({
    required this.raw,
    this.label = FieldLabel.home,
    this.source = ContactSource.device,
    this.updatedAt,
  });

  final String raw;
  final FieldLabel label;
  final ContactSource source;
  final DateTime? updatedAt;

  /// Clé de comparaison : email en minuscules, sans espaces.
  String get comparisonKey => raw.toLowerCase().trim();

  bool get isValid => RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(raw.trim());

  @override
  String toString() => 'EmailAddress($raw, ${label.name})';
}
