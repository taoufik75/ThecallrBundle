import '../entities/contact_field.dart';
import '../entities/contact_record.dart';
import '../entities/contact_source.dart';

/// Fusionne plusieurs enregistrements en un contact canonique unique.
///
/// Politique d'arbitrage, dans l'ordre :
///  1. **Confiance de la source** ([ContactSource.trust]) — une saisie manuelle
///     prime sur un enrichissement automatique.
///  2. **Fraîcheur** ([ContactRecord.updatedAt]) — à confiance égale, le plus
///     récent gagne.
///  3. **Complétude** — pour le nom, on garde l'enregistrement le plus complet.
///
/// Les numéros et emails sont **unifiés** (union par clé de comparaison), donc
/// aucune information n'est perdue : on garde tous les moyens de contact
/// distincts, en dédupliquant ceux qui pointent vers la même valeur.
class MergeService {
  const MergeService();

  ContactRecord mergeGroup(List<ContactRecord> group) {
    if (group.isEmpty) {
      throw ArgumentError('Impossible de fusionner un groupe vide.');
    }
    if (group.length == 1) return group.first;

    // Enregistrement « pilote » : le plus fiable, puis le plus récent, puis le
    // plus complet. Il fournit le nom canonique par défaut.
    final ranked = [...group]..sort(_byAuthority);
    final leader = ranked.first;

    final phones = _mergePhones(group);
    final emails = _mergeEmails(group);

    final company = _bestString(
      group,
      (r) => r.company,
    );

    // Le nom : on prend celui du leader s'il est renseigné, sinon le plus complet.
    final name = _bestName(group);

    final allSources = <ContactSource>{for (final r in group) ...r.sources};

    final mergedFrom = <String>{
      for (final r in group) ...(r.mergedFrom.isEmpty ? [r.id] : r.mergedFrom),
    }.toList();

    final latest = group
        .map((r) => r.updatedAt)
        .whereType<DateTime>()
        .fold<DateTime?>(null, (acc, d) => acc == null || d.isAfter(acc) ? d : acc);

    return ContactRecord(
      id: 'merged:${mergedFrom.join("|")}',
      source: leader.source,
      displayName: name.displayName,
      firstName: name.firstName,
      lastName: name.lastName,
      company: company,
      phones: phones,
      emails: emails,
      updatedAt: latest,
      sources: allSources,
      mergedFrom: mergedFrom,
    );
  }

  /// Tri par autorité décroissante : confiance source, puis fraîcheur, puis complétude.
  int _byAuthority(ContactRecord a, ContactRecord b) {
    final t = b.source.trust.compareTo(a.source.trust);
    if (t != 0) return t;
    final da = a.updatedAt, db = b.updatedAt;
    if (da != null && db != null) {
      final r = db.compareTo(da);
      if (r != 0) return r;
    } else if (da != null) {
      return -1;
    } else if (db != null) {
      return 1;
    }
    return b.completeness.compareTo(a.completeness);
  }

  ({String displayName, String firstName, String lastName}) _bestName(
    List<ContactRecord> group,
  ) {
    // Le meilleur enregistrement au sens de l'autorité, mais qui a réellement un nom.
    final named = group.where((r) {
      return r.displayName.trim().isNotEmpty ||
          r.firstName.trim().isNotEmpty ||
          r.lastName.trim().isNotEmpty;
    }).toList()
      ..sort(_byAuthority);

    final pick = named.isNotEmpty ? named.first : group.first;
    return (
      displayName: pick.displayName.trim().isNotEmpty
          ? pick.displayName
          : '${pick.firstName} ${pick.lastName}'.trim(),
      firstName: pick.firstName,
      lastName: pick.lastName,
    );
  }

  String _bestString(
    List<ContactRecord> group,
    String Function(ContactRecord) selector,
  ) {
    final candidates = group.where((r) => selector(r).trim().isNotEmpty).toList()
      ..sort(_byAuthority);
    return candidates.isEmpty ? '' : selector(candidates.first).trim();
  }

  List<PhoneNumber> _mergePhones(List<ContactRecord> group) {
    final byKey = <String, PhoneNumber>{};
    for (final r in group) {
      for (final p in r.phones) {
        final key = p.comparisonKey;
        if (key.isEmpty) continue;
        final existing = byKey[key];
        if (existing == null || _phoneWins(p, existing)) {
          byKey[key] = p;
        }
      }
    }
    final list = byKey.values.toList()
      ..sort((a, b) {
        // Numéros valides (normalisés) d'abord, puis principaux, puis par source.
        final va = a.isValid ? 0 : 1, vb = b.isValid ? 0 : 1;
        if (va != vb) return va - vb;
        if (a.isPrimary != b.isPrimary) return a.isPrimary ? -1 : 1;
        return b.source.trust.compareTo(a.source.trust);
      });
    return list;
  }

  bool _phoneWins(PhoneNumber candidate, PhoneNumber current) {
    final t = candidate.source.trust.compareTo(current.source.trust);
    if (t != 0) return t > 0;
    final dc = candidate.updatedAt, dcur = current.updatedAt;
    if (dc != null && dcur != null) return dc.isAfter(dcur);
    if (dc != null) return true;
    return false;
  }

  List<EmailAddress> _mergeEmails(List<ContactRecord> group) {
    final byKey = <String, EmailAddress>{};
    for (final r in group) {
      for (final e in r.emails) {
        final key = e.comparisonKey;
        if (key.isEmpty) continue;
        final existing = byKey[key];
        if (existing == null ||
            e.source.trust > existing.source.trust) {
          byKey[key] = e;
        }
      }
    }
    return byKey.values.toList();
  }
}
