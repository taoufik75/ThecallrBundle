# 01 — Vision & MVP

## Vision

Aujourd'hui, joindre quelqu'un demande un effort mental : « quel numéro ? est-il à jour ? est-ce le bon moment ? ». **Contxt** supprime cet effort. L'app connaît tes contacts, leurs numéros à jour, et te propose spontanément la bonne personne sur le bon canal, en fonction du contexte du moment.

Principe directeur : **l'utilisateur ne cherche plus un contact, l'app le lui propose.**

## Ce qui existe déjà (et pourquoi ça ne suffit pas)

- **Carnet natif iOS/Android** : stocke, mais ne déduplique pas intelligemment, ne détecte pas les numéros périmés, et ses « favoris » sont statiques.
- **Google Contacts / Outlook** : bons pour la synchro, aucune intelligence de contexte.
- **CRM (HubSpot, etc.)** : orientés pro/vente, lourds, pas pensés pour la vie personnelle mêlée au pro.

Le trou dans le marché : **l'intelligence contextuelle personnelle**, à la croisée du carnet et de l'agenda.

## Périmètre du MVP (phase 1)

Objectif : prouver la valeur du moteur contextuel sur **un seul appareil**, sans backend.

### Inclus

1. **Import & unification**
   - Import des contacts du téléphone (natif) + Google People API (OAuth).
   - Détection de doublons (même personne éclatée en plusieurs fiches).
   - Fusion en fiches uniques éditables.

2. **Fiche contact enrichie**
   - Plusieurs numéros par contact, chacun *typé* (mobile perso, mobile pro, fixe bureau, domicile…).
   - Métadonnées de contexte par numéro : plages horaires de joignabilité, sphère (pro/privé).

3. **Écran « Maintenant » (l'écran signature)**
   - Liste ordonnée des contacts/numéros suggérés selon l'heure actuelle + prochains événements agenda (lecture seule du calendrier).
   - Un appui = appel/SMS sur le *bon* numéro (celui qui a le meilleur score).

4. **Signalement numéro périmé**
   - Action simple « ce numéro ne marche plus » qui déclasse le numéro et propose une alternative.

### Explicitement hors MVP (phases suivantes)

- Backend & synchro multi-appareils.
- Apprentissage automatique fin (le moteur commence en règles explicites, voir `04-context-engine.md`).
- Écriture/synchro sortante vers les carnets externes (le MVP lit et unifie ; l'app est source de vérité locale).
- Partage de contacts / collaboration.
- Détection automatique de numéros périmés via signaux réseau.

## Roadmap indicative

| Phase | Thème | Livrable clé |
|---|---|---|
| **0** | Cadrage | Cette documentation + validation des choix |
| **1** | MVP local | Import/unification + fiche enrichie + écran « Maintenant » (règles) |
| **2** | Apprentissage | Le moteur observe l'historique d'appels et pondère les suggestions |
| **3** | Cloud & multi-appareils | Backend de synchro chiffrée, sauvegarde |
| **4** | Favoris dynamiques avancés | Détection de « périodes » (projet en cours, voyage…) et regroupements |

## Critères de succès du MVP

- Un import réel réduit visiblement les doublons (mesure : nb de fiches avant/après).
- Sur l'écran « Maintenant », le bon numéro est en tête dans une majorité de cas de test scénarisés (matin/soirée/réunion).
- Le temps « intention d'appeler → appel lancé » est plus court qu'avec le carnet natif.
