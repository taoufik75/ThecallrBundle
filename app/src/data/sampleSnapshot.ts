import {
  makeContact,
  makePhoneNumber,
  type CalendarEvent,
  type ContextSnapshot,
  type PhoneLabel,
  type PhoneNumber,
  type Sphere,
} from 'contxt-domain';

/**
 * Données de démonstration en mémoire, le temps que la couche data réelle
 * (import contacts natifs / Google People, persistance, lecture agenda) soit
 * branchée. Permet de voir l'écran « Maintenant » dès le premier lancement.
 */
export function buildSampleSnapshot(now: Date): ContextSnapshot {
  const verified = new Date(now.getTime() - 2 * 3600 * 1000);

  const n = (
    id: string,
    e164: string,
    label: PhoneLabel,
    sphere: Sphere,
  ): PhoneNumber =>
    makePhoneNumber({ id, e164, label, sphere, lastVerifiedAt: verified });

  const camille = makeContact({
    id: 'camille',
    displayName: 'Camille Dubois',
    phoneNumbers: [
      n('cam_pro', '+33612345678', 'mobilePro', 'pro'),
      n('cam_perso', '+33698765432', 'mobilePerso', 'perso'),
    ],
  });

  const maman = makeContact({
    id: 'maman',
    displayName: 'Maman',
    isFavoritePinned: true,
    phoneNumbers: [n('maman_perso', '+33600000001', 'mobilePerso', 'perso')],
  });

  const fournisseur = makeContact({
    id: 'fourn',
    displayName: 'Fournisseur SARL',
    phoneNumbers: [n('fourn_fixe', '+33140000000', 'fixeBureau', 'pro')],
  });

  const event: CalendarEvent = {
    title: 'Point projet',
    start: new Date(now.getTime() + 18 * 60000),
    end: new Date(now.getTime() + 48 * 60000),
    participantContactIds: new Set(['camille']),
  };

  return {
    now,
    contacts: [fournisseur, camille, maman],
    upcomingEvents: [event],
    history: [],
  };
}
