// Démonstrateur console de l'écran « Maintenant ».
//
// Lance : `dart run example/now_demo.dart`
// Simule un lundi 09:00 avec un RDV imminent et montre le classement produit
// par le moteur, avec le meilleur numéro et les raisons explicables.
import 'package:contxt_domain/contxt_domain.dart';

void main() {
  final now = DateTime(2024, 1, 8, 9, 0); // lundi 09:00
  final verified = DateTime(2024, 1, 8, 8, 0);

  final camille = Contact(
    id: 'camille',
    displayName: 'Camille Dubois',
    phoneNumbers: [
      PhoneNumber(
        id: 'cam_pro',
        e164: '+33612345678',
        label: PhoneLabel.mobilePro,
        sphere: Sphere.pro,
        lastVerifiedAt: verified,
      ),
      PhoneNumber(
        id: 'cam_perso',
        e164: '+33698765432',
        label: PhoneLabel.mobilePerso,
        sphere: Sphere.perso,
        lastVerifiedAt: verified,
      ),
    ],
  );

  final maman = Contact(
    id: 'maman',
    displayName: 'Maman',
    isFavoritePinned: true,
    phoneNumbers: [
      PhoneNumber(
        id: 'maman_perso',
        e164: '+33600000001',
        label: PhoneLabel.mobilePerso,
        sphere: Sphere.perso,
        lastVerifiedAt: verified,
      ),
    ],
  );

  final fournisseur = Contact(
    id: 'fourn',
    displayName: 'Fournisseur SARL',
    phoneNumbers: [
      PhoneNumber(
        id: 'fourn_fixe',
        e164: '+33140000000',
        label: PhoneLabel.fixeBureau,
        sphere: Sphere.pro,
        lastVerifiedAt: verified,
      ),
    ],
  );

  final snapshot = ContextSnapshot(
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

  final suggestions = const ContextEngine().rank(snapshot);

  print('=== Maintenant · lundi 09:00 ===\n');
  for (var i = 0; i < suggestions.length; i++) {
    final s = suggestions[i];
    final pin = s.contact.isFavoritePinned ? '📌 ' : '';
    print('${i + 1}. $pin${s.contact.displayName} — ${s.bestNumber.e164} '
        '(${s.bestNumber.label.name})');
    print('   score ${s.score.toStringAsFixed(3)}'
        '${s.reasons.isEmpty ? '' : ' · ${s.reasons.join(' · ')}'}\n');
  }
}
