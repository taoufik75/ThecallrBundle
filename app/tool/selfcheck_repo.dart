// Vérifie la logique d'orchestration du dépôt, sans Flutter ni pub get :
//   dart run tool/selfcheck_repo.dart

import '../lib/data/repositories/default_contact_repository.dart';
import '../lib/domain/dedup/phone_normalizer.dart';
import '../lib/domain/entities/contact_field.dart';
import '../lib/domain/entities/contact_record.dart';
import '../lib/domain/entities/contact_source.dart';
import '../lib/domain/repositories/contact_source_provider.dart';

int _passed = 0, _failed = 0;
void check(String n, bool c) {
  if (c) {
    _passed++;
    print('  ✓ $n');
  } else {
    _failed++;
    print('  ✗ ÉCHEC: $n');
  }
}

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
    ContactRecord(
      id: 'google:a',
      source: ContactSource.google,
      displayName: 'Jean D.',
      phones: [tel('+33612345678', ContactSource.google)],
    ),
    ContactRecord(
      id: 'google:b',
      source: ContactSource.google,
      displayName: 'Alice Martin',
      phones: [tel('06 44 44 44 44', ContactSource.google)],
    ),
  ]);
  return DefaultContactRepository(sources: [device, google]);
}

Future<void> main() async {
  print('▶ synchronize : auto-fusion + file d\'attente');
  {
    final repo = buildRepo();
    final r = await repo.synchronize();
    check('4 fiches lues', r.rawCount == 4);
    check('perSource Téléphone=2', r.perSource['Téléphone'] == 2);
    check('perSource Google=2', r.perSource['Google'] == 2);
    final pending = await repo.pendingDuplicates();
    check('1 doublon en attente', pending.length == 1);
    final canonical = await repo.canonicalContacts();
    check('3 contacts canoniques', canonical.length == 3);
    final jean = canonical.where((c) => c.effectiveName.startsWith('Jean'));
    check('Jean fusionné en 1 fiche', jean.length == 1 && jean.first.isMerged);
  }

  print('\n▶ confirmMerge');
  {
    final repo = buildRepo();
    await repo.synchronize();
    final pending = await repo.pendingDuplicates();
    await repo.confirmMerge(pending.first);
    check('plus de doublon en attente',
        (await repo.pendingDuplicates()).isEmpty);
    final canonical = await repo.canonicalContacts();
    check('2 contacts après fusion Alice', canonical.length == 2);
    final alice = canonical.where((c) => c.effectiveName.startsWith('Alice'));
    check('Alice fusionnée', alice.length == 1 && alice.first.isMerged);
  }

  print('\n▶ rejectMerge (persistant)');
  {
    final repo = buildRepo();
    await repo.synchronize();
    final pending = await repo.pendingDuplicates();
    await repo.rejectMerge(pending.first);
    check('file vidée après rejet', (await repo.pendingDuplicates()).isEmpty);
    await repo.synchronize();
    check('groupe rejeté non reproposé',
        (await repo.pendingDuplicates()).isEmpty);
    final alice = (await repo.canonicalContacts())
        .where((c) => c.effectiveName.startsWith('Alice'));
    check('les 2 Alice restent séparées', alice.length == 2);
  }

  print('\n${'=' * 40}');
  print('Résultat : $_passed réussis, $_failed échoués');
  print('=' * 40);
  if (_failed > 0) throw StateError('$_failed échec(s)');
}
