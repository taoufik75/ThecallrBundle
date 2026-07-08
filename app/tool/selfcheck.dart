// Vérification rapide du domaine, exécutable SANS `pub get` :
//   dart run tool/selfcheck.dart
// (les fichiers du domaine n'ont aucune dépendance externe).
//
// C'est un filet de sécurité de développement ; les vrais tests unitaires
// vivent dans test/ et utilisent package:test.

import '../lib/domain/dedup/dedup_engine.dart';
import '../lib/domain/dedup/duplicate_group.dart';
import '../lib/domain/dedup/merge_service.dart';
import '../lib/domain/dedup/name_matcher.dart';
import '../lib/domain/dedup/phone_normalizer.dart';
import '../lib/domain/entities/contact_field.dart';
import '../lib/domain/entities/contact_record.dart';
import '../lib/domain/entities/contact_source.dart';

int _passed = 0;
int _failed = 0;

void check(String name, bool condition) {
  if (condition) {
    _passed++;
    print('  ✓ $name');
  } else {
    _failed++;
    print('  ✗ ÉCHEC: $name');
  }
}

void section(String title) => print('\n▶ $title');

PhoneNumber phone(String raw, {ContactSource src = ContactSource.device}) {
  const norm = SimplePhoneNormalizer();
  return PhoneNumber(raw: raw, normalized: norm.normalize(raw), source: src);
}

EmailAddress email(String raw, {ContactSource src = ContactSource.device}) =>
    EmailAddress(raw: raw, source: src);

void main() {
  const norm = SimplePhoneNormalizer();
  const matcher = NameMatcher();

  section('Normalisation des numéros (FR par défaut)');
  check('06 12 34 56 78 -> +33612345678',
      norm.normalize('06 12 34 56 78') == '+33612345678');
  check('+33 6 12 34 56 78 -> +33612345678',
      norm.normalize('+33 6 12 34 56 78') == '+33612345678');
  check('0033612345678 -> +33612345678',
      norm.normalize('0033612345678') == '+33612345678');
  check('01.42.68.53.00 -> +33142685300',
      norm.normalize('01.42.68.53.00') == '+33142685300');
  check('(+1) 202-555-0173 conserve indicatif US',
      norm.normalize('(+1) 202-555-0173') == '+12025550173');
  check('trop court -> null', norm.normalize('123') == null);
  check('vide -> null', norm.normalize('   ') == null);

  section('Comparaison de noms');
  check('accents/casse ignorés',
      matcher.similarity('Jérôme Dupré', 'jerome dupre') == 1.0);
  check('ordre des tokens toléré',
      matcher.similarity('Jean Dupont', 'Dupont Jean') == 1.0);
  check('faute de frappe reste élevée',
      matcher.similarity('Jonathan', 'Jonathann') > 0.85);
  check('noms différents restent bas',
      matcher.similarity('Alice Martin', 'Bob Durand') < 0.4);

  section('Déduplication : même numéro sous deux formats');
  {
    final records = [
      ContactRecord(
        id: 'device:1',
        source: ContactSource.device,
        displayName: 'Jean Dupont',
        phones: [phone('06 12 34 56 78')],
      ),
      ContactRecord(
        id: 'google:2',
        source: ContactSource.google,
        displayName: 'Jean D.',
        phones: [phone('+33612345678')],
      ),
      ContactRecord(
        id: 'device:3',
        source: ContactSource.device,
        displayName: 'Alice Martin',
        phones: [phone('06 99 99 99 99')],
      ),
    ];
    final groups = DedupEngine().findDuplicates(records);
    check('1 groupe de doublons détecté', groups.length == 1);
    check('confiance haute (même numéro)',
        groups.first.confidence == MatchConfidence.high);
    check('groupe = 2 enregistrements', groups.first.size == 2);
    check('Alice non incluse',
        !groups.first.records.any((r) => r.id == 'device:3'));
  }

  section('Déduplication : transitivité (A~B via tel, B~C via email)');
  {
    final records = [
      ContactRecord(
        id: 'a',
        source: ContactSource.device,
        displayName: 'Marie Curie',
        phones: [phone('06 11 11 11 11')],
      ),
      ContactRecord(
        id: 'b',
        source: ContactSource.google,
        displayName: 'Marie Curie',
        phones: [phone('+33611111111')],
        emails: [email('marie@lab.fr')],
      ),
      ContactRecord(
        id: 'c',
        source: ContactSource.icloud,
        displayName: 'M. Curie',
        emails: [email('marie@lab.fr')],
      ),
    ];
    final groups = DedupEngine().findDuplicates(records);
    check('un seul groupe transitif', groups.length == 1);
    check('les 3 sont regroupés', groups.first.size == 3);
  }

  section('Déduplication : noms proches SANS signal fort -> pas de fusion auto');
  {
    final records = [
      ContactRecord(
        id: 'x',
        source: ContactSource.device,
        displayName: 'Paul Martin',
        phones: [phone('06 55 55 55 55')],
      ),
      ContactRecord(
        id: 'y',
        source: ContactSource.device,
        displayName: 'Paul Martin',
        phones: [phone('06 77 77 77 77')],
      ),
    ];
    final groups = DedupEngine().findDuplicates(records);
    // Noms identiques -> quasi identiques (>= strong threshold) => regroupés,
    // mais confiance seulement "low" faute de numéro/email commun.
    check('regroupés sur nom identique', groups.length == 1);
    check('confiance basse (à vérifier)',
        groups.first.confidence == MatchConfidence.low);
  }

  section('Fusion : consolidation + arbitrage source/fraîcheur');
  {
    final older = DateTime(2020, 1, 1);
    final newer = DateTime(2025, 6, 1);
    final group = [
      ContactRecord(
        id: 'device:1',
        source: ContactSource.device,
        displayName: 'Jean Dupont',
        company: 'ACME',
        phones: [phone('06 12 34 56 78', src: ContactSource.device)],
        emails: [email('jean@old.fr', src: ContactSource.device)],
        updatedAt: older,
      ),
      ContactRecord(
        id: 'manual:2',
        source: ContactSource.manual,
        displayName: 'Jean Dupont',
        phones: [
          phone('+33612345678', src: ContactSource.manual), // même numéro
          phone('01 42 68 53 00', src: ContactSource.manual), // fixe en plus
        ],
        emails: [email('jean.dupont@acme.fr', src: ContactSource.manual)],
        updatedAt: newer,
      ),
    ];
    final merged = const MergeService().mergeGroup(group);
    check('nom conservé', merged.effectiveName == 'Jean Dupont');
    check('société conservée', merged.company == 'ACME');
    check('numéros unifiés (2 distincts)', merged.phones.length == 2);
    check('emails unifiés (2 distincts)', merged.emails.length == 2);
    check('provenance : 2 sources',
        merged.sources.contains(ContactSource.manual) &&
            merged.sources.contains(ContactSource.device));
    check('mergedFrom garde les 2 ids', merged.mergedFrom.length == 2);
    check('date = la plus récente', merged.updatedAt == newer);
    check('marqué comme fusionné', merged.isMerged);
  }

  print('\n${'=' * 40}');
  print('Résultat : $_passed réussis, $_failed échoués');
  print('=' * 40);
  if (_failed > 0) {
    throw StateError('$_failed vérification(s) en échec');
  }
}
