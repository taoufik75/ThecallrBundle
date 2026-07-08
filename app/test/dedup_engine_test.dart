import 'package:context_contacts/domain/dedup/dedup_engine.dart';
import 'package:context_contacts/domain/dedup/duplicate_group.dart';
import 'package:context_contacts/domain/dedup/phone_normalizer.dart';
import 'package:context_contacts/domain/entities/contact_field.dart';
import 'package:context_contacts/domain/entities/contact_record.dart';
import 'package:context_contacts/domain/entities/contact_source.dart';
import 'package:test/test.dart';

const _norm = SimplePhoneNormalizer();

PhoneNumber tel(String raw, {ContactSource src = ContactSource.device}) =>
    PhoneNumber(raw: raw, normalized: _norm.normalize(raw), source: src);

EmailAddress mail(String raw) => EmailAddress(raw: raw);

ContactRecord rec(
  String id,
  ContactSource src, {
  String name = '',
  String company = '',
  List<PhoneNumber> phones = const [],
  List<EmailAddress> emails = const [],
}) =>
    ContactRecord(
      id: id,
      source: src,
      displayName: name,
      company: company,
      phones: phones,
      emails: emails,
    );

void main() {
  final engine = DedupEngine();

  test('même numéro sous deux formats -> doublon haute confiance', () {
    final groups = engine.findDuplicates([
      rec('device:1', ContactSource.device,
          name: 'Jean Dupont', phones: [tel('06 12 34 56 78')]),
      rec('google:2', ContactSource.google,
          name: 'Jean D.', phones: [tel('+33612345678')]),
      rec('device:3', ContactSource.device,
          name: 'Alice Martin', phones: [tel('06 99 99 99 99')]),
    ]);

    expect(groups, hasLength(1));
    expect(groups.first.confidence, MatchConfidence.high);
    expect(groups.first.size, 2);
    expect(groups.first.records.any((r) => r.id == 'device:3'), isFalse);
  });

  test('transitivité : A~B (tel) et B~C (email) forment un seul groupe', () {
    final groups = engine.findDuplicates([
      rec('a', ContactSource.device,
          name: 'Marie Curie', phones: [tel('06 11 11 11 11')]),
      rec('b', ContactSource.google,
          name: 'Marie Curie',
          phones: [tel('+33611111111')],
          emails: [mail('marie@lab.fr')]),
      rec('c', ContactSource.icloud,
          name: 'M. Curie', emails: [mail('marie@lab.fr')]),
    ]);

    expect(groups, hasLength(1));
    expect(groups.first.size, 3);
  });

  test('noms identiques sans numéro commun -> regroupés mais confiance basse',
      () {
    final groups = engine.findDuplicates([
      rec('x', ContactSource.device,
          name: 'Paul Martin', phones: [tel('06 55 55 55 55')]),
      rec('y', ContactSource.device,
          name: 'Paul Martin', phones: [tel('06 77 77 77 77')]),
    ]);

    expect(groups, hasLength(1));
    expect(groups.first.confidence, MatchConfidence.low);
  });

  test('même société renforce des noms proches -> confiance moyenne', () {
    final groups = engine.findDuplicates([
      rec('x', ContactSource.device,
          name: 'Jonathan Meyer', company: 'ACME'),
      rec('y', ContactSource.google,
          name: 'Jonathann Meyer', company: 'ACME'),
    ]);

    expect(groups, hasLength(1));
    expect(groups.first.confidence, MatchConfidence.medium);
  });

  test('contacts distincts -> aucun doublon', () {
    final groups = engine.findDuplicates([
      rec('a', ContactSource.device,
          name: 'Alice Martin', phones: [tel('06 00 00 00 01')]),
      rec('b', ContactSource.device,
          name: 'Bob Durand', phones: [tel('06 00 00 00 02')]),
    ]);
    expect(groups, isEmpty);
  });

  test('liste vide ou singleton -> aucun doublon', () {
    expect(engine.findDuplicates([]), isEmpty);
    expect(
      engine.findDuplicates([rec('a', ContactSource.device, name: 'Seul')]),
      isEmpty,
    );
  });
}
