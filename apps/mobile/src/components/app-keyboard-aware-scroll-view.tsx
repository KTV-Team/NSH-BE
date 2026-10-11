import type { ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { spacing } from '@nexa/design-tokens';

type Props = ComponentProps<typeof ScrollView>;

export function AppKeyboardAwareScrollView(props: Props) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={spacing.md}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      {...props}
    />
  );
}
