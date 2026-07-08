import 'package:context_contacts/presentation/app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('l\'app démarre, synchronise la démo et affiche des contacts',
      (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: ContextContactsApp()),
    );

    // Premier frame : indicateur de chargement pendant la synchro.
    expect(find.byType(CircularProgressIndicator), findsWidgets);

    // Laisse la synchronisation asynchrone se terminer.
    await tester.pumpAndSettle();

    // La barre de titre et la navigation sont présentes.
    expect(find.text('Contacts intelligents'), findsOneWidget);
    expect(find.text('Contacts'), findsWidgets);
    expect(find.text('Doublons'), findsWidgets);

    // Au moins un contact de démo est visible (Jean Dupont fusionné).
    expect(find.textContaining('Jean'), findsWidgets);
  });
}
