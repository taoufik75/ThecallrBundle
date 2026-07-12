import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_SCOPES,
  GOOGLE_WEB_CLIENT_ID,
} from './googleConfig';

// Termine proprement la session d'auth au retour dans l'app.
WebBrowser.maybeCompleteAuthSession();

/**
 * Hook d'authentification Google (OAuth). Retourne `promptAsync` pour lancer la
 * connexion et `response` dont on extrait le jeton d'accès à la réussite.
 * Nécessite des client IDs configurés (voir googleConfig.ts).
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    scopes: GOOGLE_SCOPES,
  });

  const accessToken =
    response?.type === 'success' ? response.authentication?.accessToken : undefined;

  return { request, response, promptAsync, accessToken };
}
