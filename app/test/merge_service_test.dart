import 'package:context_contacts/domain/dedup/merge_service.dart';
import 'package:context_contacts/domain/dedup/phone_normalizer.dart';
import 'package:context_contacts/domain/entities/contact_field.dart';
import 'package:context_contacts/domain/entities/contact_record.dart';
import 'package:context_contacts/domain/entities/contact_source.dart';
import 'package:test/test.dart';

const _norm = SimplePhoneNormalizer();

PhoneNumber tel(String raw, ContactSource src) =>
    PhoneNumber(raw: raw, normalized: _norm.normalize(raw), source: src);

void main() {
  const merge = MergeService();

  test('consolide numéros/emails et garde la provenance', () {
    final merged = merge.mergeGroup([
      ContactRecord(
        id: 'device:1',
        source: ContactSource.device,
        displayName: 'Jean Dupont',
        company: 'ACME',
        phones: [tel('06 12 34 56 78', ContactSource.device)],
        emails: [EmailAddress(raw: 'jean@old.fr', source: ContactSource.device)],
        updatedAt: DateTime(2020, 1, 1),
      ),
      ContactRecord(
        id: 'manual:2',
        source: ContactSource.manual,
        displayName: 'Jean Dupont',
        phones: [
          tel('+33612345678', ContactSource.manual), // même numéro
          tel('01 42 68 53 00', ContactSource.manual), // fixe en plus
        ],
        emails: [
          EmailAddress(raw: 'jean.dupont@acme.fr', source: ContactSource.manual),
        ],
        updatedAt: DateTime(2025, 6, 1),
      ),
    ]);

    expect(merged.effectiveName, 'Jean Dupont');
    expect(merged.company, 'ACME');
    expect(merged.phones, hasLength(2)); // le doublon fusionné
    expect(merged.emails, hasLength(2));
    expect(merged.sources, containsAll([
      ContactSource.manual,
      ContactSource.device,
    ]));
    expect(merged.mergedFrom, hasLength(2));
    expect(merged.updatedAt, DateTime(2025, 6, 1)); // le plus récent
    expect(merged.isMerged, isTrue);
  });

  test('le nom vient de la source la plus fiable qui en a un', () {
    final merged = merge.mergeGroup([
      ContactRecord(
        id: 'enrichment:1',
        source: ContactSource.enrichment,
        displayName: 'J. DUPONT (LinkedIn)',
      ),
      ContactRecord(
        id: 'manual:2',
        source: ContactSource.manual,
        displayName: 'Jean Dupont',
      ),
    ]);
    expect(merged.effectiveName, 'Jean Dupont');
  });

  test('un groupe d\'un seul élément est renvoyé tel quel', () {
    final only = ContactRecord(
      id: 'device:1',
      source: ContactSource.device,
      displayName: 'Seul',
    );
    expect(merge.mergeGroup([only]).id, 'device:1');
  });

  test('groupe vide -> erreur', () {
    expect(() => merge.mergeGroup([]), throwsArgumentError);
  });
}
