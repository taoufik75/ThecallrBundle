import 'package:flutter/material.dart';

import '../../domain/entities/contact_source.dart';

/// Petite pastille colorée indiquant une source (Téléphone, Google, iCloud…).
class SourceChip extends StatelessWidget {
  const SourceChip(this.source, {super.key});

  final ContactSource source;

  Color _color() {
    switch (source) {
      case ContactSource.manual:
        return Colors.teal;
      case ContactSource.device:
        return Colors.indigo;
      case ContactSource.google:
        return Colors.red;
      case ContactSource.icloud:
        return Colors.blueGrey;
      case ContactSource.exchange:
        return Colors.orange;
      case ContactSource.enrichment:
        return Colors.purple;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _color();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: c.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.withOpacity(0.4)),
      ),
      child: Text(
        source.label,
        style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}
