/// Cœur métier de Contxt : modèles unifiés et moteur de suggestion contextuelle.
///
/// Ce package est du Dart pur (aucune dépendance Flutter), afin de rester
/// totalement testable et réutilisable côté app, backend ou tooling.
library contxt_domain;

export 'src/context_engine.dart';
export 'src/models/availability.dart';
export 'src/models/calendar_event.dart';
export 'src/models/call_event.dart';
export 'src/models/contact.dart';
export 'src/models/context_snapshot.dart';
export 'src/models/enums.dart';
export 'src/models/phone_number.dart';
export 'src/models/suggestion.dart';
