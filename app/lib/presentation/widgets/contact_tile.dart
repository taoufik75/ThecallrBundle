import 'package:flutter/material.dart';

import '../../domain/entities/contact_record.dart';
import 'source_chip.dart';

/// Ligne de liste pour un contact canonique.
class ContactTile extends StatelessWidget {
  const ContactTile(this.contact, {super.key, this.onTap});

  final ContactRecord contact;
  final VoidCallback? onTap;

  String get _initials {
    final name = contact.effectiveName.trim();
    if (name.isEmpty) return '?';
    final parts = name.split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final primaryPhone = contact.phones.isNotEmpty
        ? (contact.phones.firstWhere(
            (p) => p.isValid,
            orElse: () => contact.phones.first,
          ))
        : null;

    return ListTile(
      onTap: onTap,
      leading: CircleAvatar(child: Text(_initials)),
      title: Row(
        children: [
          Flexible(child: Text(contact.effectiveName)),
          if (contact.isMerged) ...[
            const SizedBox(width: 6),
            const Icon(Icons.merge_type, size: 16, color: Colors.teal),
          ],
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (primaryPhone != null) Text(primaryPhone.raw),
          if (contact.company.isNotEmpty)
            Text(
              contact.company,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            children: [
              for (final s in contact.sources) SourceChip(s),
            ],
          ),
        ],
      ),
      isThreeLine: true,
    );
  }
}
