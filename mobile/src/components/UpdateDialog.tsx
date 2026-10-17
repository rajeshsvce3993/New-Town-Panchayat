import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';

export function UpdateDialog() {
  const { updateDialog, isTamil, palette } = useApp();
  if (!updateDialog.visible) return null;
  const force = updateDialog.force;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={force ? undefined : updateDialog.dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name={force ? 'warning' : 'cloud-download'} size={36} color={force ? '#DC2626' : palette.primary} />
          <Text style={styles.title}>
            {force
              ? isTamil
                ? 'முக்கியப் புதுப்பிப்பு தேவை!'
                : 'Mandatory Update Required!'
              : isTamil
                ? 'புதிய பதிப்பு கிடைக்கிறது!'
                : 'New Update Available!'}
          </Text>
          <View style={[styles.badge, { backgroundColor: force ? '#FEE2E2' : palette.primaryContainer }]}>
            <Text style={{ color: force ? '#DC2626' : palette.primary, fontWeight: '700', fontSize: 11 }}>
              v{updateDialog.versionName}
            </Text>
          </View>
          <Text style={styles.body}>
            {force
              ? isTamil
                ? 'செயலியின் புதிய பதிப்பு வெளியிடப்பட்டுள்ளது. முக்கியமான பாதுகாப்பு மற்றும் டேட்டாபேஸ் மாற்றங்கள் செய்யப்பட்டுள்ளதால், செயலியைத் தொடர்ந்து பயன்படுத்த இப்போதே புதுப்பிக்க வேண்டும்.'
                : 'A mandatory app update is required. Critical updates and database synchronization improvements must be installed before you can continue.'
              : isTamil
                ? 'Town Panchayat EMS செயலியின் புதிய பதிப்பு வெளியிடப்பட்டுள்ளது. புதிய ஆஃப்லைன் வசதிகள் மற்றும் மேம்பாடுகள் சேர்க்கப்பட்டுள்ளன.'
                : 'A new version of Town Panchayat EMS is available with new offline features and performance improvements.'}
          </Text>
          {!!updateDialog.notes && (
            <ScrollView style={styles.notes}>
              <Text style={{ fontWeight: '700', fontSize: 11, color: '#0F172A' }}>
                {isTamil ? 'மாற்றங்கள் (Release Notes):' : 'Release Notes:'}
              </Text>
              <Text style={{ fontSize: 11, color: '#64748B' }}>{updateDialog.notes}</Text>
            </ScrollView>
          )}
          <Pressable style={[styles.btn, { backgroundColor: palette.primary }]} onPress={updateDialog.updateNow}>
            <Text style={styles.btnText}>{isTamil ? 'இப்போதே புதுப்பிக்கவும் (Update Now)' : 'Update Now'}</Text>
          </Pressable>
          {!force && (
            <Pressable onPress={updateDialog.dismiss} style={{ padding: 10 }}>
              <Text style={{ color: '#64748B', textAlign: 'center' }}>
                {isTamil ? 'பின்னர் புதுப்பிக்கவும் (Update Later)' : 'Update Later'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' },
  title: { fontWeight: '800', fontSize: 17, color: '#0F172A', textAlign: 'center', marginTop: 8 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginVertical: 8 },
  body: { fontSize: 13, color: '#334155', lineHeight: 18, textAlign: 'center' },
  notes: { maxHeight: 120, alignSelf: 'stretch', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginTop: 10 },
  btn: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
