# contxt_app — application mobile Flutter

App iOS + Android de Contxt. Elle consomme le moteur du package
[`../packages/contxt_domain`](../packages/contxt_domain) et affiche l'écran
« Maintenant ».

## État

Scaffold de la phase 1 : l'écran « Maintenant » est câblé sur le moteur avec un
**instantané de démonstration en mémoire** (`lib/data/sample_snapshot.dart`).
La couche data réelle (import contacts, base Drift, lecture agenda) et l'appel
téléphonique (`url_launcher`) restent à brancher — voir les `TODO(data)`.

## Lancer

Nécessite le SDK Flutter (≥ 3.27) :

```bash
cd app
flutter pub get
flutter run          # sur un simulateur/appareil
```

## Structure

```
lib/
  main.dart                  # point d'entrée + thème
  data/sample_snapshot.dart  # données de démo (temporaire)
  ui/now/now_screen.dart     # écran « Maintenant »
```

Toute la logique de classement vit dans `contxt_domain` (Dart pur, testé). L'app
ne fait que **fournir le contexte** et **afficher le résultat**.
