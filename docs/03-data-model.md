# 03 — Modèle de données

Le modèle est pensé pour **unifier** plusieurs sources tout en gardant leur trace, et pour porter le **contexte** nécessaire au scoring.

## Vue d'ensemble

```
Contact 1───* PhoneNumber 1───* Availability
   │              │
   │              *
   │           CallEvent (historique)
   *
ContactSource (d'où vient la fiche : téléphone, Google…)
```

## Entités

### Contact
La personne unifiée. Résultat de la fusion d'une ou plusieurs fiches sources.

| Champ | Type | Notes |
|---|---|---|
| id | UUID | clé interne stable |
| displayName | string | nom affiché |
| givenName / familyName | string? | pour dédup et tri |
| sphere | enum `pro` \| `perso` \| `mixte` | sphère dominante (défaut : `mixte`) |
| isFavoritePinned | bool | favori figé forcé par l'utilisateur (l'emporte sur le scoring) |
| createdAt / updatedAt | datetime | |

### ContactSource
Trace de provenance — permet la fusion non destructive et la ré-synchro idempotente.

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| contactId | FK Contact | |
| provider | enum `device` \| `google` \| `carddav`(v2) | |
| externalId | string | id stable côté source |
| rawPayload | json | snapshot brut pour audit/annulation |

Contrainte d'unicité : `(provider, externalId)` → garantit l'idempotence de l'import.

### PhoneNumber
Un numéro, typé et contextualisé. **Plusieurs par contact.**

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| contactId | FK Contact | |
| e164 | string | numéro normalisé E.164 (clé de comparaison) |
| rawInput | string | tel que saisi/importé |
| label | enum `mobile_perso` \| `mobile_pro` \| `fixe_bureau` \| `domicile` \| `autre` | |
| sphere | enum `pro` \| `perso` | pour filtrer selon le contexte |
| priority | int | préférence de base fixée par l'utilisateur (0 = neutre) |
| status | enum `active` \| `suspect` \| `retired` | `suspect` après un signalement, `retired` = ne plus proposer |
| lastVerifiedAt | datetime? | dernière fois où l'utilisateur a confirmé qu'il marche |
| createdAt / updatedAt | datetime | |

### Availability
Fenêtres de joignabilité rattachées à un numéro. Alimente directement le scoring horaire.

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| phoneNumberId | FK PhoneNumber | |
| daysOfWeek | bitmask | ex. lun–ven |
| startMinute / endMinute | int | minutes depuis minuit (ex. 540 = 09:00) |
| kind | enum `preferred` \| `avoid` | fenêtre à privilégier ou à éviter |

Exemple : un `fixe_bureau` a une `Availability preferred` lun–ven 09:00–18:00 ; le `mobile_perso` a un `avoid` en semaine sur ces mêmes heures.

### CallEvent (historique — surtout phase 2)
Trace des interactions, pour l'apprentissage.

| Champ | Type | Notes |
|---|---|---|
| id | UUID | |
| phoneNumberId | FK PhoneNumber | |
| direction | enum `outgoing` \| `incoming` \| `missed` | |
| channel | enum `call` \| `sms` | |
| occurredAt | datetime | |
| succeeded | bool? | ex. appel décroché (si disponible) |

## Doublons : clé de rapprochement

Le `DedupeService` propose une fusion quand deux fiches sources partagent au moins un signal fort :

1. **Numéro identique en E.164** (signal le plus fort).
2. Nom très proche (distance de Levenshtein normalisée) **+** même email.
3. Email identique.

La fusion est **suggérée**, jamais automatique et destructive : l'utilisateur valide. On conserve les `ContactSource` d'origine → annulation possible.

## Invariants

- Tout `PhoneNumber.e164` est valide E.164 (validé à l'écriture).
- Un `Contact` a au moins une `ContactSource`.
- Un `PhoneNumber status = retired` n'est jamais proposé par le moteur (mais reste consultable).
- La suppression d'un `Contact` cascade sur ses `PhoneNumber`, `Availability`, `ContactSource` (les `CallEvent` peuvent être anonymisés plutôt que supprimés, à décider).
