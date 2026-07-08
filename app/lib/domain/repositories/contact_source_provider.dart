import '../entities/contact_record.dart';
import '../entities/contact_source.dart';

/// Une source de contacts branchable (téléphone, Google, iCloud, enrichissement…).
///
/// Chaque source sait dire *qui* elle est, si elle est *disponible/autorisée*,
/// et *lire* ses enregistrements bruts. Les sources capables d'écriture
/// (repousser une fusion vers le carnet d'origine) implémentent en plus
/// [WritableContactSourceProvider].
abstract interface class ContactSourceProvider {
  ContactSource get source;

  /// La source est-elle configurée/branchée sur cet appareil ?
  Future<bool> isAvailable();

  /// Demande les autorisations nécessaires. Renvoie `true` si accordées.
  Future<bool> requestAccess();

  /// Lit tous les enregistrements bruts de la source.
  Future<List<ContactRecord>> fetchAll();
}

/// Source capable de recevoir les mises à jour (synchro bidirectionnelle).
abstract interface class WritableContactSourceProvider
    implements ContactSourceProvider {
  /// Met à jour l'enregistrement correspondant dans la source native.
  Future<void> upsert(ContactRecord record);

  /// Supprime l'enregistrement d'origine (ex. après fusion validée).
  Future<void> delete(String sourceId);
}
