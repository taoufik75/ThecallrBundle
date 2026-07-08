import '../../domain/dedup/phone_normalizer.dart';
import '../../domain/entities/contact_field.dart';
import '../../domain/entities/contact_record.dart';
import '../../domain/entities/contact_source.dart';
import '../../domain/repositories/contact_source_provider.dart';

/// Source de démonstration : un petit jeu de contacts contenant des doublons
/// volontaires (mêmes numéros sous des formats différents, noms proches),
/// pour illustrer l'agrégation et la fusion sans dépendre du carnet natif.
class DemoContactSource implements ContactSourceProvider {
  DemoContactSource({this.simulatedSource = ContactSource.device});

  final ContactSource simulatedSource;
  static const _norm = SimplePhoneNormalizer();

  @override
  ContactSource get source => simulatedSource;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<bool> requestAccess() async => true;

  @override
  Future<List<ContactRecord>> fetchAll() async {
    PhoneNumber tel(String raw, {FieldLabel label = FieldLabel.mobile}) =>
        PhoneNumber(
          raw: raw,
          normalized: _norm.normalize(raw),
          label: label,
          source: simulatedSource,
        );
    EmailAddress mail(String raw) =>
        EmailAddress(raw: raw, source: simulatedSource);

    return [
      // Doublon fort : même numéro que le contact Google ci-dessous.
      ContactRecord(
        id: '${simulatedSource.name}:1',
        source: simulatedSource,
        displayName: 'Jean Dupont',
        firstName: 'Jean',
        lastName: 'Dupont',
        company: 'ACME',
        phones: [tel('06 12 34 56 78')],
        emails: [mail('jean.dupont@acme.fr')],
      ),
      ContactRecord(
        id: '${simulatedSource.name}:2',
        source: simulatedSource,
        displayName: 'Alice Martin',
        firstName: 'Alice',
        lastName: 'Martin',
        phones: [tel('06 99 88 77 66'), tel('01 42 68 53 00', label: FieldLabel.work)],
        emails: [mail('alice@example.com')],
      ),
      ContactRecord(
        id: '${simulatedSource.name}:3',
        source: simulatedSource,
        displayName: 'Bob Durand',
        firstName: 'Bob',
        lastName: 'Durand',
        phones: [tel('07 01 02 03 04')],
      ),
    ];
  }
}

/// Deuxième jeu, simulant une autre source (Google), avec des recoupements.
class DemoGoogleSource implements ContactSourceProvider {
  static const _norm = SimplePhoneNormalizer();

  @override
  ContactSource get source => ContactSource.google;

  @override
  Future<bool> isAvailable() async => true;

  @override
  Future<bool> requestAccess() async => true;

  @override
  Future<List<ContactRecord>> fetchAll() async {
    PhoneNumber tel(String raw) => PhoneNumber(
          raw: raw,
          normalized: _norm.normalize(raw),
          source: ContactSource.google,
        );
    return [
      // Même numéro que "Jean Dupont" device -> doublon HAUTE confiance.
      ContactRecord(
        id: 'google:a',
        source: ContactSource.google,
        displayName: 'Jean D.',
        firstName: 'Jean',
        lastName: 'D.',
        phones: [tel('+33612345678')],
        emails: [EmailAddress(raw: 'jd@acme.fr', source: ContactSource.google)],
      ),
      // Nom identique à "Alice Martin" mais AUTRE numéro -> doublon à vérifier.
      ContactRecord(
        id: 'google:b',
        source: ContactSource.google,
        displayName: 'Alice Martin',
        firstName: 'Alice',
        lastName: 'Martin',
        phones: [tel('06 44 44 44 44')],
      ),
    ];
  }
}
