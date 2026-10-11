import { useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { AppText } from '@/components/app-text';
import { styles } from './notification-date-time-picker.styles';

export interface NotificationDateTimePickerProps {
  accessibilityLabel: string;
  label: string;
  mode: 'date' | 'time';
  value?: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onChange: (value: Date | null) => void;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function displayValue(value: Date, mode: 'date' | 'time'): string {
  return mode === 'date'
    ? `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`
    : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function NotificationDateTimePicker({
  accessibilityLabel,
  label,
  mode,
  value,
  minimumDate,
  maximumDate,
  onChange,
}: NotificationDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => value ?? new Date());

  const show = () => {
    Keyboard.dismiss();
    setDraft(value ?? new Date());
    setOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'set' && selected) onChange(selected);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Chạm để mở bộ chọn."
        onPress={show}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <AppText variant="body-sm" style={value ? styles.selectedValue : styles.placeholder}>
          {value ? displayValue(value, mode) : 'Chọn'}
        </AppText>
      </Pressable>
      {open && (Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode={mode}
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleAndroidChange}
        />
      ) : (
        <Modal transparent animationType="slide" visible onRequestClose={() => setOpen(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <AppText variant="body-md-medium">{label}</AppText>
              <DateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                locale="vi-VN"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(event, selected) => {
                  if (event.type === 'set' && selected) setDraft(selected);
                }}
              />
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.actionButton}>
                  <AppText variant="button-md">Hủy</AppText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { onChange(draft); setOpen(false); }} style={styles.actionButton}>
                  <AppText variant="button-md" style={styles.confirmText}>Xác nhận</AppText>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ))}
    </>
  );
}
