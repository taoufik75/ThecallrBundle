import 'package:contxt_domain/contxt_domain.dart';
import 'package:flutter/material.dart';

import '../../data/sample_snapshot.dart';

/// Écran signature « Maintenant » : la liste des contacts/numéros suggérés par
/// le moteur en fonction du contexte courant. Un appui appelle le bon numéro.
class NowScreen extends StatelessWidget {
  const NowScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // MVP : instantané de démonstration + horloge locale. À remplacer par la
    // couche data réelle (contacts + agenda) via un provider Riverpod.
    final now = DateTime.now();
    final snapshot = buildSampleSnapshot(now);
    final suggestions = const ContextEngine().rank(snapshot);

    return Scaffold(
      appBar: AppBar(title: const Text('Maintenant')),
      body: ListView.separated(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: suggestions.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, i) => _SuggestionTile(suggestions[i]),
      ),
    );
  }
}

class _SuggestionTile extends StatelessWidget {
  const _SuggestionTile(this.suggestion);

  final Suggestion suggestion;

  @override
  Widget build(BuildContext context) {
    final contact = suggestion.contact;
    final number = suggestion.bestNumber;

    return ListTile(
      leading: CircleAvatar(child: Text(_initials(contact.displayName))),
      title: Row(
        children: [
          if (contact.isFavoritePinned)
            const Padding(
              padding: EdgeInsets.only(right: 4),
              child: Icon(Icons.push_pin, size: 16),
            ),
          Expanded(child: Text(contact.displayName)),
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${number.e164} · ${_labelFr(number.label)}'),
          if (suggestion.reasons.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                suggestion.reasons.join(' · '),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
        ],
      ),
      trailing: IconButton(
        icon: const Icon(Icons.call),
        onPressed: () {
          // TODO(data): déclencher l'appel via url_launcher (tel:) et
          // journaliser un CallEvent pour l'apprentissage (phase 2).
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Appel de ${contact.displayName}…')),
          );
        },
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }

  String _labelFr(PhoneLabel label) => switch (label) {
        PhoneLabel.mobilePerso => 'mobile perso',
        PhoneLabel.mobilePro => 'mobile pro',
        PhoneLabel.fixeBureau => 'fixe bureau',
        PhoneLabel.domicile => 'domicile',
        PhoneLabel.autre => 'autre',
      };
}
