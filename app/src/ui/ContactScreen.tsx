import {
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  type Availability,
  type Contact,
  type ContactOverride,
  type PhoneLabel,
  type PhoneNumber,
  type PhoneOverride,
  type Sphere,
} from 'contxt-domain';
import { styles as shared } from './styles';

/** Fenêtres de disponibilité prêtes à l'emploi (toutes « préférées »). */
const AVAILABILITY_PRESETS: { key: string; fr: string; window: Availability }[] = [
  {
    key: 'bureau',
    fr: 'Bureau (lun–ven 9h–18h)',
    window: { daysOfWeek: [1, 2, 3, 4, 5], startMinute: 540, endMinute: 1080, kind: 'preferred' },
  },
  {
    key: 'soiree',
    fr: 'Soirée (tous les jours 18h–22h)',
    window: { daysOfWeek: [1, 2, 3, 4, 5, 6, 7], startMinute: 1080, endMinute: 1320, kind: 'preferred' },
  },
  {
    key: 'weekend',
    fr: 'Week-end (sam–dim 10h–20h)',
    window: { daysOfWeek: [6, 7], startMinute: 600, endMinute: 1200, kind: 'preferred' },
  },
];

function sameWindow(a: Availability, b: Availability): boolean {
  return (
    a.kind === b.kind &&
    a.startMinute === b.startMinute &&
    a.endMinute === b.endMinute &&
    a.daysOfWeek.length === b.daysOfWeek.length &&
    [...a.daysOfWeek].sort().join(',') === [...b.daysOfWeek].sort().join(',')
  );
}

const LABELS: { key: PhoneLabel; fr: string }[] = [
  { key: 'mobilePerso', fr: 'Mobile perso' },
  { key: 'mobilePro', fr: 'Mobile pro' },
  { key: 'fixeBureau', fr: 'Fixe bureau' },
  { key: 'domicile', fr: 'Domicile' },
  { key: 'autre', fr: 'Autre' },
];

const SPHERES: { key: Sphere; fr: string }[] = [
  { key: 'perso', fr: 'Perso' },
  { key: 'pro', fr: 'Pro' },
];

/**
 * Fiche contact éditable. Chaque édition est persistée (overrides) et « repeinte »
 * sur les contacts à chaque chargement — elle survit donc aux ré-imports et
 * pilote directement le scoring du moteur.
 */
export function ContactScreen({
  contact,
  onBack,
  onEditContact,
  onEditPhone,
}: {
  contact: Contact;
  onBack: () => void;
  onEditContact: (contactId: string, patch: ContactOverride) => void;
  onEditPhone: (contactId: string, e164: string, patch: PhoneOverride) => void;
}): React.JSX.Element {
  return (
    <View style={shared.screen}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button">
          <Text style={styles.back}>‹ Retour</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.name}>{contact.displayName}</Text>

        <View style={styles.pinRow}>
          <Text style={styles.pinLabel}>📌 Favori épinglé</Text>
          <Switch
            value={contact.isFavoritePinned}
            onValueChange={(v) =>
              onEditContact(contact.id, { isFavoritePinned: v })
            }
          />
        </View>

        {contact.phoneNumbers.map((n) => (
          <PhoneCard
            key={n.e164}
            contactId={contact.id}
            phone={n}
            onEditPhone={onEditPhone}
          />
        ))}
        {contact.phoneNumbers.length === 0 && (
          <Text style={styles.empty}>Aucun numéro.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function PhoneCard({
  contactId,
  phone,
  onEditPhone,
}: {
  contactId: string;
  phone: PhoneNumber;
  onEditPhone: (contactId: string, e164: string, patch: PhoneOverride) => void;
}): React.JSX.Element {
  const edit = (patch: PhoneOverride) => onEditPhone(contactId, phone.e164, patch);
  const isRetired = phone.status === 'retired';
  const isPreferred = phone.priority > 0;

  return (
    <View style={[styles.card, isRetired && styles.cardRetired]}>
      <View style={styles.cardHeader}>
        <Text style={styles.e164}>{phone.e164}</Text>
        <TouchableOpacity onPress={() => void Linking.openURL(`tel:${phone.e164}`)}>
          <Text style={styles.callIcon}>📞</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Type</Text>
      <View style={styles.chips}>
        {LABELS.map((l) => (
          <Chip
            key={l.key}
            label={l.fr}
            active={phone.label === l.key}
            onPress={() => edit({ label: l.key })}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Sphère</Text>
      <View style={styles.chips}>
        {SPHERES.map((s) => (
          <Chip
            key={s.key}
            label={s.fr}
            active={phone.sphere === s.key}
            onPress={() => edit({ sphere: s.key })}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Disponibilité</Text>
      <View style={styles.chips}>
        {AVAILABILITY_PRESETS.map((preset) => {
          const active = phone.availabilities.some((a) => sameWindow(a, preset.window));
          return (
            <Chip
              key={preset.key}
              label={preset.fr}
              active={active}
              onPress={() => {
                const next = active
                  ? phone.availabilities.filter((a) => !sameWindow(a, preset.window))
                  : [...phone.availabilities, preset.window];
                edit({ availabilities: next });
              }}
            />
          );
        })}
      </View>

      <View style={styles.actionsRow}>
        <Chip
          label={isPreferred ? '★ Préféré' : '☆ Préféré'}
          active={isPreferred}
          onPress={() => edit({ priority: isPreferred ? 0 : 3 })}
        />
        {isRetired ? (
          <Chip label="Réactiver" active={false} onPress={() => edit({ status: 'active' })} />
        ) : (
          <Chip
            label="Signaler périmé"
            active={false}
            danger
            onPress={() => edit({ status: 'retired' })}
          />
        )}
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  danger,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  danger?: boolean;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, danger && styles.chipDanger]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          danger && styles.chipTextDanger,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topbar: { paddingHorizontal: 16, paddingVertical: 8 },
  back: { color: '#3A6EA5', fontSize: 16, fontWeight: '600' },
  content: { padding: 20, gap: 16 },
  name: { fontSize: 24, fontWeight: '700', color: '#1a1a2e' },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pinLabel: { fontSize: 16, color: '#1a1a2e' },
  empty: { color: '#888' },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardRetired: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  e164: { fontSize: 17, fontWeight: '600', color: '#1a1a2e' },
  callIcon: { fontSize: 20 },
  fieldLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f3',
  },
  chipActive: { backgroundColor: '#3A6EA5' },
  chipDanger: { backgroundColor: '#fdecec' },
  chipText: { color: '#555', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  chipTextDanger: { color: '#c0392b' },
});
