# 04 — Le moteur de contexte (cœur du produit)

C'est ici que se joue la valeur. Le reste de l'app existe pour **alimenter ce moteur en données propres** et **afficher son résultat**.

## Ce que fait le moteur

Entrée : un instantané du contexte.
Sortie : une liste ordonnée de **suggestions** `(contact, numéro, score, raisons)`.

```
ContextEngine.rank(snapshot) -> List<Suggestion>

snapshot = {
  now: DateTime,               // heure/jour courants
  contacts: List<Contact>,     // avec numéros + availabilities
  upcomingEvents: List<Event>, // prochains RDV de l'agenda
  history: List<CallEvent>,    // phase 2
}
```

Le moteur est **du TypeScript pur, déterministe, sans I/O** : mêmes entrées → même sortie. C'est ce qui le rend testable par scénarios (voir plus bas).

## Approche : règles explicites d'abord, apprentissage ensuite

On **ne commence pas** par du machine learning. On commence par un **score additif transparent**, dont chaque composante est explicable à l'utilisateur (« proposé car : réunion avec cette personne dans 20 min »). L'apprentissage (phase 2) ne fera qu'**ajuster les poids**, pas remplacer la logique.

Pourquoi : un système explicable est débuggable, inspire confiance, et fonctionne dès le premier lancement (pas de cold start).

## Le score

Pour chaque **numéro** d'un contact, on calcule :

```
score(numéro) =
      w_time  * timeFit(numéro, now)          // le bon créneau horaire
    + w_event * eventRelevance(contact, now)  // lié à un RDV imminent
    + w_recency * recency(contact, history)   // interactions récentes
    + w_freq  * frequency(contact, history)   // contact fréquent
    + w_pref  * userPreference(numéro)         // priorité/favori défini par l'user
    - p_stale * stalePenalty(numéro)           // numéro suspect/non vérifié
    - p_wrongsphere * sphereMismatch(numéro, context) // pro proposé un dimanche soir…
```

Chaque terme est normalisé dans `[0,1]` (les pénalités aussi). Les poids `w_*` / `p_*` sont des **constantes de configuration** au MVP, puis apprises en phase 2.

### Composantes

| Terme | Définition | Source de données |
|---|---|---|
| `timeFit` | 1 si `now` tombe dans une `Availability preferred` du numéro ; 0 dans un `avoid` ; 0.5 sinon | `Availability` |
| `eventRelevance` | proche de 1 si le contact est participant d'un événement dans une fenêtre `[−15min, +2h]` autour de `now` | agenda + matching participant↔contact |
| `recency` | décroissance exponentielle depuis la dernière interaction | `CallEvent` (phase 2) |
| `frequency` | fréquence d'interaction normalisée sur une fenêtre glissante (ex. 30 j) | `CallEvent` (phase 2) |
| `userPreference` | dérivé de `PhoneNumber.priority` et `Contact.isFavoritePinned` | modèle |
| `stalePenalty` | croît si `status = suspect` ou `lastVerifiedAt` ancien | modèle |
| `sphereMismatch` | pénalise un numéro `pro` hors heures ouvrées, un `perso` en pleine journée de travail | `sphere` + `now` |

### Sélection du numéro d'un contact

Le **score du contact** = score de son meilleur numéro. Sur l'écran « Maintenant », on affiche le contact et on **pré-sélectionne ce meilleur numéro** pour l'action d'appel. Les autres numéros restent accessibles d'un geste.

## Favoris dynamiques

Les « favoris » ne sont pas une liste figée : c'est simplement le **haut du classement** du moteur à l'instant T. Un favori épinglé manuellement (`isFavoritePinned`) est un override qui force la présence en tête, mais ne casse pas le tri des autres.

Les « périodes » évoquées (projet en cours, voyage) sont, en phase 4, un **boost temporaire** appliqué à un groupe de contacts (un terme `w_context * contextBoost` ajouté au score), piloté par des règles ou l'agenda.

## Explicabilité

Chaque `Suggestion` porte ses **raisons** (les termes qui ont le plus pesé), affichées en clair :

> **Camille Dubois — mobile perso**
> _Proposé car : réunion « Point projet » dans 18 min · vous l'appelez souvent le matin_

C'est un différenciateur produit autant qu'un outil de debug.

## Tests par scénarios (dès la phase 1)

Le moteur étant pur, on le verrouille avec des cas concrets. Exemples de tests à écrire :

1. **Matin, jour ouvré, RDV imminent** → le contact du RDV est en tête, sur son numéro `pro`.
2. **Dimanche 21h** → les numéros `fixe_bureau` / `mobile_pro` sont déclassés au profit des `perso`.
3. **Numéro signalé périmé** → il n'est plus proposé ; l'alternative `active` du même contact remonte.
4. **Favori épinglé** → présent en tête même hors de son créneau habituel.
5. **Deux numéros, un dans `avoid`, un dans `preferred`** → le `preferred` est pré-sélectionné.

Ces scénarios servent de **spécification exécutable** : ils fixent le comportement attendu avant d'écrire le moteur.

## Évolution vers l'apprentissage (phase 2)

- On journalise, pour chaque suggestion affichée, si l'utilisateur l'a **suivie ou ignorée**.
- On ajuste les poids `w_*` par une régression légère (côté appareil) pour maximiser le taux de suggestions suivies.
- La structure du score ne change pas → on garde l'explicabilité, on gagne en pertinence.
