/// D'où provient une donnée de contact.
///
/// Le rang de confiance ([trust]) sert d'arbitre lors des fusions : quand deux
/// sources se contredisent (nom, société…), on privilégie la source la plus
/// fiable, puis la plus récente.
enum ContactSource {
  /// Saisi/édité à la main dans l'app : c'est la vérité par excellence.
  manual(trust: 100, label: 'Manuel'),

  /// Carnet natif du téléphone (Android/iOS).
  device(trust: 70, label: 'Téléphone'),

  /// Google Contacts (People API).
  google(trust: 60, label: 'Google'),

  /// iCloud (CardDAV).
  icloud(trust: 60, label: 'iCloud'),

  /// Exchange / carnet professionnel.
  exchange(trust: 65, label: 'Pro'),

  /// Enrichissement externe (LinkedIn, signatures email, annuaires…).
  /// Utile pour compléter, mais jamais prioritaire sur une saisie humaine.
  enrichment(trust: 40, label: 'Enrichissement');

  const ContactSource({required this.trust, required this.label});

  /// Plus la valeur est haute, plus la source fait autorité en cas de conflit.
  final int trust;

  /// Libellé lisible pour l'UI.
  final String label;
}
