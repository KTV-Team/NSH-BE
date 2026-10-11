import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { InboxItem } from '@nexa/types';
import { ApiClientError } from '@nexa/api-client';
import { colors } from '@nexa/design-tokens';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { useAuth } from '@/features/auth/auth-provider';
import { useNotificationRuntime } from '@/notifications/notification-runtime';
import { styles } from './inbox-screen.styles';

function errorMessage(failure: unknown): string {
  if (failure instanceof ApiClientError) return failure.message;
  return 'Không thể kết nối máy chủ. Hãy thử lại.';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Thời gian không xác định'
    : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? '').join('').toLocaleUpperCase('vi-VN');
}

export default function InboxScreen() {
  const { api, session, clearExpiredSession } = useAuth();
  const sessionUserId = session?.user.id;
  const { revision, permissionStatus, remotePushAvailable, registrationError, requestPermission, openSystemSettings, lastEvent } = useNotificationRuntime();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const activeUserId = useRef(sessionUserId);
  const itemsRef = useRef(items);
  const dataOwnerRef = useRef<string | null>(null);
  const lastOwner = useRef<string | undefined>(sessionUserId);
  const loadedPage = useRef(1);
  const syncVersion = useRef(0);
  const handledEventId = useRef<string | null>(null);
  useEffect(() => {
    activeUserId.current = sessionUserId;
    itemsRef.current = items;
    dataOwnerRef.current = dataOwnerId;
  }, [dataOwnerId, items, sessionUserId]);

  const visibleItems = dataOwnerId === sessionUserId ? items : [];
  const visibleUnreadCount = dataOwnerId === sessionUserId ? unreadCount : 0;

  const loadInbox = useCallback(async (owner: string, requestedPages: number, version: number) => {
    const pageNumbers = Array.from({ length: requestedPages }, (_, index) => index + 1);
    const [pages, unread] = await Promise.all([
      Promise.all(pageNumbers.map((pageNumber) => api.inbox.list({ page: pageNumber, limit: 20 }))),
      api.inbox.unreadCount(),
    ]);
    if (activeUserId.current !== owner || syncVersion.current !== version) return;
    const uniqueItems = new Map<string, InboxItem>();
    for (const result of pages) {
      for (const item of result.data) uniqueItems.set(item.id, item);
    }
    const sortedItems = [...uniqueItems.values()].sort((left, right) =>
      right.deliveredAt.localeCompare(left.deliveredAt) || right.id.localeCompare(left.id),
    );
    setItems(sortedItems);
    setDataOwnerId(owner);
    setUnreadCount(unread.unreadCount);
    const latest = pages.at(-1);
    const availablePages = latest?.meta.totalPages ?? 1;
    const retainedPage = Math.min(Math.max(1, requestedPages), Math.max(1, availablePages));
    loadedPage.current = retainedPage;
    setPage(retainedPage);
    setTotalPages(availablePages);
    setError(null);
  }, [api]);

  useEffect(() => {
    if (!sessionUserId) {
      syncVersion.current += 1;
      loadedPage.current = 1;
      return;
    }
    if (lastOwner.current !== sessionUserId) {
      loadedPage.current = 1;
      lastOwner.current = sessionUserId;
    }

    const version = ++syncVersion.current;
    const realtimeEvent = lastEvent && lastEvent.eventId !== handledEventId.current ? lastEvent : null;
    if (realtimeEvent) handledEventId.current = realtimeEvent.eventId;
    const requestedPages = loadedPage.current;
    const hasCurrentItems = dataOwnerRef.current === sessionUserId && itemsRef.current.length > 0;
    void Promise.resolve().then(() => {
      setLoading(!hasCurrentItems);
      setRefreshing(hasCurrentItems);
      setError(null);
      return loadInbox(sessionUserId, requestedPages, version);
    }).catch((failure: unknown) => {
      if (activeUserId.current !== sessionUserId || syncVersion.current !== version) return;
      if (failure instanceof ApiClientError && failure.statusCode === 401) {
        void clearExpiredSession();
        return;
      }
      setError(errorMessage(failure));
    }).finally(() => {
      if (syncVersion.current === version) {
        setLoading(false);
        setRefreshing(false);
      }
    });
  }, [api, clearExpiredSession, lastEvent, loadInbox, revision, retryKey, sessionUserId]);

  const refresh = () => setRetryKey((value) => value + 1);

  const loadMore = async () => {
    if (!sessionUserId || loadingMore || page >= totalPages) return;
    const owner = sessionUserId;
    const version = syncVersion.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    setActionError(null);
    try {
      const result = await api.inbox.list({ page: nextPage, limit: 20 });
      if (activeUserId.current !== owner || syncVersion.current !== version) return;
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...result.data.filter((item) => !seen.has(item.id))];
      });
      loadedPage.current = result.meta.page;
      setPage(result.meta.page);
      setTotalPages(result.meta.totalPages);
    } catch (failure) {
      if (activeUserId.current !== owner) return;
      if (failure instanceof ApiClientError && failure.statusCode === 401) {
        await clearExpiredSession();
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      if (activeUserId.current === owner) setLoadingMore(false);
    }
  };

  const markRead = async (item: InboxItem) => {
    if (!sessionUserId || busyIds.has(item.id)) return;
    const owner = sessionUserId;
    setBusyIds((current) => new Set(current).add(item.id));
    setActionError(null);
    try {
      const updated = await api.inbox.setRead(item.id, { read: item.readAt === null });
      if (activeUserId.current !== owner) return;
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setUnreadCount((current) => Math.max(0, current + (item.readAt === null ? -1 : 1)));
    } catch (failure) {
      if (activeUserId.current !== owner) return;
      if (failure instanceof ApiClientError && failure.statusCode === 401) {
        await clearExpiredSession();
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      if (activeUserId.current === owner) {
        setBusyIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    }
  };

  const deleteItem = async (item: InboxItem) => {
    if (!sessionUserId || busyIds.has(item.id)) return;
    const owner = sessionUserId;
    setBusyIds((current) => new Set(current).add(item.id));
    setActionError(null);
    try {
      await api.inbox.delete(item.id);
      if (activeUserId.current !== owner) return;
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (item.readAt === null) setUnreadCount((current) => Math.max(0, current - 1));
      loadedPage.current = Math.max(1, loadedPage.current);
      setRetryKey((value) => value + 1);
    } catch (failure) {
      if (activeUserId.current !== owner) return;
      if (failure instanceof ApiClientError && failure.statusCode === 401) {
        await clearExpiredSession();
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      if (activeUserId.current === owner) {
        setBusyIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    }
  };

  const readAll = async () => {
    if (!sessionUserId || visibleUnreadCount === 0 || markingAll) return;
    const owner = sessionUserId;
    setMarkingAll(true);
    setActionError(null);
    try {
      const result = await api.inbox.readAll();
      if (activeUserId.current !== owner) return;
      const readAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.readAt === null ? { ...item, readAt } : item));
      setUnreadCount((current) => Math.max(0, current - result.updatedCount));
    } catch (failure) {
      if (activeUserId.current !== owner) return;
      if (failure instanceof ApiClientError && failure.statusCode === 401) {
        await clearExpiredSession();
      } else {
        setActionError(errorMessage(failure));
      }
    } finally {
      if (activeUserId.current === owner) setMarkingAll(false);
    }
  };

  const initialsForUser = initials(session?.user.name ?? 'N');
  const canRequestPermission = remotePushAvailable && Platform.OS !== 'web' && permissionStatus !== 'granted' && permissionStatus !== 'provisional';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.brandMark}><AppText variant="body-md-medium" style={styles.brandLetter}>N</AppText></View>
          <AppText variant="body-md-medium" style={styles.brandName}>NEXA</AppText>
        </View>
        {session && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Tài khoản ${session.user.name}`}
            onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            <AppText variant="caption-bold" style={styles.avatarText}>{initialsForUser}</AppText>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <AppText variant="heading-3" style={styles.title}>Hộp thư</AppText>
            <AppText variant="body-sm" style={styles.subtitle}>Thông báo và lời nhắc của bạn</AppText>
          </View>
          <View style={styles.statusPill} accessibilityLabel={`${visibleUnreadCount} thông báo chưa đọc`}>
            <View style={[styles.statusDot, visibleUnreadCount > 0 && styles.statusDotUnread]} />
            <AppText variant="caption-bold" style={styles.statusText}>{visibleUnreadCount} chưa đọc</AppText>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/create-notification')}
          style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
        >
          <Icon name="plus" size={18} color={colors['on-primary']} />
          <AppText variant="button-md" style={styles.createButtonText}>Tạo thông báo mới</AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở bạn bè và lời mời kết bạn"
          onPress={() => router.push('/friends')}
          style={({ pressed }) => [styles.friendsLink, pressed && styles.friendsLinkPressed]}
        >
          <View style={styles.friendsLinkIcon}><Icon name="users" size={18} color={colors.ink} /></View>
          <View style={styles.friendsLinkCopy}>
            <AppText variant="body-sm-medium">Bạn bè và lời mời</AppText>
            <AppText variant="caption" style={styles.friendsLinkHint}>Tìm người dùng và quản lý kết nối</AppText>
          </View>
          <Icon name="chevron-right" size={18} color={colors.steel} />
        </Pressable>

        {session && canRequestPermission ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionCopy}>
              <AppText variant="body-sm-medium">Bật thông báo trên thiết bị</AppText>
              <AppText variant="caption" style={styles.permissionHint}>
                {permissionStatus === 'denied'
                  ? 'Quyền đã bị từ chối. Bạn có thể bật lại trong cài đặt của thiết bị.'
                  : 'Cho phép NEXA gửi thông báo khi ứng dụng đang chạy nền.'}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yêu cầu quyền nhận thông báo"
              onPress={() => {
                if (permissionStatus === 'denied') void openSystemSettings();
                else void requestPermission();
              }}
              style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
            >
              <AppText variant="caption-bold" style={styles.permissionButtonText}>
                {permissionStatus === 'denied' ? 'Cài đặt' : 'Bật'}
              </AppText>
            </Pressable>
          </View>
        ) : null}
        {registrationError ? <AppText accessibilityRole="alert" variant="caption" style={styles.inlineError}>{registrationError}</AppText> : null}
        {actionError ? <AppText accessibilityRole="alert" variant="body-sm" style={styles.inlineError}>{actionError}</AppText> : null}

        {!session ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><Icon name="mail" size={26} color={colors.steel} /></View>
            <AppText variant="body-md-medium" style={styles.emptyTitle}>Đăng nhập để xem hộp thư</AppText>
          </View>
        ) : loading && visibleItems.length === 0 ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="body-sm" style={styles.emptyDescription}>Đang tải hộp thư…</AppText>
          </View>
        ) : error && visibleItems.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><Icon name="alert" size={26} color={colors['yellow-dark']} /></View>
            <AppText variant="body-md-medium" style={styles.emptyTitle}>Chưa tải được hộp thư</AppText>
            <AppText variant="body-sm" style={styles.emptyDescription}>{error}</AppText>
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.secondaryButton}>
              <AppText variant="button-md">Thử lại</AppText>
            </Pressable>
          </View>
        ) : visibleItems.length === 0 ? (
          <View style={styles.stateCard}>
            <View style={styles.emptyIcon}><Icon name="mail" size={26} color={colors.steel} /></View>
            <AppText variant="body-md-medium" style={styles.emptyTitle}>Hộp thư đang trống</AppText>
            <AppText variant="body-sm" style={styles.emptyDescription}>Thông báo đã nhận sẽ hiển thị tại đây.</AppText>
          </View>
        ) : (
          <View style={styles.listSection}>
            <View style={styles.listHeading}>
              <AppText variant="body-sm-medium">Lịch sử</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đánh dấu tất cả là đã đọc"
                disabled={visibleUnreadCount === 0 || markingAll}
                onPress={() => { void readAll(); }}
                style={({ pressed }) => [styles.textAction, (pressed || markingAll) && styles.pressed]}
              >
                <AppText variant="caption-bold" style={styles.textActionLabel}>
                  {markingAll ? 'Đang cập nhật…' : 'Đọc tất cả'}
                </AppText>
              </Pressable>
            </View>
            {error ? <AppText accessibilityRole="alert" variant="caption" style={styles.inlineError}>{error}</AppText> : null}
            {visibleItems.map((item) => {
              const busy = busyIds.has(item.id);
              const unread = item.readAt === null;
              return (
                <View key={item.id} style={[styles.itemCard, unread && styles.itemCardUnread]}>
                  <View style={styles.itemHeading}>
                    <View style={[styles.itemDot, unread && styles.itemDotUnread]} />
                    <AppText variant="caption" style={styles.senderName}>{item.sender.name}</AppText>
                    <AppText variant="caption" style={styles.itemDate}>{formatDate(item.deliveredAt)}</AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Mở thông báo: ${item.title}`}
                    onPress={() => router.push({ pathname: '/notification-target', params: { itemId: item.id } })}
                    style={({ pressed }) => [styles.itemContent, pressed && styles.itemPressed]}
                  >
                    <AppText variant="body-sm-medium" style={styles.itemTitle}>{item.title}</AppText>
                    <AppText variant="body-sm" numberOfLines={3} style={styles.itemBody}>{item.body}</AppText>
                  </Pressable>
                  <View style={styles.itemActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                      disabled={busy}
                      onPress={() => { void markRead(item); }}
                      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                    >
                      <AppText variant="caption-bold" style={styles.textActionLabel}>
                        {busy ? 'Đang lưu…' : unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xóa thông báo: ${item.title}`}
                      disabled={busy}
                      onPress={() => { void deleteItem(item); }}
                      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                    >
                      <AppText variant="caption-bold" style={styles.deleteActionLabel}>{busy ? 'Đang lưu…' : 'Xóa'}</AppText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {page < totalPages ? (
              <Pressable
                accessibilityRole="button"
                disabled={loadingMore}
                onPress={() => { void loadMore(); }}
                style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
              >
                {loadingMore ? <ActivityIndicator color={colors.primary} /> : null}
                <AppText variant="body-sm-medium">{loadingMore ? 'Đang tải…' : 'Tải thêm lịch sử'}</AppText>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
      <AppBottomNavigation active="inbox" />
    </SafeAreaView>
  );
}
