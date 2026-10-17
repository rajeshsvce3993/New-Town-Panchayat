import { StyleSheet, View } from 'react-native';
import { BrandImage } from './BrandImage';

export function HeaderBrand() {
  return (
    <View style={styles.plate}>
      <BrandImage kind="icon" style={styles.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 38, height: 38 },
});
