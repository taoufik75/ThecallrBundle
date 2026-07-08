import 'package:context_contacts/domain/dedup/phone_normalizer.dart';
import 'package:test/test.dart';

void main() {
  group('SimplePhoneNormalizer (FR par défaut)', () {
    const norm = SimplePhoneNormalizer();

    test('numéro mobile national formaté', () {
      expect(norm.normalize('06 12 34 56 78'), '+33612345678');
    });

    test('numéro fixe avec points', () {
      expect(norm.normalize('01.42.68.53.00'), '+33142685300');
    });

    test('forme internationale déjà correcte', () {
      expect(norm.normalize('+33 6 12 34 56 78'), '+33612345678');
    });

    test('préfixe 00 converti en +', () {
      expect(norm.normalize('0033612345678'), '+33612345678');
    });

    test('indicatif étranger conservé', () {
      expect(norm.normalize('(+1) 202-555-0173'), '+12025550173');
    });

    test('numéro invalide -> null', () {
      expect(norm.normalize('123'), isNull);
      expect(norm.normalize(''), isNull);
      expect(norm.normalize('   '), isNull);
    });

    test('deux formats du même numéro convergent', () {
      expect(
        norm.normalize('06 12 34 56 78'),
        norm.normalize('+33612345678'),
      );
    });
  });

  group('Autre région par défaut', () {
    test('Belgique', () {
      const norm = SimplePhoneNormalizer(defaultRegion: PhoneRegion.belgium);
      expect(norm.normalize('0470 12 34 56'), '+32470123456');
    });
  });
}
