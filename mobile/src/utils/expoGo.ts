import Constants from 'expo-constants';

/** Expo Go cannot load expo-notifications (SDK 53+) or background fetch. */
export const isExpoGo = Constants.appOwnership === 'expo';
