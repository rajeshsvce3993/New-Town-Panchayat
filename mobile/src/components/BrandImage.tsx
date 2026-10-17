import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOCAL_ICON = require('../../assets/app_icon.png');
const LOCAL_LOGO = require('../../assets/app_logo.png');

export function isUsableLogoUrl(url?: string | null): url is string {
  if (!url?.trim()) return false;
  if (url.includes('v=default')) return false;
  if (url.includes('upload.wikimedia.org')) return false;
  return /^https?:\/\//i.test(url);
}

export function BrandImage({
  kind,
  style,
}: {
  uri?: string | null;
  kind: 'icon' | 'logo';
  style: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={kind === 'logo' ? LOCAL_LOGO : LOCAL_ICON}
      style={style}
      resizeMode="contain"
    />
  );
}
