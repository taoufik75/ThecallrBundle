import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MatchReason, MergeGroup } from 'contxt-domain';
import { styles as shared } from './styles';

const REASON_FR: Record<MatchReason, string> = {
  samePhone: 'même numéro',
  sameEmail: 'même e-mail',
  similarName: 'nom proche',
};

/**
 * Écran de revue des doublons : liste les groupes que le `DedupeService` a
 * détectés mais **pas** fusionnés automatiquement (confiance basse). L'utilisateur
 * confirme ou ignore chaque fusion.
 */
export function DedupeScreen({
  groups,
  onMerge,
  onDismiss,
}: {
  groups: MergeGroup[];
  onMerge: (group: MergeGroup) => void;
  onDismiss: (group: MergeGroup) => void;
}): React.JSX.Element {
  return (
    <View style={shared.screen}>
      <Text style={styles.header}>Doublons à vérifier</Text>
      <FlatList
        data={groups}
        keyExtractor={(g) => g.members.map((m) => m.sourceId).join('|')}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <GroupCard group={item} onMerge={onMerge} onDismiss={onDismiss} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aucun doublon à vérifier. Les fusions évidentes (même numéro ou
            e-mail) ont déjà été appliquées automatiquement.
          </Text>
        }
      />
    </View>
  );
}

function GroupCard({
  group,
  onMerge,
  onDismiss,
}: {
  group: MergeGroup;
  onMerge: (group: MergeGroup) => void;
  onDismiss: (group: MergeGroup) => void;
}): React.JSX.Element {
  const reasons = [...group.reasons].map((r) => REASON_FR[r]).join(', ');
  const names = group.members.map((m) => m.displayName).join(', ');

  const confirmMerge = () => {
    Alert.alert('Fusionner ces fiches ?', names, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Fusionner', onPress: () => onMerge(group) },
    ]);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Même personne ?</Text>
      {group.members.map((m) => (
        <Text key={m.sourceId} style={styles.member}>
          • {m.displayName}
        </Text>
      ))}
      <Text style={styles.why}>Indice : {reasons}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.mergeBtn} onPress={confirmMerge}>
          <Text style={styles.mergeBtnText}>Fusionner</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ignoreBtn} onPress={() => onDismiss(group)}>
          <Text style={styles.ignoreBtnText}>Ignorer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  separator: { height: 8 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, paddingHorizontal: 24 },
  card: { paddingHorizontal: 20, paddingVertical: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a2e', marginBottom: 6 },
  member: { fontSize: 15, color: '#333', marginVertical: 1 },
  why: { fontSize: 12, color: '#3A6EA5', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  mergeBtn: {
    backgroundColor: '#3A6EA5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mergeBtnText: { color: '#fff', fontWeight: '600' },
  ignoreBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  ignoreBtnText: { color: '#555', fontWeight: '600' },
});
