import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/dedup/duplicate_group.dart';
import '../../domain/dedup/merge_service.dart';
import '../../domain/entities/contact_record.dart';
import '../providers.dart';
import '../widgets/source_chip.dart';

/// Écran de revue d'un doublon : montre l'aperçu de la fusion et les
/// enregistrements d'origine, puis laisse fusionner ou séparer.
class MergeReviewScreen extends ConsumerWidget {
  const MergeReviewScreen({super.key, required this.group});

  final DuplicateGroup group;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preview = const MergeService().mergeGroup(group.records);

    return Scaffold(
      appBar: AppBar(title: const Text('Fusionner ?')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _ConfidenceBanner(group: group),
          const SizedBox(height: 16),
          Text('Aperçu du contact fusionné',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          _PreviewCard(record: preview),
          const SizedBox(height: 24),
          Text('${group.size} fiches d\'origine',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final r in group.records) _OriginCard(record: r),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.call_split),
                  label: const Text('Garder séparés'),
                  onPressed: () async {
                    await ref
                        .read(contactsControllerProvider.notifier)
                        .rejectMerge(group);
                    if (context.mounted) Navigator.pop(context);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  icon: const Icon(Icons.merge_type),
                  label: const Text('Fusionner'),
                  onPressed: () async {
                    await ref
                        .read(contactsControllerProvider.notifier)
                        .confirmMerge(group);
                    if (context.mounted) Navigator.pop(context);
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConfidenceBanner extends StatelessWidget {
  const _ConfidenceBanner({required this.group});
  final DuplicateGroup group;

  @override
  Widget build(BuildContext context) {
    final color = switch (group.confidence) {
      MatchConfidence.high => Colors.green,
      MatchConfidence.medium => Colors.orange,
      MatchConfidence.low => Colors.grey,
    };
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, color: color, size: 18),
              const SizedBox(width: 8),
              Text('Confiance : ${group.confidence.label}',
                  style: TextStyle(color: color, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 6),
          for (final reason in group.reasons)
            Text('• $reason', style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _PreviewCard extends StatelessWidget {
  const _PreviewCard({required this.record});
  final ContactRecord record;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(record.effectiveName,
                style: Theme.of(context).textTheme.titleMedium),
            if (record.company.isNotEmpty) Text(record.company),
            const Divider(),
            for (final p in record.phones)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.phone, size: 18),
                title: Text(p.raw),
                subtitle: Text(p.label.display),
                trailing: SourceChip(p.source),
              ),
            for (final e in record.emails)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.email, size: 18),
                title: Text(e.raw),
                trailing: SourceChip(e.source),
              ),
          ],
        ),
      ),
    );
  }
}

class _OriginCard extends StatelessWidget {
  const _OriginCard({required this.record});
  final ContactRecord record;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(record.effectiveName)),
                SourceChip(record.source),
              ],
            ),
            for (final p in record.phones)
              Text('${p.label.display} : ${p.raw}',
                  style: Theme.of(context).textTheme.bodySmall),
            for (final e in record.emails)
              Text(e.raw, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
