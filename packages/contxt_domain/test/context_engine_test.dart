import 'package:contxt_domain/contxt_domain.dart';
import 'package:test/test.dart';

// Jours de référence : 2024-01-08 = lundi, 2024-01-07 = dimanche.
final mondayMorning = DateTime(2024, 1, 8, 9, 0);
final mondayMidMorning = DateTime(2024, 1, 8, 10, 0);
final sundayEvening = DateTime(2024, 1, 7, 21, 0);

PhoneNumber num_({
  required String id,
  required PhoneLabel label,
  required Sphere sphere,
  int priority = 0,
  PhoneStatus status = PhoneStatus.active,
  DateTime? verifiedAt,
  List<Availability> availabilities = const [],
}) =>
    PhoneNumber(
      id: id,
      e164: '+3360000${id.hashCode.abs() % 10000}',
      label: label,
      sphere: sphere,
      priority: priority,
      status: status,
      // Vérifié « maintenant » par défaut pour neutraliser le bruit de fraîcheur.
      lastVerifiedAt: verifiedAt ?? DateTime(2024, 1, 8, 8, 0),
      availabilities: availabilities,
    );

const engine = ContextEngine();

void main() {
  group('ContextEngine.rank — scénarios de spécification', () {
    test('1. Matin ouvré + RDV imminent → contact du RDV en tête, sur son pro',
        () {
      final camille = Contact(
        id: 'camille',
        displayName: 'Camille Dubois',
        phoneNumbers: [
          num_(id: 'cam_pro', label: PhoneLabel.mobilePro, sphere: Sphere.pro),
          num_(id: 'cam_perso',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );
      final bob = Contact(
        id: 'bob',
        displayName: 'Bob Martin',
        phoneNumbers: [
          num_(id: 'bob_perso',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final snapshot = ContextSnapshot(
        now: mondayMorning,
        contacts: [bob, camille],
        upcomingEvents: [
          CalendarEvent(
            title: 'Point projet',
            start: mondayMorning.add(const Duration(minutes: 18)),
            end: mondayMorning.add(const Duration(minutes: 48)),
            participantContactIds: {'camille'},
          ),
        ],
      );

      final ranked = engine.rank(snapshot);

      expect(ranked.first.contact.id, 'camille');
      expect(ranked.first.bestNumber.id, 'cam_pro');
      expect(ranked.first.reasons, contains('rendez-vous imminent'));
    });

    test('2. Dimanche 21h → le numéro perso est préféré au pro', () {
      final contact = Contact(
        id: 'alex',
        displayName: 'Alex',
        phoneNumbers: [
          num_(id: 'alex_pro',
              label: PhoneLabel.fixeBureau, sphere: Sphere.pro),
          num_(id: 'alex_perso',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: sundayEvening, contacts: [contact]),
      );

      expect(ranked.single.bestNumber.id, 'alex_perso');
    });

    test('3a. Un numéro périmé n\'est jamais proposé ; l\'actif remonte', () {
      final contact = Contact(
        id: 'chris',
        displayName: 'Chris',
        phoneNumbers: [
          num_(id: 'chris_old',
              label: PhoneLabel.mobilePerso,
              sphere: Sphere.perso,
              status: PhoneStatus.retired),
          num_(id: 'chris_new',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: sundayEvening, contacts: [contact]),
      );

      expect(ranked.single.bestNumber.id, 'chris_new');
    });

    test('3b. Un contact sans aucun numéro proposable est ignoré', () {
      final contact = Contact(
        id: 'ghost',
        displayName: 'Ghost',
        phoneNumbers: [
          num_(id: 'ghost_old',
              label: PhoneLabel.mobilePerso,
              sphere: Sphere.perso,
              status: PhoneStatus.retired),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: sundayEvening, contacts: [contact]),
      );

      expect(ranked, isEmpty);
    });

    test('3c. Un numéro suspect est déclassé au profit de l\'actif', () {
      final contact = Contact(
        id: 'dana',
        displayName: 'Dana',
        phoneNumbers: [
          num_(id: 'dana_suspect',
              label: PhoneLabel.mobilePerso,
              sphere: Sphere.perso,
              status: PhoneStatus.suspect),
          num_(id: 'dana_ok',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: sundayEvening, contacts: [contact]),
      );

      expect(ranked.single.bestNumber.id, 'dana_ok');
    });

    test('4. Un favori épinglé est en tête même hors de son créneau', () {
      // Le pin porte un numéro pro, un dimanche soir : mal classé en temps normal.
      final pinned = Contact(
        id: 'vip',
        displayName: 'VIP',
        isFavoritePinned: true,
        phoneNumbers: [
          num_(id: 'vip_pro', label: PhoneLabel.fixeBureau, sphere: Sphere.pro),
        ],
      );
      final regular = Contact(
        id: 'reg',
        displayName: 'Régulier',
        phoneNumbers: [
          num_(id: 'reg_perso',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: sundayEvening, contacts: [regular, pinned]),
      );

      expect(ranked.first.contact.id, 'vip');
      expect(ranked.first.reasons, contains('favori épinglé'));
      // Le régulier scorerait plus haut sans l'épinglage : on le vérifie.
      expect(ranked.first.score, lessThan(ranked.last.score));
    });

    test('5. Entre un créneau à éviter et un créneau préféré, le préféré gagne',
        () {
      final windowMon = {DateTime.monday};
      final contact = Contact(
        id: 'sam',
        displayName: 'Sam',
        phoneNumbers: [
          num_(
            id: 'sam_avoid',
            label: PhoneLabel.mobilePerso,
            sphere: Sphere.perso,
            availabilities: [
              Availability(
                daysOfWeek: windowMon,
                startMinute: 9 * 60,
                endMinute: 12 * 60,
                kind: AvailabilityKind.avoid,
              ),
            ],
          ),
          num_(
            id: 'sam_pref',
            label: PhoneLabel.fixeBureau,
            sphere: Sphere.perso,
            availabilities: [
              Availability(
                daysOfWeek: windowMon,
                startMinute: 9 * 60,
                endMinute: 12 * 60,
                kind: AvailabilityKind.preferred,
              ),
            ],
          ),
        ],
      );

      final ranked = engine.rank(
        ContextSnapshot(now: mondayMidMorning, contacts: [contact]),
      );

      expect(ranked.single.bestNumber.id, 'sam_pref');
    });
  });

  group('Propriétés du moteur', () {
    test('déterminisme : même instantané → même sortie', () {
      final contact = Contact(
        id: 'x',
        displayName: 'X',
        phoneNumbers: [
          num_(id: 'x1', label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
          num_(id: 'x2', label: PhoneLabel.mobilePro, sphere: Sphere.pro),
        ],
      );
      final snapshot =
          ContextSnapshot(now: mondayMorning, contacts: [contact]);

      final a = engine.rank(snapshot);
      final b = engine.rank(snapshot);

      expect(a.length, b.length);
      for (var i = 0; i < a.length; i++) {
        expect(a[i].bestNumber.id, b[i].bestNumber.id);
        expect(a[i].score, b[i].score);
      }
    });

    test('la fréquence d\'appels fait remonter un contact', () {
      final often = Contact(
        id: 'often',
        displayName: 'Souvent',
        phoneNumbers: [
          num_(id: 'often_n',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );
      final rare = Contact(
        id: 'rare',
        displayName: 'Rarement',
        phoneNumbers: [
          num_(id: 'rare_n',
              label: PhoneLabel.mobilePerso, sphere: Sphere.perso),
        ],
      );

      final history = [
        for (var i = 1; i <= 8; i++)
          CallEvent(
            phoneNumberId: 'often_n',
            direction: CallDirection.outgoing,
            channel: CallChannel.call,
            occurredAt: mondayMorning.subtract(Duration(days: i)),
          ),
      ];

      final ranked = engine.rank(
        ContextSnapshot(
          now: mondayMorning,
          contacts: [rare, often],
          history: history,
        ),
      );

      expect(ranked.first.contact.id, 'often');
      expect(ranked.first.reasons, contains('vous l\'appelez souvent'));
    });
  });
}
