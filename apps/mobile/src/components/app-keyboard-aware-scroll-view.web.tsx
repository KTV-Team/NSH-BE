import type { ComponentProps } from 'react';
import { ScrollView } from 'react-native';

type Props = ComponentProps<typeof ScrollView>;

export function AppKeyboardAwareScrollView(props: Props) {
  return <ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" {...props} />;
}
