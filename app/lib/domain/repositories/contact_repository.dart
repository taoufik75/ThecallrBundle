import '../dedup/duplicate_group.dart';
import '../entities/contact_record.dart';

/// Résultat d'une synchronisation : ce qui a été lu et ce qui a été détecté.
class SyncResult {
  const SyncResult({
    required this.rawCount,
    required this.canonicalCount,
    required this.duplicateGroups,
    required this.perSource,
  });

  /// Nombre total d'enregistrements bruts lus (toutes sources).
  final int rawCount;

  /// Nombre de contacts canoniques après application des fusions confirmées.
  final int canonicalCount;

  /// Groupes de doublons détectés restant à arbitrer.
  final List<DuplicateGroup> duplicateGroups;

  /// Décompte par source (ex. { 'Téléphone': 320, 'Google': 210 }).
  final Map<String, int> perSource;
}

/// Façade métier de la base de contacts.
///
/// Orchestre : lecture multi-sources -> détection des doublons -> exposition
/// d'une base canonique propre. Les fusions peuvent être *automatiques* (haute
/// confiance) ou *confirmées* par l'utilisateur (confiance moyenne/basse).
abstract interface class ContactRepository {
  /// Relit toutes les sources disponibles et recalcule les doublons.
  Future<SyncResult> synchronize();

  /// La base canonique courante (contacts propres, doublons résolus).
  Future<List<ContactRecord>> canonicalContacts();

  /// Les groupes de doublons en attente de décision de l'utilisateur.
  Future<List<DuplicateGroup>> pendingDuplicates();

  /// Confirme la fusion d'un groupe : les enregistrements deviennent un canonique.
  Future<ContactRecord> confirmMerge(DuplicateGroup group);

  /// Rejette un groupe : les enregistrements sont marqués « distincts »
  /// et ne seront plus reproposés à la fusion.
  Future<void> rejectMerge(DuplicateGroup group);
}
