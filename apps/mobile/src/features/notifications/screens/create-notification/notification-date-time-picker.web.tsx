import { createElement } from 'react';
import type { CSSProperties } from 'react';
import { colors } from '@nexa/design-tokens';
import type { NotificationDateTimePickerProps } from './notification-date-time-picker';

function inputValue(value: Date | undefined, mode: 'date' | 'time'): string {
  if (!value) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return mode === 'date'
    ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function fromInputValue(raw: string, mode: 'date' | 'time'): Date | null {
  if (!raw) return null;
  if (mode === 'time') {
    const match = /^(\d{2}):(\d{2})$/.exec(raw);
    if (!match) return null;
    const result = new Date();
    result.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return result;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const result = new Date(0);
  result.setFullYear(year, month - 1, day);
  result.setHours(12, 0, 0, 0);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? result
    : null;
}

const inputStyle: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 42,
  border: `1px solid ${colors['hairline-strong']}`,
  borderRadius: 8,
  padding: '8px 12px',
  color: colors.ink,
  background: colors.canvas,
  font: 'inherit',
};

export function NotificationDateTimePicker({
  accessibilityLabel,
  mode,
  value,
  minimumDate,
  maximumDate,
  onChange,
}: NotificationDateTimePickerProps) {
  return createElement('input', {
    type: mode,
    'aria-label': accessibilityLabel,
    value: inputValue(value, mode),
    min: inputValue(minimumDate, mode),
    max: inputValue(maximumDate, mode),
    style: inputStyle,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(fromInputValue(event.currentTarget.value, mode)),
  });
}
