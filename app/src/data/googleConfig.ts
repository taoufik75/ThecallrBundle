/**
 * Identifiants OAuth Google (console Google Cloud → « ID client OAuth »).
 *
 * TODO(config) : renseigner ces valeurs pour activer l'import Google. Tant
 * qu'elles sont vides, le bouton « Connecter Google » reste inactif. Ce ne sont
 * pas des secrets (les client IDs publics OAuth mobiles/web ne le sont pas),
 * mais ils dépendent de ton projet Google Cloud.
 */
export const GOOGLE_WEB_CLIENT_ID = '';
export const GOOGLE_IOS_CLIENT_ID = '';
export const GOOGLE_ANDROID_CLIENT_ID = '';

/** Lecture seule des contacts. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly',
];

export const GOOGLE_CONFIGURED =
  GOOGLE_WEB_CLIENT_ID !== '' ||
  GOOGLE_IOS_CLIENT_ID !== '' ||
  GOOGLE_ANDROID_CLIENT_ID !== '';
