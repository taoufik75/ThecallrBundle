import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNowData } from './src/data/useNowData';
import { NowScreen } from './src/ui/NowScreen';
import { DedupeScreen } from './src/ui/DedupeScreen';

type Tab = 'now' | 'dedupe';

export default function App() {
  const { data, loading } = useNowData();
  const [tab, setTab] = useState<Tab>('now');
  const dupCount = data?.reviewSuggestions.length ?? 0;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Contxt</Text>

      <View style={styles.tabs}>
        <TabButton label="Maintenant" active={tab === 'now'} onPress={() => setTab('now')} />
        <TabButton
          label={dupCount > 0 ? `Doublons (${dupCount})` : 'Doublons'}
          active={tab === 'dedupe'}
          onPress={() => setTab('dedupe')}
        />
      </View>

      {tab === 'now' ? (
        <NowScreen data={data} loading={loading} />
      ) : (
        <DedupeScreen groups={data?.reviewSuggestions ?? []} />
      )}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f0f3' },
  tabActive: { backgroundColor: '#3A6EA5' },
  tabText: { color: '#555', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
});
