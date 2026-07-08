import '../entities/contact_record.dart';
import 'duplicate_group.dart';
import 'name_matcher.dart';

/// Paramètres de détection des doublons.
class DedupConfig {
  const DedupConfig({
    this.strongNameThreshold = 0.92,
    this.weakNameThreshold = 0.82,
  });

  /// Au-dessus : deux noms sont considérés « identiques ».
  final double strongNameThreshold;

  /// Entre [weakNameThreshold] et [strongNameThreshold] : proches, à confirmer.
  final double weakNameThreshold;
}

/// Une arête de similarité détectée entre deux enregistrements.
class _Edge {
  _Edge(this.a, this.b, this.reason, {required this.strong});
  final int a;
  final int b;
  final String reason;
  final bool strong;
}

/// Détecte les doublons dans un lot d'enregistrements.
///
/// Stratégie en deux temps pour rester rapide même sur de gros carnets :
///  1. **Blocking** — on n'examine que les paires partageant une « clé de
///     blocage » (même numéro normalisé, même email, ou même token de nom).
///     Ça évite le coût O(n²) d'une comparaison naïve.
///  2. **Union-Find** — on relie les enregistrements liés par un signal fort ou
///     par une forte similarité de nom, formant des groupes transitifs
///     (A~B et B~C ⇒ {A,B,C}).
///
/// Les explications (« raisons ») sont d'abord collectées comme des arêtes,
/// puis rattachées à la racine finale de chaque groupe une fois toutes les
/// unions faites — c'est robuste au fait que les racines bougent en cours de route.
class DedupEngine {
  DedupEngine({
    this.config = const DedupConfig(),
    this.nameMatcher = const NameMatcher(),
  });

  final DedupConfig config;
  final NameMatcher nameMatcher;

  List<DuplicateGroup> findDuplicates(List<ContactRecord> records) {
    if (records.length < 2) return const [];

    // --- Index de blocage -------------------------------------------------
    final byPhone = <String, List<int>>{};
    final byEmail = <String, List<int>>{};
    final byNameToken = <String, List<int>>{};

    for (var i = 0; i < records.length; i++) {
      final r = records[i];
      for (final p in r.phones) {
        final key = p.comparisonKey;
        if (key.isNotEmpty) (byPhone[key] ??= []).add(i);
      }
      for (final e in r.emails) {
        final key = e.comparisonKey;
        if (key.isNotEmpty) (byEmail[key] ??= []).add(i);
      }
      for (final t in nameMatcher.tokens(r.effectiveName)) {
        if (t.length >= 2) (byNameToken[t] ??= []).add(i);
      }
    }

    // --- Collecte des arêtes ---------------------------------------------
    final edges = <_Edge>[];
    final strongPairs = <String>{};

    void addStrong(String key, List<int> idxs, String Function() reason) {
      for (var i = 0; i < idxs.length; i++) {
        for (var j = i + 1; j < idxs.length; j++) {
          edges.add(_Edge(idxs[i], idxs[j], reason(), strong: true));
          strongPairs.add(_pairKey(idxs[i], idxs[j]));
        }
      }
    }

    byPhone.forEach((key, idxs) {
      if (idxs.length >= 2) addStrong(key, idxs, () => 'Même numéro $key');
    });
    byEmail.forEach((key, idxs) {
      if (idxs.length >= 2) addStrong(key, idxs, () => 'Même email $key');
    });

    // Similarité de noms sur les paires partageant un token.
    final examined = <String>{};
    byNameToken.forEach((_, idxs) {
      if (idxs.length < 2) return;
      for (var i = 0; i < idxs.length; i++) {
        for (var j = i + 1; j < idxs.length; j++) {
          final a = idxs[i], b = idxs[j];
          final pk = _pairKey(a, b);
          if (!examined.add(pk)) continue; // paire déjà comparée
          if (strongPairs.contains(pk)) continue; // déjà reliée fortement

          final sim = nameMatcher.similarity(
            records[a].effectiveName,
            records[b].effectiveName,
          );
          if (sim >= config.strongNameThreshold) {
            edges.add(_Edge(a, b, 'Noms quasi identiques', strong: false));
          } else if (sim >= config.weakNameThreshold &&
              _sharesWeakSignal(records[a], records[b])) {
            edges.add(_Edge(
              a, b, 'Noms proches + même société/domaine',
              strong: false,
            ));
          }
        }
      }
    });

    // --- Union-Find -------------------------------------------------------
    final uf = _UnionFind(records.length);
    for (final e in edges) {
      uf.union(e.a, e.b);
    }

    // --- Rattachement des raisons à la racine finale ----------------------
    final reasonsByRoot = <int, Set<String>>{};
    final hasStrongByRoot = <int, bool>{};
    for (final e in edges) {
      final root = uf.find(e.a);
      (reasonsByRoot[root] ??= <String>{}).add(e.reason);
      if (e.strong) hasStrongByRoot[root] = true;
    }

    // --- Reconstruction des groupes --------------------------------------
    final members = <int, List<int>>{};
    for (var i = 0; i < records.length; i++) {
      members.putIfAbsent(uf.find(i), () => []).add(i);
    }

    final result = <DuplicateGroup>[];
    members.forEach((root, idxs) {
      if (idxs.length < 2) return;
      final reasons = (reasonsByRoot[root] ?? const <String>{}).toList();
      result.add(DuplicateGroup(
        records: [for (final i in idxs) records[i]],
        confidence: _confidenceFor(
          idxs,
          records,
          strong: hasStrongByRoot[root] ?? false,
        ),
        reasons: reasons.isEmpty ? ['Correspondance détectée'] : reasons,
      ));
    });

    result.sort((a, b) {
      final c = a.confidence.index.compareTo(b.confidence.index);
      if (c != 0) return c;
      return b.size.compareTo(a.size);
    });
    return result;
  }

