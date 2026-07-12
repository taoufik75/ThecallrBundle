/// Sphère d'un contact ou d'un numéro : professionnelle, privée ou mixte.
enum Sphere { pro, perso, mixte }

/// Type/étiquette d'un numéro de téléphone.
enum PhoneLabel { mobilePerso, mobilePro, fixeBureau, domicile, autre }

/// État de fraîcheur d'un numéro.
///
/// - [active]   : numéro considéré comme valide, proposable.
/// - [suspect]  : signalé douteux (ex. n'a pas abouti). Fortement pénalisé.
/// - [retired]  : périmé. Jamais proposé par le moteur, mais conservé.
enum PhoneStatus { active, suspect, retired }

/// Nature d'une fenêtre de disponibilité.
enum AvailabilityKind { preferred, avoid }

/// Sens d'une interaction enregistrée.
enum CallDirection { outgoing, incoming, missed }

/// Canal d'une interaction.
enum CallChannel { call, sms }
