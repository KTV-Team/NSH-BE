import { Platform } from 'react-native';

// Override for a physical device with the API machine's LAN address.
export const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:4000/api/v1`;
