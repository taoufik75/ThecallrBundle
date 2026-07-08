import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import '../widgets/contact_tile.dart';

/// Liste de la base canonique, avec recherche.
class ContactsListScreen extends ConsumerStatefulWidget {
  const ContactsListScreen({super.key});

  @override
  ConsumerState<ContactsListScreen> createState() => _ContactsListScreenState();
}

class _ContactsListScreenState extends ConsumerState<ContactsListScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(contactsControllerProvider);

    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur : $e')),
      data: (data) {
        final q = _query.trim().toLowerCase();
        final contacts = q.isEmpty
            ? data.contacts
            : data.contacts.where((c) {
                final hay = [
                  c.effectiveName,
                  c.company,
                  ...c.phones.map((p) => p.raw),
                  ...c.emails.map((e) => e.raw),
                ].join(' ').toLowerCase();
                return hay.contains(q);
              }).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Rechercher un contact…',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            if (data.lastSync != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${data.contacts.length} contacts • '
                    '${data.lastSync!.rawCount} fiches lues • '
                    '${data.pendingCount} doublons à vérifier',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              ),
            const SizedBox(height: 4),
            Expanded(
              child: contacts.isEmpty
                  ? const Center(child: Text('Aucun contact'))
                  : ListView.separated(
                      itemCount: contacts.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) => ContactTile(contacts[i]),
                    ),
            ),
          ],
        );
      },
    );
  }
}
