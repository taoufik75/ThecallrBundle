import 'dart:math' as math;

/// Comparaison de noms tolérante aux accents, à la casse, à l'ordre des tokens
/// et aux petites fautes de frappe.
class NameMatcher {
  const NameMatcher();

  static final _accents = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'å': 'a',
    'ç': 'c',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ñ': 'n',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
  };

  static final _nonAlnum = RegExp(r'[^a-z0-9 ]');
  static final _spaces = RegExp(r'\s+');

  /// Forme canonique d'un nom : minuscules, sans accents ni ponctuation.
  String normalize(String input) {
    final lower = input.toLowerCase().trim();
    final buffer = StringBuffer();
    for (final ch in lower.split('')) {
      buffer.write(_accents[ch] ?? ch);
    }
    return buffer
        .toString()
        .replaceAll(_nonAlnum, ' ')
        .replaceAll(_spaces, ' ')
        .trim();
  }

  /// Ensemble de tokens normalisés d'un nom.
  Set<String> tokens(String input) {
    final n = normalize(input);
    if (n.isEmpty) return <String>{};
    return n.split(' ').where((t) => t.isNotEmpty).toSet();
  }

  /// Similarité [0..1] entre deux noms.
  ///
  /// Combine :
  ///  * la similarité d'ensembles de tokens (Jaccard) — insensible à l'ordre
  ///    « Jean Dupont » vs « Dupont Jean » ;
  ///  * un ratio de Levenshtein sur la chaîne complète — capte les fautes.
  ///
  /// On prend le max des deux : deux noms identiques à l'ordre près scorent 1,
  /// et « Jon » vs « John » reste élevé.
  double similarity(String a, String b) {
    final na = normalize(a);
    final nb = normalize(b);
    if (na.isEmpty || nb.isEmpty) return 0;
    if (na == nb) return 1;

    final jaccard = _jaccard(tokens(a), tokens(b));
    final lev = _levenshteinRatio(na, nb);
    return math.max(jaccard, lev);
  }

  double _jaccard(Set<String> a, Set<String> b) {
    if (a.isEmpty || b.isEmpty) return 0;
    final inter = a.intersection(b).length;
    final union = a.union(b).length;
    return union == 0 ? 0 : inter / union;
  }

  double _levenshteinRatio(String a, String b) {
    final dist = _levenshtein(a, b);
    final maxLen = math.max(a.length, b.length);
    if (maxLen == 0) return 1;
    return 1 - dist / maxLen;
  }

  int _levenshtein(String a, String b) {
    final m = a.length, n = b.length;
    if (m == 0) return n;
    if (n == 0) return m;

    var prev = List<int>.generate(n + 1, (i) => i);
    var curr = List<int>.filled(n + 1, 0);

    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var j = 1; j <= n; j++) {
        final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
        curr[j] = math.min(
          math.min(curr[j - 1] + 1, prev[j] + 1),
          prev[j - 1] + cost,
        );
      }
      final tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[n];
  }
}
