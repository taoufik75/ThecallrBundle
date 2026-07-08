import 'package:context_contacts/domain/dedup/name_matcher.dart';
import 'package:test/test.dart';

void main() {
  const m = NameMatcher();

  test('insensible aux accents et à la casse', () {
    expect(m.similarity('Jérôme Dupré', 'jerome dupre'), 1.0);
  });

  test('insensible à l\'ordre des tokens', () {
    expect(m.similarity('Jean Dupont', 'Dupont Jean'), 1.0);
  });

  test('tolère une petite faute de frappe', () {
    expect(m.similarity('Jonathan', 'Jonathann'), greaterThan(0.85));
  });

  test('distingue des noms différents', () {
    expect(m.similarity('Alice Martin', 'Bob Durand'), lessThan(0.4));
  });

  test('normalisation produit des tokens propres', () {
    expect(m.tokens('  Jean-Pierre  DE LA FONTAINE '),
        {'jean', 'pierre', 'de', 'la', 'fontaine'});
  });
}
