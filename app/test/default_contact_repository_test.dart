import 'package:context_contacts/data/repositories/default_contact_repository.dart';
import 'package:context_contacts/domain/dedup/phone_normalizer.dart';
import 'package:context_contacts/domain/entities/contact_field.dart';
import 'package:context_contacts/domain/entities/contact_record.dart';
import 'package:context_contacts/domain/entities/contact_source.dart';
import 'package:context_contacts/domain/repositories/contact_source_provider.dart';
import 'package:test/test.dart';

const _norm = SimplePhoneNormalizer();

PhoneNumber tel(String raw, ContactSource src) =>
    PhoneNumber(raw: raw, normalized: _norm.normalize(raw), source: src);

class _FakeSource implements ContactSourceProvider {
  _FakeSource(this._source, this._records);
  final ContactSource _source;
  final List<ContactRecord> _records;

  @override
  ContactSource get source => _source;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Future<bool> requestAccess() async => true;
  @override
  Future<List<ContactRecord>> fetchAll() async => _records;
}

void main() {
  DefaultContactRepository buildRepo() {
    final device = _FakeSource(ContactSource.device, [
      ContactRecord(
        id: 'device:1',
        source: ContactSource.device,
        displayName: 'Jean Dupont',
        phones: [tel('06 12 34 56 78', ContactSource.device)],
      ),
      ContactRecord(
        id: 'device:2',
        source: ContactSource.device,
        displayName: 'Alice Martin',
        phones: [tel('06 99 99 99 99', ContactSource.device)],
      ),
    ]);
    final google = _FakeSource(ContactSource.google, [
      // Doublon FORT de Jean (même numéro).
      ContactRecord(
        id: 'google:a',
        source: ContactSource.google,
        displayName: 'Jean D.',
        phones: [tel('+33612345678', ContactSource.google)],
      ),
      // Doublon FAIBLE d'Alice (même nom, autre numéro).
      ContactRecord(
        id: 'google:b',
        source: ContactSource.google,
        displayName: 'Alice Martin',
        phones: [tel('06 44 44 44 44', ContactSource.google)],
      ),
    ]);
    return DefaultContactRepository(sources: [device, google]);
  }

  test('synchronise : auto-fusion des forts, mise en attente des faibles', () async {
    final repo = buildRepo();
    final result = await repo.synchronize();

    expect(result.rawCount, 4);
    expect(result.perSource['Téléphone'], 2);
    expect(result.perSource['Google'], 2);

    // 1 seul doublon "à vérifier" (les deux Alice) reste en attente.
    final pending = await repo.pendingDuplicates();
    expect(pending, hasLength(1));

    // Base canonique : Jean fusionné (1) + 2 Alice séparées + rien d'autre = 3.
    final canonical = await repo.canonicalContacts();
    final jean = canonical.where((c) => c.effectiveName.startsWith('Jean'));
    expect(jean, hasLength(1));
    expect(jean.first.isMerged, isTrue);
    expect(canonical, hasLength(3));
  });

  test('confirmMerge fusionne les Alice en une seule fiche', () async {
    final repo = buildRepo();
    await repo.synchronize();
    final pending = await repo.pendingDuplicates();

    await repo.confirmMerge(pending.first);

    expect(await repo.pendingDuplicates(), isEmpty);
    final canonical = await repo.canonicalContacts();
    final alice = canonical.where((c) => c.effectiveName.startsWith('Alice'));
    expect(alice, hasLength(1));
    expect(alice.first.isMerged, isTrue);
    expect(canonical, hasLength(2)); // Jean + Alice
  });

  test('rejectMerge garde les fiches séparées et ne repropose plus', () async {
    final repo = buildRepo();
    await repo.synchronize();
    final pending = await repo.pendingDuplicates();

    await repo.rejectMerge(pending.first);
    expect(await repo.pendingDuplicates(), isEmpty);

    // Une resynchronisation ne doit PAS reproposer le groupe rejeté.
    await repo.synchronize();
    expect(await repo.pendingDuplicates(), isEmpty);

    final canonical = await repo.canonicalContacts();
    final alice = canonical.where((c) => c.effectiveName.startsWith('Alice'));
    expect(alice, hasLength(2)); // restent séparées
  });
}
