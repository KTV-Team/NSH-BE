import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@nexa/design-tokens';
import type { SearchUserSummary } from '@nexa/types';
import { AppText } from '@/components/app-text';
import { AppKeyboardAwareScrollView } from '@/components/app-keyboard-aware-scroll-view';
import { ErrorNotice } from '@/components/error-notice';
import { Icon } from '@/components/icon';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { apiErrorMessage } from '@/components/common/api-error-message';
import { useAuth } from '@/features/auth/auth-provider';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { styles } from './user-search-screen.styles';

const pageSize = 20;

export default function UserSearchScreen() {
  const { api } = useAuth();
  const [query, setQuery] = useState('');
  const searchedQuery = useDebouncedValue(query.trim(), 350);
  const [items, setItems] = useState<SearchUserSummary[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const version = useRef(0);
  const loadLock = useRef(false);
  const actionLock = useRef(false);

  const load = useCallback(async (nextPage: number) => {
    if (searchedQuery.length < 2 || loadLock.current) return;
    loadLock.current = true;
    const request = version.current;
    if (nextPage === 1) {
      setLoading(true);
      setItems([]);
      setPage(0);
      setHasMore(false);
    } else setLoadingMore(true);
    setError(null);
    try {
      const result = await api.users.search({ q: searchedQuery, page: nextPage, limit: pageSize });
      if (request !== version.current) return;
      setItems((previous) => nextPage === 1 ? result.data : [...previous, ...result.data]);
      setPage(nextPage);
      setHasMore(nextPage < result.meta.totalPages);
    } catch (cause) {
      if (request === version.current) setError(apiErrorMessage(cause));
    } finally {
      if (request === version.current) {
        loadLock.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [api, searchedQuery]);

  const reload = useCallback(() => {
    ++version.current;
    loadLock.current = false;
    if (searchedQuery.length >= 2) void load(1);
    else {
      setItems([]);
      setPage(0);
      setHasMore(false);
      setError(null);
      setLoading(false);
    }
  }, [load, searchedQuery]);
  useFocusEffect(useCallback(() => {
    reload();
    return () => { ++version.current; loadLock.current = false; };
  }, [reload]));

  const send = async (person: SearchUserSummary) => {
    if (actionLock.current || person.relationship !== 'none') return;
    actionLock.current = true;
    setBusyId(person.id);
    setError(null);
    try {
      await api.friends.sendRequest({ recipientId: person.id });
      reload();
    } catch (cause) {
      reload();
      setError(apiErrorMessage(cause));
    } finally {
      actionLock.current = false;
      setBusyId(null);
    }
  };

  const changeQuery = (value: string) => {
    ++version.current;
    loadLock.current = false;
    setQuery(value);
    setItems([]);
    setPage(0);
    setHasMore(false);
    setError(null);
    setLoading(value.trim().length >= 2);
  };

  return <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại bạn bè"
        onPress={() => router.replace('/friends')}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
        <Icon name="back" size={20} />
      </Pressable>
      <AppText variant="body-md-medium" style={styles.headerTitle}>Tìm người dùng</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Thông tin về tìm kiếm"
        onPress={() => Alert.alert('Tìm người dùng', 'Tìm theo tên hoặc email chính xác. Chỉ tên và ảnh đại diện được hiển thị.')}
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
        <Icon name="info" size={19} color={colors.steel} />
      </Pressable>
    </View>
    <AppKeyboardAwareScrollView contentContainerStyle={styles.content}>
      <View style={styles.titleGroup}>
        <AppText variant="heading-3" style={styles.title}>Kết nối bạn bè</AppText>
        <AppText variant="body-sm" style={styles.subtitle}>Tìm tài khoản để gửi lời mời kết bạn.</AppText>
      </View>
      <View style={styles.searchField}>
        <Icon name="search" size={19} color={colors.steel} />
        <TextInput accessibilityLabel="Tìm người dùng" autoCapitalize="none" autoCorrect={false}
          onChangeText={changeQuery} placeholder="Tên hoặc email chính xác"
          placeholderTextColor={colors.stone} returnKeyType="search" style={styles.searchInput}
          value={query} maxLength={100} />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Xóa nội dung tìm kiếm"
          onPress={() => changeQuery('')} hitSlop={8} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
          <Icon name="close" size={17} color={colors.steel} />
        </Pressable>}
      </View>
      {error && <ErrorNotice message={error} action={{ label: 'Thử lại', onPress: reload }} />}
      <View style={styles.resultHeading}>
        <AppText variant="caption-bold" style={styles.resultLabel}>KẾT QUẢ TÌM KIẾM</AppText>
      </View>
      {loading ? <AppText variant="body-sm">Đang tìm…</AppText> : !error && items.length === 0 ? <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}><Icon name="users" size={24} color={colors.steel} /></View>
        <AppText variant="body-md-medium" style={styles.emptyTitle}>
          {searchedQuery.length < 2 ? 'Nhập ít nhất 2 ký tự để tìm kiếm' : 'Không tìm thấy người dùng'}
        </AppText>
      </View> : items.map((person) => <View key={person.id} style={styles.personCard}>
        <View style={styles.personCopy}>
          <AppText variant="body-sm-medium" numberOfLines={2}>{person.name}</AppText>
          <AppText variant="caption" style={styles.relationship}>
            {person.relationship === 'friend' ? 'Đã là bạn bè' : person.relationship === 'incoming'
              ? 'Đã gửi lời mời cho bạn' : person.relationship === 'outgoing' ? 'Đang chờ phản hồi' : 'Chưa kết bạn'}
          </AppText>
        </View>
        {person.relationship === 'none' && <Pressable accessibilityRole="button"
          accessibilityLabel={`Gửi lời mời cho ${person.name}`} accessibilityState={{ disabled: busyId !== null }}
          disabled={busyId !== null} onPress={() => void send(person)} style={styles.sendButton}>
          <AppText variant="caption-bold">{busyId === person.id ? 'Đang gửi…' : 'Kết bạn'}</AppText>
        </Pressable>}
      </View>)}
      {!loading && hasMore && <Pressable accessibilityRole="button" accessibilityLabel="Tải thêm kết quả"
        accessibilityState={{ disabled: loadingMore }} disabled={loadingMore}
        onPress={() => void load(page + 1)} style={styles.loadMore}>
        <AppText variant="body-sm-medium">{loadingMore ? 'Đang tải…' : 'Tải thêm'}</AppText>
      </Pressable>}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/friends')}
        style={({ pressed }) => [styles.requestsLink, pressed && styles.pressed]}>
        <View style={styles.requestsCopy}>
          <AppText variant="body-sm-medium">Quản lý bạn bè và lời mời</AppText>
          <AppText variant="caption" style={styles.requestsHint}>Xem danh sách kết nối và lời mời kết bạn</AppText>
        </View>
        <Icon name="chevron-right" size={19} color={colors.steel} />
      </Pressable>
    </AppKeyboardAwareScrollView>
    <AppBottomNavigation active="friends" />
  </SafeAreaView>;
}
