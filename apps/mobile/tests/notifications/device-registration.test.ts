import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@nexa/api-client';
import * as Notifications from 'expo-notifications';
import {
  addDevicePushTokenListener,
  isExpoGo,
  registerDevice,
} from '../../src/notifications/device-registration';

const expoGoConstants = vi.hoisted(() => ({
  appOwnership: 'expo',
  AppOwnership: { Expo: 'expo' },
}));

vi.mock('expo-constants', () => ({ default: expoGoConstants }));
vi.mock('expo-crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  addPushTokenListener: vi.fn(),
  IosAuthorizationStatus: { PROVISIONAL: 'provisional' },
  PermissionStatus: { DENIED: 'denied' },
  AndroidImportance: { HIGH: 4 },
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('device registration', () => {
  it('does not call unsupported remote-push APIs in Expo Go', async () => {
    const api = createApiClient({ baseUrl: 'https://api.example' });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    expect(isExpoGo()).toBe(true);
    expect(addDevicePushTokenListener(vi.fn())).toBeNull();
    await expect(registerDevice(api, true)).resolves.toEqual({
      permissionStatus: 'undetermined',
      registered: false,
      error: 'Expo Go không hỗ trợ push từ xa. Hãy cài development build để kiểm thử push.',
    });
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(Notifications.addPushTokenListener).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
