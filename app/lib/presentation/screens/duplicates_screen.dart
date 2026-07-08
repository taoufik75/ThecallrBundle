import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/dedup/duplicate_group.dart';
import '../providers.dart';
import 'merge_review_screen.dart';

/// Liste des doublons en attente d'arbitrage.
class DuplicatesScreen extends ConsumerWidget {
  const DuplicatesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(contactsControllerProvider);

    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur : $e')),
      data: (data) {
        if (data.duplicates.isEmpty) {
          return const _EmptyState();
        }
        return ListView.separated(
          itemCount: data.duplicates.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (context, i) {
            final g = data.duplicates[i];
            return _DuplicateTile(group: g);
          },
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.verified, size: 64, color: Colors.green),
          const SizedBox(height: 12),
          Text('Aucun doublon à vérifier',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text('Votre base est propre 👌'),
        ],
      ),
    );
  }
}

class _DuplicateTile extends StatelessWidget {
  const _DuplicateTile({required this.group});
  final DuplicateGroup group;

  @override
  Widget build(BuildContext context) {
    final color = switch (group.confidence) {
      MatchConfidence.high => Colors.green,
      MatchConfidence.medium => Colors.orange,
      MatchConfidence.low => Colors.grey,
    };
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: color.withOpacity(0.15),
        child: Text('${group.size}', style: TextStyle(color: color)),
      ),
      title: Text(group.records.map((r) => r.effectiveName).join('  ·  ')),
      subtitle: Text(group.reasons.join(' — '),
          maxLines: 2, overflow: TextOverflow.ellipsis),
      trailing: Chip(
        label: Text(group.confidence.label),
        backgroundColor: color.withOpacity(0.12),
        side: BorderSide(color: color.withOpacity(0.4)),
        labelStyle: TextStyle(color: color, fontSize: 12),
      ),
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => MergeReviewScreen(group: group)),
      ),
    );
  }
}
