import { useMemo } from 'react';
import {
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ContextEngine,
  type PhoneLabel,
  type Suggestion,
} from 'contxt-domain';
import { buildSampleSnapshot } from '../data/sampleSnapshot';

const engine = new ContextEngine();

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
export function NowScreen(): React.JSX.Element {
  // MVP : instantané de démonstration + horloge locale. À remplacer par la
  // couche data réelle (contacts + agenda) via un store/contexte.
  const suggestions = useMemo(
    () => engine.rank(buildSampleSnapshot(new Date())),
    [],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Maintenant</Text>
      <FlatList
        data={suggestions}
        keyExtractor={(s) => s.contact.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <SuggestionRow suggestion={item} />}
      />
    </View>
  );
}

function SuggestionRow({
  suggestion,
}: {
  suggestion: Suggestion;
}): React.JSX.Element {
  const { contact, bestNumber, reasons } = suggestion;

  const call = () => {
    // Déclenche l'appel natif. Un vrai enregistrement CallEvent (pour
    // l'apprentissage, phase 2) sera ajouté avec la couche data.
    void Linking.openURL(`tel:${bestNumber.e164}`);
  };

  return (
    <TouchableOpacity style={styles.row} onPress={call} accessibilityRole="button">
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
      <Text style={styles.callIcon}>📞</Text>
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
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 64 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingBottom: 16,
    color: '#1a1a2e',
  },
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
