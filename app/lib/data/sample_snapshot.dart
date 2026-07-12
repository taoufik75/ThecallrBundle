import 'package:contxt_domain/contxt_domain.dart';

/// Données de démonstration en mémoire, le temps que la couche data réelle
/// (import contacts natifs / Google People, base Drift, lecture agenda) soit
/// branchée. Permet de faire tourner et voir l'écran « Maintenant » dès le
/// premier lancement.
ContextSnapshot buildSampleSnapshot(DateTime now) {
  final verified = now.subtract(const Duration(hours: 2));

  PhoneNumber n(
    String id,
    String e164,
    PhoneLabel label,
    Sphere sphere,
  ) =>
      PhoneNumber(
        id: id,
        e164: e164,
        label: label,
        sphere: sphere,
        lastVerifiedAt: verified,
      );

  final camille = Contact(
    id: 'camille',
    displayName: 'Camille Dubois',
    phoneNumbers: [
      n('cam_pro', '+33612345678', PhoneLabel.mobilePro, Sphere.pro),
      n('cam_perso', '+33698765432', PhoneLabel.mobilePerso, Sphere.perso),
    ],
  );

  final maman = Contact(
    id: 'maman',
    displayName: 'Maman',
    isFavoritePinned: true,
    phoneNumbers: [
      n('maman_perso', '+33600000001', PhoneLabel.mobilePerso, Sphere.perso),
    ],
  );

  final fournisseur = Contact(
    id: 'fourn',
    displayName: 'Fournisseur SARL',
    phoneNumbers: [
      n('fourn_fixe', '+33140000000', PhoneLabel.fixeBureau, Sphere.pro),
    ],
  );

  return ContextSnapshot(
    now: now,
    contacts: [fournisseur, camille, maman],
    upcomingEvents: [
      CalendarEvent(
        title: 'Point projet',
        start: now.add(const Duration(minutes: 18)),
        end: now.add(const Duration(minutes: 48)),
        participantContactIds: {'camille'},
      ),
    ],
  );
}
