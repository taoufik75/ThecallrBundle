import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type PhoneLabel, type Suggestion } from 'contxt-domain';
import type { NowData } from '../data/useNowData';
import { styles as shared } from './styles';

const LABEL_FR: Record<PhoneLabel, string> = {
  mobilePerso: 'mobile perso',
  mobilePro: 'mobile pro',
  fixeBureau: 'fixe bureau',
  domicile: 'domicile',
  autre: 'autre',
};

/**
 * Écran signature « Maintenant » : la liste des contacts/numéros suggérés par
 * le moteur selon le contexte courant. Un appui appelle le bon numéro.
 */
export function NowScreen({
  data,
  loading,
  onOpen,
}: {
  data: NowData | null;
  loading: boolean;
  onOpen: (contactId: string) => void;
}): React.JSX.Element {
  if (loading || !data) {
    return (
      <View style={[shared.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#3A6EA5" />
        <Text style={styles.loadingText}>Analyse du contexte…</Text>
      </View>
    );
  }

  return (
    <View style={shared.screen}>
      {data.usingSample && (
        <Text style={styles.sampleBanner}>
          Données de démonstration — autorisez l'accès aux contacts pour vos vrais contacts.
        </Text>
      )}
      <FlatList
        data={data.suggestions}
        keyExtractor={(s) => s.contact.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <SuggestionRow suggestion={item} onOpen={onOpen} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune suggestion pour le moment.</Text>
        }
      />
    </View>
  );
}

function SuggestionRow({
  suggestion,
  onOpen,
}: {
  suggestion: Suggestion;
  onOpen: (contactId: string) => void;
}): React.JSX.Element {
  const { contact, bestNumber, reasons } = suggestion;

  const call = () => {
    // Déclenche l'appel natif. Un enregistrement CallEvent (apprentissage,
    // phase 2) sera ajouté avec l'historique.
    void Linking.openURL(`tel:${bestNumber.e164}`);
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(contact.id)}
      accessibilityRole="button"
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(contact.displayName)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>
          {contact.isFavoritePinned ? '📌 ' : ''}
          {contact.displayName}
        </Text>
        <Text style={styles.number}>
          {bestNumber.e164} · {LABEL_FR[bestNumber.label]}
        </Text>
        {reasons.length > 0 && (
          <Text style={styles.reasons}>{reasons.join(' · ')}</Text>
        )}
      </View>
      <TouchableOpacity onPress={call} accessibilityRole="button" accessibilityLabel="Appeler">
        <Text style={styles.callIcon}>📞</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#555' },
  sampleBanner: {
    backgroundColor: '#FFF4E5',
    color: '#8a5a00',
    fontSize: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  separator: { height: 1, backgroundColor: '#eee', marginLeft: 76 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3A6EA5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '600' },
  body: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a2e' },
  number: { fontSize: 14, color: '#555', marginTop: 2 },
  reasons: { fontSize: 12, color: '#3A6EA5', marginTop: 2 },
  callIcon: { fontSize: 22, paddingLeft: 8 },
});
