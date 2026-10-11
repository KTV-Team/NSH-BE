import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@nexa/design-tokens';
import { updateUserSchema } from '@nexa/validation';
import { AppBottomNavigation } from '@/components/app-bottom-navigation';
import { AppText } from '@/components/app-text';
import { AppKeyboardAwareScrollView } from '@/components/app-keyboard-aware-scroll-view';
import { ErrorNotice } from '@/components/error-notice';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { apiErrorMessage } from '@/components/common/api-error-message';
import { useAuth } from '@/features/auth/auth-provider';
import { styles } from './profile-settings-screen.styles';

export default function ProfileSettingsScreen() {
  const { session, updateProfile, refreshProfile, logout } = useAuth();
  const user = session?.user;
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState<string | null>(null);
  const name = nameDraft ?? user?.name ?? '';
  const avatarUrl = avatarUrlDraft ?? user?.avatarUrl ?? '';
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const loadVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      await refreshProfile();
    } catch (cause) {
      if (version === loadVersion.current) setError(apiErrorMessage(cause));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [refreshProfile]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { ++loadVersion.current; };
  }, [load]));

  const initials = (user?.name ?? 'N')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? '')
    .join('')
    .toLocaleUpperCase('vi-VN');
  const hasChanges = Boolean(
    user && (
      name.trim() !== user.name ||
      avatarUrl.trim() !== (user.avatarUrl ?? '')
    ),
  );
  const memberSince = formatMemberSince(user?.createdAt);

  const handleSave = async () => {
    if (savingRef.current || loading) return;
    setError(null);
    setSaved(false);
    if (!user) return;

    const nextAvatarUrl = avatarUrl.trim();
    const result = updateUserSchema.safeParse({
      name: name.trim(),
      avatarUrl: nextAvatarUrl || null,
    });
    if (!result.success) {
      setError('Tên cần có từ 2 đến 100 ký tự và URL ảnh phải hợp lệ.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await updateProfile(result.data);
      setNameDraft(null);
      setAvatarUrlDraft(null);
      setSaved(true);
    } catch (saveError) {
      setError(apiErrorMessage(saveError));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất', 'Bạn có muốn đăng xuất khỏi thiết bị này?', [
      { text: 'Ở lại', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void logout()
            .catch(() => setError('Không thể kết thúc phiên. Vui lòng thử lại.'))
            .finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại hộp thư"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Icon name="back" size={20} />
        </Pressable>
        <AppText variant="body-md-medium" style={styles.headerTitle}>Hồ sơ & cài đặt</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <AppKeyboardAwareScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileSummary}>
          <View style={styles.avatar}>
            <AppText variant="body-md-medium" style={styles.avatarText}>{initials}</AppText>
          </View>
          <View style={styles.profileCopy}>
            <AppText variant="heading-5" numberOfLines={2}>{user?.name ?? 'Tài khoản'}</AppText>
            <AppText variant="body-sm" style={styles.secondaryText} numberOfLines={1}>
              {user?.email ?? ''}
            </AppText>
            {memberSince && (
              <AppText variant="caption" style={styles.secondaryText}>
                Thành viên từ {memberSince}
              </AppText>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="body-md-medium">Thông tin tài khoản</AppText>

          <View style={styles.field}>
            <AppText variant="body-sm-medium">Họ và tên</AppText>
            <TextInput
              accessibilityLabel="Họ và tên"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={(value) => {
                setNameDraft(value);
                setSaved(false);
              }}
              placeholder="Nhập họ và tên"
              placeholderTextColor={colors.muted}
              value={name}
              style={styles.input}
              returnKeyType="next"
            />
            <AppText variant="caption" style={styles.helper}>
              Tên hiển thị khi kết nối bạn bè và gửi thông báo.
            </AppText>
          </View>

          <View style={styles.field}>
            <AppText variant="body-sm-medium">Email tài khoản</AppText>
            <View style={[styles.input, styles.readOnlyInput]}>
              <AppText variant="body-sm" style={styles.readOnlyText} numberOfLines={1}>
                {user?.email ?? ''}
              </AppText>
            </View>
            <AppText variant="caption" style={styles.helper}>
              Email định danh tài khoản dùng để đăng nhập.
            </AppText>
          </View>

          <View style={styles.field}>
            <AppText variant="body-sm-medium">Đường dẫn ảnh đại diện (tùy chọn)</AppText>
            <TextInput
              accessibilityLabel="Đường dẫn ảnh đại diện"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={(value) => {
                setAvatarUrlDraft(value);
                setSaved(false);
              }}
              placeholder="https://..."
              placeholderTextColor={colors.muted}
              value={avatarUrl}
              style={styles.input}
              returnKeyType="done"
            />
            <AppText variant="caption" style={styles.helper}>
              Nhập URL HTTPS để đổi ảnh; để trống để xóa ảnh hiện tại.
            </AppText>
          </View>

          {error && <ErrorNotice message={error} action={{ label: 'Thử tải lại', onPress: () => void load() }} />}
          {loading && <AppText variant="body-sm">Đang tải hồ sơ…</AppText>}
          {saved && (
            <View style={styles.successNotice} accessibilityRole="alert">
              <Icon name="check" size={17} color={colors['moss-dark']} />
              <AppText variant="body-sm" style={styles.successText}>
                Hồ sơ đã được cập nhật.
              </AppText>
            </View>
          )}

          <PrimaryButton
            label="Lưu thay đổi hồ sơ"
            busy={saving}
            disabled={!hasChanges || signingOut || loading}
            onPress={() => void handleSave()}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất khỏi thiết bị này"
          accessibilityState={{ disabled: signingOut }}
          disabled={signingOut}
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Icon name="close" size={17} color={colors['coral-dark']} />
          <AppText variant="body-sm-medium" style={styles.logoutText}>
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất khỏi thiết bị này'}
          </AppText>
        </Pressable>
      </AppKeyboardAwareScrollView>

      <AppBottomNavigation active="account" />
    </SafeAreaView>
  );
}

function formatMemberSince(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}
