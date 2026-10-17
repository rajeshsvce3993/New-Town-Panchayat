import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FormPickerOption = { id: string; label: string };

export type FormPickerState = {
  title: string;
  value: string;
  options: FormPickerOption[];
  onPick: (id: string) => void;
} | null;

const BORDER = '#D0D5DD';
const LABEL = '#344054';
const PLACEHOLDER = '#98A2B3';
const TEXT = '#101828';

function withAlpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  return `#${h}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

export function formSelectBorder(primary: string) {
  return withAlpha(primary, 0.42);
}

type FieldProps = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function FormFieldLabel({ label, style }: FieldProps) {
  return <Text style={[styles.label, style]}>{label}</Text>;
}

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  primary: string;
};

export function FormTextField({ label, value, onChangeText, placeholder, keyboardType, primary }: TextFieldProps) {
  const themeBorder = formSelectBorder(primary);
  return (
    <View style={styles.block}>
      <FormFieldLabel label={label} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={PLACEHOLDER}
        style={[styles.textInput, { borderColor: themeBorder, backgroundColor: '#FFFFFF' }]}
      />
    </View>
  );
}

type SelectTriggerProps = {
  label: string;
  display: string;
  placeholder: string;
  primary: string;
  onPress: () => void;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
};

export function FormSelectTrigger({
  label,
  display,
  placeholder,
  primary,
  onPress,
  trailingIcon = 'chevron-down',
}: SelectTriggerProps) {
  const hasValue = !!display;
  const themeBorder = formSelectBorder(primary);
  const themeSoft = withAlpha(primary, 0.1);
  return (
    <View style={styles.block}>
      <FormFieldLabel label={label} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.selectTrigger,
          { backgroundColor: '#FFFFFF', borderColor: themeBorder },
          pressed && { backgroundColor: withAlpha(primary, 0.04) },
        ]}
      >
        <Text style={[styles.selectText, !hasValue && styles.selectPlaceholder]} numberOfLines={2}>
          {hasValue ? display : placeholder}
        </Text>
        <View style={[styles.selectIconWrap, { backgroundColor: themeSoft }]}>
          <Ionicons name={trailingIcon} size={17} color={primary} />
        </View>
      </Pressable>
    </View>
  );
}

type PhotoFieldProps = {
  label: string;
  uri: string | null;
  primary: string;
  onPress: () => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  capturedBadge?: string;
  retakeLabel?: string;
  ctaLabel?: string;
};

export function FormPhotoField({
  label,
  uri,
  primary,
  onPress,
  emptyTitle = 'Take photo',
  emptySubtitle = 'Capture a clear picture for this inspection',
  capturedBadge = 'Photo added',
  retakeLabel = 'Retake',
  ctaLabel = 'Open camera',
}: PhotoFieldProps) {
  const themeBorder = formSelectBorder(primary);
  const themeSoft = withAlpha(primary, 0.12);
  const themeRing = withAlpha(primary, 0.28);

  return (
    <View style={styles.block}>
      <View style={styles.photoLabelRow}>
        <FormFieldLabel label={label} style={styles.photoLabelText} />
        <View style={[styles.photoLabelTag, { backgroundColor: themeSoft }]}>
          <Ionicons name="camera" size={11} color={primary} />
          <Text style={[styles.photoLabelTagText, { color: primary }]}>PHOTO</Text>
        </View>
      </View>
      {uri ? (
        <View style={[styles.photoCaptureCard, { borderColor: themeBorder }]}>
          <Image source={{ uri }} style={styles.photoPreviewImage} resizeMode="cover" />
          <View style={styles.photoPreviewFooter}>
            <View style={styles.photoPreviewBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.photoPreviewBadgeText}>{capturedBadge}</Text>
            </View>
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [
                styles.photoPreviewRetake,
                { borderColor: themeBorder },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Ionicons name="camera-reverse" size={14} color={primary} />
              <Text style={[styles.photoPreviewRetakeText, { color: primary }]}>{retakeLabel}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.photoCaptureCard,
            { borderColor: themeBorder },
            pressed && { transform: [{ scale: 0.992 }] },
          ]}
        >
          <LinearGradient
            colors={[withAlpha(primary, 0.16), withAlpha(primary, 0.06), '#FFFFFF']}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.photoEmptyGradient}
          >
            <View style={[styles.photoCorner, styles.photoCornerTL, { borderColor: themeRing }]} />
            <View style={[styles.photoCorner, styles.photoCornerTR, { borderColor: themeRing }]} />
            <View style={[styles.photoOrbitRing, { borderColor: themeRing }]}>
              <View style={[styles.photoOrbitCore, { shadowColor: primary }]}>
                <LinearGradient
                  colors={['#FFFFFF', withAlpha(primary, 0.08)]}
                  style={styles.photoOrbitGradient}
                >
                  <Ionicons name="camera" size={18} color={primary} />
                </LinearGradient>
              </View>
            </View>
            <Text style={styles.photoEmptyTitle} numberOfLines={1}>
              {emptyTitle}
            </Text>
            <Text style={styles.photoEmptySubtitle} numberOfLines={1}>
              {emptySubtitle}
            </Text>
            <View style={[styles.photoCta, { backgroundColor: primary }]}>
              <Ionicons name="aperture-outline" size={14} color="#fff" />
              <Text style={styles.photoCtaText}>{ctaLabel}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

type PickerSheetProps = {
  picker: FormPickerState;
  primary: string;
  onClose: () => void;
  closeLabel?: string;
};

export function FormPickerSheet({ picker, primary, onClose, closeLabel = 'Close' }: PickerSheetProps) {
  const insets = useSafeAreaInsets();
  if (!picker) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityRole="button" />
        <View
          style={[
            styles.sheetPanel,
            { paddingBottom: Math.max(insets.bottom, 16), borderTopColor: formSelectBorder(primary) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {picker.title}
          </Text>
          <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled" bounces={false}>
            {picker.options.map((o, idx) => {
              const selected = o.id === picker.value;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => {
                    picker.onPick(o.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.sheetRow,
                    idx < picker.options.length - 1 && styles.sheetRowBorder,
                    selected && { backgroundColor: withAlpha(primary, 0.06) },
                    pressed && !selected && { backgroundColor: '#FAFAFA' },
                  ]}
                >
                  <Text style={[styles.sheetRowText, selected && { color: primary, fontWeight: '700' }]}>{o.label}</Text>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={22}
                    color={selected ? primary : '#D0D5DD'}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable onPress={onClose} style={[styles.sheetCancel, { borderColor: formSelectBorder(primary) }]}>
            <Text style={[styles.sheetCancelText, { color: primary }]}>{closeLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: LABEL,
    marginBottom: 6,
    lineHeight: 16,
  },
  textInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT,
  },
  selectTrigger: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
  },
  selectText: {
    flex: 1,
    paddingVertical: 6,
    paddingRight: 8,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT,
  },
  selectPlaceholder: { color: PLACEHOLDER, fontWeight: '400' },
  selectIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(16, 24, 40, 0.52)' },
  sheetPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 2,
    maxHeight: '72%',
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E7EC',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  sheetRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  sheetRowText: { flex: 1, fontSize: 15, color: '#475467', fontWeight: '500' },
  sheetCancel: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600', color: LABEL },
  photoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  photoLabelText: { marginBottom: 0, flex: 1 },
  photoLabelTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 20,
  },
  photoLabelTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  photoCaptureCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  photoEmptyGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 98,
  },
  photoCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#CBD5E1',
  },
  photoCornerTL: { top: 7, left: 7, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  photoCornerTR: { top: 7, right: 7, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
  photoOrbitRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  photoOrbitCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  photoOrbitGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoEmptyTitle: { fontSize: 13, fontWeight: '800', color: TEXT, textAlign: 'center', alignSelf: 'stretch' },
  photoEmptySubtitle: {
    fontSize: 11,
    color: '#667085',
    marginTop: 2,
    lineHeight: 14,
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  photoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  photoCtaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  photoPreviewImage: { width: '100%', height: 84, backgroundColor: '#F1F5F9' },
  photoPreviewFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 5,
    backgroundColor: '#FAFAFA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EAECF0',
  },
  photoPreviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,150,105,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
  },
  photoPreviewBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  photoPreviewRetake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  photoPreviewRetakeText: { fontSize: 11, fontWeight: '700' },
});
