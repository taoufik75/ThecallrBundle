# Kontext — carnet de contacts intelligent et contextuel

> Nom de code provisoire. Projet **autonome**, sans lien avec le bundle Symfony `Thecallr`
> présent à la racine de ce dépôt. Vocation à être extrait vers son propre dépôt.

## En une phrase

Une app mobile qui unifie tous les répertoires (téléphone, ordi, pro, privé) en une source de
vérité propre, garde les numéros à jour, et propose **le bon contact et le bon numéro selon le
contexte du moment**.

*« Le bon contact, le bon numéro, au bon moment. »*

## Les trois piliers

1. **Consolidation & fraîcheur** — une fiche unique par personne, sans doublon, à jour *(socle)*.
2. **Bon numéro au bon moment** — choisir *quel* numéro proposer selon l'heure/le jour.
3. **Favoris dynamiques** — proposer *qui* contacter (calendrier, habitudes).

## État

Phase de **cadrage** (v0). Aucun code applicatif pour l'instant.

- Cadrage produit complet : [`docs/00-cadrage-produit.md`](docs/00-cadrage-produit.md)

## Choix par défaut (à valider)

| Sujet | Choix par défaut | Statut |
|-------|------------------|--------|
| Techno mobile | Flutter (iOS + Android) | à valider |
| Modèle de données | Local-first, sync chiffrée en v2 | à valider |
| Premier pilier MVP | Consolidation / doublons | à valider |
| Nom du produit | *Kontext* (provisoire) | à valider |

## Prochaine étape

Initialiser le squelette de l'app (arborescence, navigation, schéma de données local, écrans
vides), prêt à recevoir l'import de contacts.

## Structure du dossier

```
kontext/
├── README.md          # ce fichier
└── docs/
    └── 00-cadrage-produit.md   # cadrage produit + architecture + roadmap
```
