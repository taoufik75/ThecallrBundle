import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/repositories/default_contact_repository.dart';
import '../data/sources/demo_contact_source.dart';
import '../domain/dedup/duplicate_group.dart';
import '../domain/entities/contact_record.dart';
import '../domain/repositories/contact_repository.dart';
import '../domain/repositories/contact_source_provider.dart';

/// Sources branchées. Pour le MVP on utilise les sources de démo ; en
/// production on remplace par DeviceContactSource() + Google/iCloud.
///
/// On surcharge ce provider dans les tests ou pour brancher le vrai device.
final contactSourcesProvider = Provider<List<ContactSourceProvider>>((ref) {
  return [
    DemoContactSource(),
    DemoGoogleSource(),
  ];
});

/// Le dépôt de contacts, construit à partir des sources.
final contactRepositoryProvider = Provider<ContactRepository>((ref) {
  return DefaultContactRepository(sources: ref.watch(contactSourcesProvider));
});

/// Instantané de la base après synchronisation.
class ContactsState {
  const ContactsState({
    required this.contacts,
    required this.duplicates,
    required this.lastSync,
    required this.perSource,
  });

  final List<ContactRecord> contacts;
  final List<DuplicateGroup> duplicates;
  final SyncResult? lastSync;
  final Map<String, int> perSource;

  int get pendingCount => duplicates.length;
}

/// Contrôleur : synchronise les sources et expose la base + les doublons.
class ContactsController extends AsyncNotifier<ContactsState> {
  ContactRepository get _repo => ref.read(contactRepositoryProvider);

  @override
  Future<ContactsState> build() => _load();

  Future<ContactsState> _load() async {
    final sync = await _repo.synchronize();
    return ContactsState(
      contacts: await _repo.canonicalContacts(),
      duplicates: await _repo.pendingDuplicates(),
      lastSync: sync,
      perSource: sync.perSource,
    );
  }

  Future<void> resync() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(_load);
  }

  Future<void> confirmMerge(DuplicateGroup group) async {
    await _repo.confirmMerge(group);
    await _refreshFromRepo();
  }

  Future<void> rejectMerge(DuplicateGroup group) async {
    await _repo.rejectMerge(group);
    await _refreshFromRepo();
  }

  Future<void> _refreshFromRepo() async {
    final prev = state.valueOrNull;
    state = AsyncValue.data(ContactsState(
      contacts: await _repo.canonicalContacts(),
      duplicates: await _repo.pendingDuplicates(),
      lastSync: prev?.lastSync,
      perSource: prev?.perSource ?? const {},
    ));
  }
}

final contactsControllerProvider =
    AsyncNotifierProvider<ContactsController, ContactsState>(
  ContactsController.new,
);
