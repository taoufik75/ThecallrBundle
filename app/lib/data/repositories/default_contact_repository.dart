import '../../domain/dedup/dedup_engine.dart';
import '../../domain/dedup/duplicate_group.dart';
import '../../domain/dedup/merge_service.dart';
import '../../domain/entities/contact_record.dart';
import '../../domain/repositories/contact_repository.dart';
import '../../domain/repositories/contact_source_provider.dart';

/// Implémentation par défaut, en mémoire (persistance = itération 2).
///
/// Politique MVP :
///  * les doublons à **haute confiance** (même numéro/email) sont fusionnés
///    **automatiquement** ;
///  * les doublons **probables / à vérifier** restent en file d'attente
///    ([pendingDuplicates]) et laissent leurs enregistrements visibles
///    séparément jusqu'à décision de l'utilisateur ;
///  * un groupe **rejeté** n'est plus reproposé (mémorisé par signature).
class DefaultContactRepository implements ContactRepository {
  DefaultContactRepository({
    required List<ContactSourceProvider> sources,
    DedupEngine? dedupEngine,
    MergeService mergeService = const MergeService(),
  })  : _sources = sources,
        _dedup = dedupEngine ?? DedupEngine(),
        _merge = mergeService;

  final List<ContactSourceProvider> _sources;
  final DedupEngine _dedup;
  final MergeService _merge;

  final List<ContactRecord> _canonical = [];
  final List<DuplicateGroup> _pending = [];
  final Set<String> _rejectedSignatures = {};

  @override
  Future<SyncResult> synchronize() async {
    // 1. Lecture de toutes les sources disponibles.
    final raw = <ContactRecord>[];
    final perSource = <String, int>{};
    for (final s in _sources) {
      if (!await s.isAvailable()) continue;
      final records = await s.fetchAll();
      raw.addAll(records);
      perSource[s.source.label] = records.length;
    }

    // 2. Détection des doublons.
    final groups = _dedup
        .findDuplicates(raw)
        .where((g) => !_rejectedSignatures.contains(_signature(g)))
        .toList();

    // 3. Répartition auto-fusion / file d'attente.
    _canonical.clear();
    _pending.clear();

    final consumed = <String>{}; // ids déjà placés dans un groupe

    for (final g in groups) {
      for (final r in g.records) {
        consumed.add(r.id);
      }
      if (g.confidence == MatchConfidence.high) {
        _canonical.add(_merge.mergeGroup(g.records)); // fusion automatique
      } else {
        // On garde les enregistrements visibles + on propose la fusion.
        _canonical.addAll(g.records);
        _pending.add(g);
      }
    }

    // 4. Les enregistrements uniques (hors de tout groupe).
    for (final r in raw) {
      if (!consumed.contains(r.id)) _canonical.add(r);
    }

    _sortCanonical();

    return SyncResult(
      rawCount: raw.length,
      canonicalCount: _canonical.length,
      duplicateGroups: List.unmodifiable(_pending),
      perSource: perSource,
    );
  }

  @override
  Future<List<ContactRecord>> canonicalContacts() async =>
      List.unmodifiable(_canonical);

  @override
  Future<List<DuplicateGroup>> pendingDuplicates() async =>
      List.unmodifiable(_pending);

  @override
  Future<ContactRecord> confirmMerge(DuplicateGroup group) async {
    final merged = _merge.mergeGroup(group.records);
    final ids = group.records.map((r) => r.id).toSet();
    _canonical.removeWhere((r) => ids.contains(r.id));
    _canonical.add(merged);
    _pending.removeWhere((g) => _signature(g) == _signature(group));
    _sortCanonical();
    return merged;
  }

  @override
  Future<void> rejectMerge(DuplicateGroup group) async {
    // Mémorise la décision pour ne plus reproposer ce groupe, et laisse les
    // enregistrements séparés dans la base canonique.
    _rejectedSignatures.add(_signature(group));
    _pending.removeWhere((g) => _signature(g) == _signature(group));
  }

  /// Signature stable d'un groupe : ses ids triés. Permet de reconnaître un
  /// même groupe entre deux synchronisations.
  String _signature(DuplicateGroup g) {
    final ids = g.records.map((r) => r.id).toList()..sort();
    return ids.join('|');
  }

  void _sortCanonical() {
    _canonical.sort((a, b) => a.effectiveName
        .toLowerCase()
        .compareTo(b.effectiveName.toLowerCase()));
  }
}
