import 'package:flutter_contacts/flutter_contacts.dart' as fc;

import '../../domain/dedup/phone_normalizer.dart';
import '../../domain/entities/contact_field.dart';
import '../../domain/entities/contact_record.dart';
import '../../domain/entities/contact_source.dart';
import '../../domain/repositories/contact_source_provider.dart';

/// Source « carnet natif » (Android/iOS) via le plugin `flutter_contacts`.
///
/// C'est la seule source réellement branchée dans le MVP ; Google et iCloud
/// suivent la même interface (voir leurs stubs).
class DeviceContactSource implements WritableContactSourceProvider {
  DeviceContactSource({PhoneNormalizer? normalizer})
      : _normalizer = normalizer ?? const SimplePhoneNormalizer();

  final PhoneNormalizer _normalizer;

  @override
  ContactSource get source => ContactSource.device;

  @override
  Future<bool> isAvailable() async => true; // toujours présent sur mobile

  @override
  Future<bool> requestAccess() => fc.FlutterContacts.requestPermission();

  @override
  Future<List<ContactRecord>> fetchAll() async {
    final raw = await fc.FlutterContacts.getContacts(
      withProperties: true,
      withAccounts: true,
    );
    return raw.map(_toRecord).toList();
  }

  @override
  Future<void> upsert(ContactRecord record) async {
    // MVP : l'écriture (repousser une fusion) sera implémentée en itération 2,
    // en retrouvant le contact natif par son id source puis via update().
    throw UnimplementedError('Écriture device prévue en itération 2.');
  }

  @override
  Future<void> delete(String sourceId) async {
    throw UnimplementedError('Suppression device prévue en itération 2.');
  }

  ContactRecord _toRecord(fc.Contact c) {
    final phones = c.phones
        .map((p) => PhoneNumber(
              raw: p.number,
              normalized: _normalizer.normalize(p.number),
              label: FieldLabel.parse(p.label.name),
              source: ContactSource.device,
              isPrimary: p.isPrimary,
            ))
        .toList();

    final emails = c.emails
        .map((e) => EmailAddress(
              raw: e.address,
              label: FieldLabel.parse(e.label.name),
              source: ContactSource.device,
            ))
        .toList();

    final org = c.organizations.isNotEmpty
        ? c.organizations.first.company
        : '';

    return ContactRecord(
      id: 'device:${c.id}',
      source: ContactSource.device,
      displayName: c.displayName,
      firstName: c.name.first,
      lastName: c.name.last,
      company: org,
      phones: phones,
      emails: emails,
    );
  }
}