  /// Un « signal faible » qui renforce une simple ressemblance de nom :
  /// même société, ou même domaine d'email.
  bool _sharesWeakSignal(ContactRecord a, ContactRecord b) {
    final ca = a.company.toLowerCase().trim();
    final cb = b.company.toLowerCase().trim();
    if (ca.isNotEmpty && ca == cb) return true;

    final domainsA = a.emails
        .map((e) => e.comparisonKey.split('@').last)
        .where((d) => d.isNotEmpty)
        .toSet();
    final domainsB = b.emails
        .map((e) => e.comparisonKey.split('@').last)
        .where((d) => d.isNotEmpty)
        .toSet();
    return domainsA.intersection(domainsB).isNotEmpty;
  }

  MatchConfidence _confidenceFor(
    List<int> idxs,
    List<ContactRecord> records, {
    required bool strong,
  }) {
    if (strong) return MatchConfidence.high;
    for (var i = 0; i < idxs.length; i++) {
      for (var j = i + 1; j < idxs.length; j++) {
        if (_sharesWeakSignal(records[idxs[i]], records[idxs[j]])) {
          return MatchConfidence.medium;
        }
      }
    }
    return MatchConfidence.low;
  }

  static String _pairKey(int a, int b) => a < b ? '$a-$b' : '$b-$a';
}

/// Structure Union-Find (compression de chemin + union par rang).
class _UnionFind {
  _UnionFind(int n)
      : _parent = List<int>.generate(n, (i) => i),
        _rank = List<int>.filled(n, 0);

  final List<int> _parent;
  final List<int> _rank;

  int find(int x) {
    while (_parent[x] != x) {
      _parent[x] = _parent[_parent[x]];
      x = _parent[x];
    }
    return x;
  }

  void union(int a, int b) {
    final ra = find(a), rb = find(b);
    if (ra == rb) return;
    if (_rank[ra] < _rank[rb]) {
      _parent[ra] = rb;
    } else if (_rank[ra] > _rank[rb]) {
      _parent[rb] = ra;
    } else {
      _parent[rb] = ra;
      _rank[ra]++;
    }
  }
}
