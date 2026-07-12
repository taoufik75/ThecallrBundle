import 'dart:math' as math;

import 'models/calendar_event.dart';
import 'models/call_event.dart';
import 'models/contact.dart';
import 'models/context_snapshot.dart';
import 'models/enums.dart';
import 'models/phone_number.dart';
import 'models/suggestion.dart';

/// Poids du score additif. Constantes au MVP ; ajustés par apprentissage en
/// phase 2 sans changer la structure (donc sans perdre l'explicabilité).
class ScoringWeights {
  const ScoringWeights({
    this.time = 0.30,
    this.event = 0.30,
    this.recency = 0.12,
    this.frequency = 0.10,
    this.preference = 0.10,
    this.stalePenalty = 0.35,
    this.sphereMismatchPenalty = 0.20,
  });

  final double time;
  final double event;
  final double recency;
  final double frequency;
  final double preference;
  final double stalePenalty;
  final double sphereMismatchPenalty;

  static const ScoringWeights defaults = ScoringWeights();
}

/// Numéro évalué, avec son score et ses raisons — brique interne réutilisée
/// pour choisir le meilleur numéro d'un contact.
class ScoredNumber {
  const ScoredNumber(this.number, this.score, this.reasons);
  final PhoneNumber number;
  final double score;
  final List<String> reasons;
}

/// Moteur de suggestion contextuelle.
///
/// Pur, déterministe, sans I/O : prend un [ContextSnapshot] et rend une liste
/// de [Suggestion] ordonnée du plus pertinent au moins pertinent.
class ContextEngine {
  const ContextEngine({this.weights = ScoringWeights.defaults});

  final ScoringWeights weights;

  /// Heures ouvrées de référence pour la cohérence de sphère : lun–ven 08:00–19:00.
  static const int _workStartMinute = 8 * 60;
  static const int _workEndMinute = 19 * 60;

  /// Classe les contacts. Les favoris épinglés sont forcés en tête (triés entre
  /// eux par score), suivis des autres par score décroissant.
  List<Suggestion> rank(ContextSnapshot snapshot) {
    final suggestions = <Suggestion>[];

    for (final contact in snapshot.contacts) {
      final best = _bestNumberFor(contact, snapshot);
      if (best == null) continue; // aucun numéro proposable
      suggestions.add(
        Suggestion(
          contact: contact,
          bestNumber: best.number,
          score: best.score,
          reasons: best.reasons,
        ),
      );
    }

    suggestions.sort((a, b) {
      // Un favori épinglé l'emporte toujours sur un non-épinglé.
      final pa = a.contact.isFavoritePinned ? 1 : 0;
      final pb = b.contact.isFavoritePinned ? 1 : 0;
      if (pa != pb) return pb - pa;
      return b.score.compareTo(a.score);
    });

    return suggestions;
  }

  /// Meilleur numéro proposable d'un contact (null s'il n'en a aucun).
  ScoredNumber? _bestNumberFor(Contact contact, ContextSnapshot snapshot) {
    ScoredNumber? best;
    for (final number in contact.proposableNumbers) {
      final scored = _scoreNumber(contact, number, snapshot);
      if (best == null || scored.score > best.score) best = scored;
    }
    return best;
  }

  ScoredNumber _scoreNumber(
    Contact contact,
    PhoneNumber number,
    ContextSnapshot snapshot,
  ) {
    final now = snapshot.now;
    final reasons = <_Reason>[];

    final timeFit = _timeFit(number, now);
    final eventRel = _eventRelevance(contact, snapshot.upcomingEvents, now);
    final recency = _recency(contact, snapshot.history, now);
    final frequency = _frequency(contact, snapshot.history, now);
    final preference = _userPreference(number);
    final stale = _stalePenalty(number, now);
    final sphereMismatch = _sphereMismatch(number, now);

    final score = weights.time * timeFit +
        weights.event * eventRel +
        weights.recency * recency +
        weights.frequency * frequency +
        weights.preference * preference -
        weights.stalePenalty * stale -
        weights.sphereMismatchPenalty * sphereMismatch;

    // Raisons explicables, pondérées par leur contribution réelle au score.
    if (eventRel > 0) {
      reasons.add(_Reason(weights.event * eventRel, _eventReason(eventRel)));
    }
    if (timeFit >= 1.0) {
      reasons.add(_Reason(weights.time * timeFit, 'créneau habituel de ce numéro'));
    }
    if (frequency > 0.3) {
      reasons.add(_Reason(weights.frequency * frequency, 'vous l\'appelez souvent'));
    } else if (recency > 0.5) {
      reasons.add(_Reason(weights.recency * recency, 'interaction récente'));
    }
    if (number.status == PhoneStatus.suspect) {
      reasons.add(_Reason(0.0, 'numéro à confirmer'));
    }
    if (contact.isFavoritePinned) {
      reasons.add(_Reason(double.infinity, 'favori épinglé'));
    }

    reasons.sort((a, b) => b.weight.compareTo(a.weight));
    return ScoredNumber(
      number,
      score,
      reasons.map((r) => r.text).toList(growable: false),
    );
  }

