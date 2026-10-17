import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppPalette } from '../theme/palettes';

export function PhotoSourceDialog({
  visible,
  isTamil,
  palette,
  onCamera,
  onGallery,
  onClose,
}: {
  visible: boolean;
  isTamil: boolean;
  palette: AppPalette;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.card}>
          <Ionicons name="camera" size={36} color={palette.primary} />
          <Text style={styles.title}>{isTamil ? 'சுயவிவரப் படம் மாற்றுக' : 'Change Profile Photo'}</Text>
          <Text style={styles.sub}>
            {isTamil
              ? 'புகைப்படம் AWS S3-ல் உங்கள் பயனர் ID கோப்புறையில் தானாகச் சேமிக்கப்படும்.'
              : 'Photo will be saved in AWS S3 under your user ID folder.'}
          </Text>
          <Pressable style={[styles.btn, { backgroundColor: palette.primary }]} onPress={onCamera}>
            <Text style={styles.btnText}>{isTamil ? 'கேமரா மூலம் படம் எடுக்க' : 'Take Photo with Camera'}</Text>
          </Pressable>
          <Pressable style={styles.outline} onPress={onGallery}>
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>
              {isTamil ? 'கேலரியில் இருந்து தேர்ந்தெடுக்க' : 'Choose from Gallery'}
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  title: { fontWeight: '700', fontSize: 16, marginTop: 8 },
  sub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginVertical: 10 },
  btn: { alignSelf: 'stretch', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700' },
  outline: { alignSelf: 'stretch', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0' },
});
