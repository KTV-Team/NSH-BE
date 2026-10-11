import { StyleSheet } from 'react-native';
import { colors, rounded, spacing } from '@nexa/design-tokens';

export const styles = StyleSheet.create({
  trigger: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors['hairline-strong'],
    borderRadius: rounded.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.canvas,
  },
  selectedValue: { color: colors.ink },
  placeholder: { color: colors.muted },
  pressed: { opacity: 0.72 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.36)' },
  sheet: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: rounded.lg,
    borderTopRightRadius: rounded.lg,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  confirmText: { color: colors['moss-dark'] },
});