  // --- Composantes du score (chacune normalisée dans [0, 1]) ---

  /// 1.0 dans une fenêtre `preferred`, 0.0 dans un `avoid`, 0.5 sinon.
  /// Un `avoid` l'emporte sur un `preferred` en cas de chevauchement.
  double _timeFit(PhoneNumber number, DateTime now) {
    var matchedPreferred = false;
    for (final a in number.availabilities) {
      if (!a.matches(now)) continue;
      if (a.kind == AvailabilityKind.avoid) return 0.0;
      if (a.kind == AvailabilityKind.preferred) matchedPreferred = true;
    }
    return matchedPreferred ? 1.0 : 0.5;
  }

  /// Proximité avec un rendez-vous impliquant le contact, dans la fenêtre
  /// [début − 45 min, fin]. Pendant l'événement : 1.0. Avant : rampe de 0.6 à 1.0.
  double _eventRelevance(
    Contact contact,
    List<CalendarEvent> events,
    DateTime now,
  ) {
    var best = 0.0;
    for (final e in events) {
      if (!e.participantContactIds.contains(contact.id)) continue;
      final leadMinutes = e.start.difference(now).inMinutes;
      if (now.isAtSameMomentAs(e.start) ||
          (now.isAfter(e.start) && now.isBefore(e.end))) {
        best = math.max(best, 1.0); // pendant le RDV
      } else if (leadMinutes > 0 && leadMinutes <= 45) {
        best = math.max(best, 1.0 - (leadMinutes / 45.0) * 0.4);
      }
    }
    return best;
  }

  /// Décroissance exponentielle depuis la dernière interaction (demi-vie 14 j).
  double _recency(Contact contact, List<CallEvent> history, DateTime now) {
    final ids = _numberIds(contact);
    DateTime? last;
    for (final ev in history) {
      if (!ids.contains(ev.phoneNumberId)) continue;
      if (last == null || ev.occurredAt.isAfter(last)) last = ev.occurredAt;
    }
    if (last == null) return 0.0;
    final days = now.difference(last).inMinutes / (60 * 24);
    return math.exp(-math.ln2 * days / 14.0).clamp(0.0, 1.0);
  }

  /// Fréquence d'interaction sur 30 jours glissants, saturée à 10 interactions.
  double _frequency(Contact contact, List<CallEvent> history, DateTime now) {
    final ids = _numberIds(contact);
    final since = now.subtract(const Duration(days: 30));
    var count = 0;
    for (final ev in history) {
      if (ids.contains(ev.phoneNumberId) && ev.occurredAt.isAfter(since)) {
        count++;
      }
    }
    return (count / 10.0).clamp(0.0, 1.0);
  }

  /// Préférence utilisateur dérivée de la priorité de base du numéro.
  double _userPreference(PhoneNumber number) =>
      (number.priority / 5.0).clamp(0.0, 1.0);

  /// Pénalité de fraîcheur : maximale si `suspect` ; sinon croît avec l'âge de
  /// la dernière vérification (jamais vérifié → pénalité modérée).
  double _stalePenalty(PhoneNumber number, DateTime now) {
    if (number.status == PhoneStatus.suspect) return 1.0;
    final verified = number.lastVerifiedAt;
    if (verified == null) return 0.3;
    final days = now.difference(verified).inMinutes / (60 * 24);
    return (days / 365.0).clamp(0.0, 1.0) * 0.5;
  }

  /// Pénalise un numéro proposé hors de sa sphère naturelle : un `pro` en
  /// soirée/week-end, un `perso` en pleine journée ouvrée.
  double _sphereMismatch(PhoneNumber number, DateTime now) {
    final inWorkHours = _isWorkHours(now);
    if (number.sphere == Sphere.pro && !inWorkHours) return 1.0;
    if (number.sphere == Sphere.perso && inWorkHours) return 0.6;
    return 0.0;
  }

  bool _isWorkHours(DateTime now) {
    final isWeekday = now.weekday >= DateTime.monday &&
        now.weekday <= DateTime.friday;
    if (!isWeekday) return false;
    final minutes = now.hour * 60 + now.minute;
    return minutes >= _workStartMinute && minutes < _workEndMinute;
  }

  Set<String> _numberIds(Contact contact) =>
      contact.phoneNumbers.map((n) => n.id).toSet();

  String _eventReason(double relevance) => relevance >= 1.0
      ? 'rendez-vous en cours'
      : 'rendez-vous imminent';
}

/// Raison pondérée, triée par contribution avant affichage.
class _Reason {
  const _Reason(this.weight, this.text);
  final double weight;
  final String text;
}
