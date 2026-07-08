/// Configuration d'un pays pour interpréter les numéros nationaux.
class PhoneRegion {
  const PhoneRegion({
    required this.isoCode,
    required this.dialCode,
    this.trunkPrefix = '0',
  });

  /// Ex. `FR`, `BE`, `US`.
  final String isoCode;

  /// Indicatif international sans le `+`, ex. `33`.
  final String dialCode;

  /// Préfixe national à retirer avant d'ajouter l'indicatif, ex. `0` en France.
  final String trunkPrefix;

  static const france = PhoneRegion(isoCode: 'FR', dialCode: '33');
  static const belgium = PhoneRegion(isoCode: 'BE', dialCode: '32');
  static const switzerland = PhoneRegion(isoCode: 'CH', dialCode: '41');
  static const usa = PhoneRegion(isoCode: 'US', dialCode: '1', trunkPrefix: '1');
}

/// Contrat de normalisation : transforme un numéro brut en forme canonique E.164.
///
/// L'implémentation par défaut ([SimplePhoneNormalizer]) est en Dart pur et
/// couvre les cas courants FR/international. Elle peut être remplacée dans la
/// couche data par une implémentation adossée à `phone_numbers_parser` sans
/// toucher au domaine.
abstract interface class PhoneNormalizer {
  /// Renvoie la forme E.164 (`+33612345678`) ou `null` si non exploitable.
  String? normalize(String raw);
}

/// Normalisation pragmatique, sans dépendance externe.
///
/// Règles appliquées :
///  1. on ne garde que les chiffres et un éventuel `+` de tête ;
///  2. `00xx…`  → `+xx…` (préfixe international) ;
///  3. `+xx…`   → conservé tel quel ;
///  4. un numéro national (commençant par le [PhoneRegion.trunkPrefix]) est
///     rattaché à la région par défaut ;
///  5. sinon, si la longueur est plausible, on préfixe avec la région par défaut.
///
/// Retourne `null` pour tout ce qui est trop court/trop long pour être un numéro.
class SimplePhoneNormalizer implements PhoneNormalizer {
  const SimplePhoneNormalizer({this.defaultRegion = PhoneRegion.france});

  final PhoneRegion defaultRegion;

  static final _digitsOnly = RegExp(r'[^0-9+]');

  @override
  String? normalize(String raw) {
    if (raw.trim().isEmpty) return null;

    // 1. Nettoyage : chiffres + un seul '+' de tête.
    var s = raw.trim().replaceAll(_digitsOnly, '');
    final hadPlus = s.startsWith('+');
    s = s.replaceAll('+', '');
    if (s.isEmpty) return null;

    // 2. Préfixe international "00".
    if (!hadPlus && s.startsWith('00')) {
      s = s.substring(2);
      return _finalizeInternational(s);
    }

    // 3. Déjà international.
    if (hadPlus) {
      return _finalizeInternational(s);
    }

    // 4. Numéro national avec préfixe de tronc (ex. 06… en France).
    final trunk = defaultRegion.trunkPrefix;
    if (trunk.isNotEmpty && s.startsWith(trunk) && s.length > trunk.length) {
      final national = s.substring(trunk.length);
      final candidate = '${defaultRegion.dialCode}$national';
      return _finalizeInternational(candidate);
    }

    // 5. Numéro national sans préfixe de tronc : longueur plausible ?
    if (s.length >= 6 && s.length <= 11) {
      return _finalizeInternational('${defaultRegion.dialCode}$s');
    }

    return null;
  }

  /// [digits] est un numéro international SANS le `+` (indicatif inclus).
  String? _finalizeInternational(String digits) {
    // Longueur E.164 : 8 à 15 chiffres, indicatif compris.
    if (digits.length < 8 || digits.length > 15) return null;
    return '+$digits';
  }
}
