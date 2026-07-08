import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'contacts_list_screen.dart';
import 'duplicates_screen.dart';

/// Écran principal : onglets Contacts / Doublons + resynchronisation.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(contactsControllerProvider);
    final pending = state.valueOrNull?.pendingCount ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contacts intelligents'),
        actions: [
          IconButton(
            tooltip: 'Resynchroniser les sources',
            icon: const Icon(Icons.sync),
            onPressed: () =>
                ref.read(contactsControllerProvider.notifier).resync(),
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          ContactsListScreen(),
          DuplicatesScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.contacts_outlined),
            selectedIcon: Icon(Icons.contacts),
            label: 'Contacts',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: pending > 0,
              label: Text('$pending'),
              child: const Icon(Icons.merge_type_outlined),
            ),
            selectedIcon: const Icon(Icons.merge_type),
            label: 'Doublons',
          ),
        ],
      ),
    );
  }
}
