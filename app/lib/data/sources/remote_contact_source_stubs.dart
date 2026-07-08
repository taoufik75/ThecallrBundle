import '../../domain/entities/contact_record.dart';
import '../../domain/entities/contact_source.dart';
import '../../domain/repositories/contact_source_provider.dart';

/// Source Google Contacts (People API) — squelette pour l'itération 2.
///
/// Le flux réel : OAuth2 (google_sign_in) -> People API `connections.list`
/// avec `personFields=names,phoneNumbers,emailAddresses,organizations` ->
/// mapping vers [ContactRecord] (id `google:<resourceName>`), puis
/// `people.updateContact` pour repousser une fusion validée.
///
/// Volontairement inerte pour l'instant : [isAvailable] renvoie `false`, donc
/// le repository l'ignore proprement tant qu'elle n'est pas configurée.
class GoogleContactSource implements WritableContactSourceProvider {
  @override
  ContactSource get source => ContactSource.google;

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<bool> requestAccess() async => false;

  @override
  Future<List<ContactRecord>> fetchAll() async => const [];

  @override
  Future<void> upsert(ContactRecord record) async =>
      throw UnimplementedError('Synchro Google prévue en itération 2.');

  @override
  Future<void> delete(String sourceId) async =>
      throw UnimplementedError('Synchro Google prévue en itération 2.');
}

/// Source iCloud (CardDAV) — squelette pour l'itération 2.
///
/// Le flux réel : authentification CardDAV (Apple ID + mot de passe
/// d'application) -> `PROPFIND`/`REPORT` pour lister les vCards -> parsing
/// vCard 3.0/4.0 vers [ContactRecord] (id `icloud:<href>`), puis `PUT` pour
/// mettre à jour une carte après fusion.
class ICloudContactSource implements WritableContactSourceProvider {
  @override
  ContactSource get source => ContactSource.icloud;

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<bool> requestAccess() async => false;

  @override
  Future<List<ContactRecord>> fetchAll() async => const [];

  @override
  Future<void> upsert(ContactRecord record) async =>
      throw UnimplementedError('Synchro iCloud prévue en itération 2.');

  @override
  Future<void> delete(String sourceId) async =>
      throw UnimplementedError('Synchro iCloud prévue en itération 2.');
}
