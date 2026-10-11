import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import type { InboxEventKind, InboxRealtimeEvent, PushPermissionStatus } from '@nexa/types';
import { apiUrl } from '@/config/env';
import { useAuth } from '@/features/auth/auth-provider';
import { addDevicePushTokenListener, registerDevice, remotePushIsAvailable } from './device-registration';

const pendingTapKey = 'nexa.push.pending-item-id';
const itemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventKinds = new Set<InboxEventKind>(['created', 'updated', 'deleted', 'resync']);

interface NotificationRuntimeValue {
  revision: number;
  permissionStatus: PushPermissionStatus;
  remotePushAvailable: boolean;
  registrationError: string | null;
  pendingTapItemId: string | null;
  lastEvent: InboxRealtimeEvent | null;
  requestPermission(): Promise<void>;
  openSystemSettings(): Promise<void>;
  clearPendingTap(): Promise<void>;
}

const NotificationRuntimeContext = createContext<NotificationRuntimeValue | null>(null);

function webSocketUrl(): string {
  const parsed = new URL(apiUrl);
  if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
  else if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
  else throw new Error('Unsupported API URL protocol.');
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/inbox/events`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function eventFromMessage(value: unknown): InboxRealtimeEvent | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record['eventId'] !== 'string' || !itemIdPattern.test(record['eventId'])) return null;
    if (typeof record['kind'] !== 'string' || !eventKinds.has(record['kind'] as InboxEventKind)) return null;
    const itemId = record['itemId'];
    return {
      eventId: record['eventId'],
      kind: record['kind'] as InboxEventKind,
      ...(typeof itemId === 'string' && itemIdPattern.test(itemId) ? { itemId } : {}),
    };
  } catch {
    return null;
  }
}

function tappedItemId(response: Notifications.NotificationResponse): string | null {
  const data: unknown = response.notification.request.content.data;
  if (!data || typeof data !== 'object') return null;
  const itemId = (data as Record<string, unknown>)['itemId'];
  return typeof itemId === 'string' && itemIdPattern.test(itemId) ? itemId : null;
}

export function NotificationRuntimeProvider({ children }: PropsWithChildren) {
  const { api, session, loading, getAccessToken } = useAuth();
  const sessionUserId = session?.user.id;
  const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
  const remotePushAvailable = remotePushIsAvailable();
  const [revision, setRevision] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('undetermined');
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [pendingTapItemId, setPendingTapItemId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<InboxRealtimeEvent | null>(null);
  const deliveredEvents = useRef(new Set<string>());
  const lastOpened = useRef<string | null>(null);

  const noteInboxChange = useCallback((event?: InboxRealtimeEvent) => {
    if (event) {
      if (deliveredEvents.current.has(event.eventId)) return;
      deliveredEvents.current.add(event.eventId);
      if (deliveredEvents.current.size > 200) {
        const oldest = deliveredEvents.current.values().next().value;
        if (oldest) deliveredEvents.current.delete(oldest);
      }
      setLastEvent(event);
    }
    setRevision((current) => current + 1);
  }, []);

  const acceptTap = useCallback(async (itemId: string | null) => {
    if (!itemId) return;
    setPendingTapItemId(itemId);
    await SecureStore.setItemAsync(pendingTapKey, itemId).catch(() => undefined);
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, []);

  const clearPendingTap = useCallback(async () => {
    setPendingTapItemId(null);
    lastOpened.current = null;
    await SecureStore.deleteItemAsync(pendingTapKey).catch(() => undefined);
    await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, []);

  const refreshDeviceRegistration = useCallback(async (requestPermission = false) => {
    if (!sessionUserId) return;
    try {
      const result = await registerDevice(api, requestPermission);
      setPermissionStatus(result.permissionStatus);
      setRegistrationError(result.error);
    } catch {
      setRegistrationError('Chưa thể đồng bộ quyền nhận thông báo. Hãy thử lại.');
    }
  }, [api, sessionUserId]);

  const requestPermission = useCallback(async () => {
    await refreshDeviceRegistration(true);
  }, [refreshDeviceRegistration]);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      setRegistrationError('Không thể mở cài đặt quyền thông báo của thiết bị.');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    let active = true;
    void SecureStore.getItemAsync(pendingTapKey).then((stored) => {
      if (active && stored && itemIdPattern.test(stored)) setPendingTapItemId(stored);
    }).catch(() => undefined);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) void acceptTap(tappedItemId(response));
    }).catch(() => undefined);

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const received = Notifications.addNotificationReceivedListener(() => noteInboxChange());
    const response = Notifications.addNotificationResponseReceivedListener((value) => {
      void acceptTap(tappedItemId(value));
    });
    return () => {
      active = false;
      received.remove();
      response.remove();
    };
  }, [acceptTap, noteInboxChange]);

  useEffect(() => {
    if (!isNative || !sessionUserId) return;
    let active = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempt = 0;
    let connectionVersion = 0;

    const scheduleReconnect = () => {
      if (!active || AppState.currentState !== 'active' || reconnectTimer) return;
      const delay = Math.min(30_000, 1000 * 2 ** retryAttempt);
      retryAttempt = Math.min(retryAttempt + 1, 5);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (!active || AppState.currentState !== 'active' || socket) return;
      const version = ++connectionVersion;
      let token: string | null;
      try {
        token = await getAccessToken();
      } catch {
        scheduleReconnect();
        return;
      }
      if (!active || version !== connectionVersion || !token) {
        if (!token) scheduleReconnect();
        return;
      }
      let nextSocket: WebSocket;
      try {
        nextSocket = new WebSocket(webSocketUrl());
      } catch {
        scheduleReconnect();
        return;
      }
      socket = nextSocket;
      nextSocket.onopen = () => {
        retryAttempt = 0;
        nextSocket.send(JSON.stringify({ event: 'authenticate', data: { accessToken: token } }));
      };
      nextSocket.onmessage = (message) => {
        const event = eventFromMessage(message.data);
        if (event) noteInboxChange(event);
      };
      nextSocket.onerror = () => nextSocket.close();
      nextSocket.onclose = () => {
        if (socket === nextSocket) socket = null;
        scheduleReconnect();
      };
    };

    const disconnect = () => {
      connectionVersion += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      const current = socket;
      socket = null;
      if (current) {
        current.onclose = null;
        current.onerror = null;
        current.onmessage = null;
        current.onopen = null;
        current.close();
      }
    };

    const onAppState = (state: string) => {
      if (state === 'active') {
        noteInboxChange();
        void refreshDeviceRegistration();
        void connect();
      } else {
        disconnect();
      }
    };

    void Promise.resolve().then(() => refreshDeviceRegistration());
    let pushTokenSubscription: Notifications.Subscription | null = null;
    if (remotePushAvailable) {
      try {
        pushTokenSubscription = addDevicePushTokenListener(() => {
          void refreshDeviceRegistration();
        });
      } catch {
        void Promise.resolve().then(() => {
          if (active) setRegistrationError('Chưa thể theo dõi thay đổi push token. Hãy thử khởi động lại ứng dụng.');
        });
      }
    }
    if (AppState.currentState === 'active') void connect();
    const appStateSubscription = AppState.addEventListener('change', onAppState);
    return () => {
      active = false;
      appStateSubscription.remove();
      pushTokenSubscription?.remove();
      disconnect();
    };
  }, [sessionUserId, isNative, remotePushAvailable, getAccessToken, noteInboxChange, refreshDeviceRegistration]);

  useEffect(() => {
    if (loading || !sessionUserId || !pendingTapItemId) return;
    const key = `${sessionUserId}:${pendingTapItemId}`;
    if (lastOpened.current === key) return;
    lastOpened.current = key;
    router.replace({ pathname: '/notification-target', params: { itemId: pendingTapItemId } });
  }, [loading, pendingTapItemId, sessionUserId]);

  const visiblePermissionStatus = isNative && sessionUserId ? permissionStatus : 'undetermined';
  const visibleRegistrationError = isNative && sessionUserId ? registrationError : null;

  const value = useMemo(() => ({
    revision,
    permissionStatus: visiblePermissionStatus,
    remotePushAvailable,
    registrationError: visibleRegistrationError,
    pendingTapItemId,
    lastEvent,
    requestPermission,
    openSystemSettings,
    clearPendingTap,
  }), [revision, visiblePermissionStatus, remotePushAvailable, visibleRegistrationError, pendingTapItemId, lastEvent, requestPermission, openSystemSettings, clearPendingTap]);

  return <NotificationRuntimeContext.Provider value={value}>{children}</NotificationRuntimeContext.Provider>;
}

export function useNotificationRuntime(): NotificationRuntimeValue {
  const value = useContext(NotificationRuntimeContext);
  if (!value) throw new Error('useNotificationRuntime must be used within NotificationRuntimeProvider');
  return value;
}
