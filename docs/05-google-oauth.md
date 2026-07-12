# 05 — Activer l'import Google (OAuth)

L'import Google est déjà codé (`app/src/data/google*`). Il ne manque que **tes**
identifiants OAuth, propres à ton projet Google Cloud. ~5 minutes.

> Ces identifiants dépendent de ton compte/projet — je ne peux pas les créer à ta
> place (ils engagent ton compte Google). Une fois obtenus, colle-les et je câble.

## Pré-requis dans le repo (déjà fait)

- `app.json` : `scheme = "contxt"`, `ios.bundleIdentifier = com.contxt.app`,
  `android.package = com.contxt.app`. **Change ces identifiants si tu veux les
  tiens**, mais ils doivent correspondre à ce que tu déclares ci-dessous.

## Étapes (console.cloud.google.com)

1. **Projet** : crée ou sélectionne un projet.
2. **API People** : *APIs & Services → Library → « People API » → Enable*.
3. **Écran de consentement OAuth** : *OAuth consent screen*
   - Type **External**, renseigne le nom de l'app et ton e-mail.
   - **Scopes** : ajoute `.../auth/contacts.readonly`.
   - **Test users** : ajoute ton adresse Google (sinon connexion refusée tant que
     l'app n'est pas publiée).
4. **Identifiants** : *Credentials → Create Credentials → OAuth client ID*, crée
   **trois** clients :
   - **Web application** → donne le **Web client ID** (utilisé par Expo Go et le
     web). Ajoute l'URI de redirection Expo si demandé : `https://auth.expo.io/@ton-compte/contxt`.
   - **iOS** → *Bundle ID* = `com.contxt.app` → **iOS client ID**.
   - **Android** → *Package name* = `com.contxt.app` + **SHA‑1** de ta clé de
     signature (`expo credentials` ou `keytool`) → **Android client ID**.

## Ce que tu me donnes

Colle-moi simplement :

```
WEB_CLIENT_ID     = xxxx.apps.googleusercontent.com
IOS_CLIENT_ID     = xxxx.apps.googleusercontent.com
ANDROID_CLIENT_ID = xxxx.apps.googleusercontent.com
```

Je les mets dans `app/src/data/googleConfig.ts` et le bouton **« Connecter
Google »** s'active. (Pour un simple test dans Expo Go, le **Web client ID** seul
suffit souvent.)

## Rappel

Les client IDs OAuth publics **ne sont pas des secrets** — ils peuvent vivre dans
le code. En revanche, ne mets jamais un *client secret* côté app.
