import type { CreateNotificationDto, Delivery } from '@nexa/types';
import { createNotificationSchema } from '@nexa/validation';

export type NotificationFormField =
  | 'recipientId'
  | 'title'
  | 'body'
  | 'scheduledDate'
  | 'scheduledTime'
  | 'scheduledDelay'
  | 'recurrenceStartsOn'
  | 'recurrenceEndsOn'
  | 'recurrenceLocalTime'
  | 'recurrenceWeekdays'
  | 'timeZone';

export interface CreateNotificationFormValues {
  recipientId: string;
  title: string;
  body: string;
  deliveryMode: 'immediate' | 'scheduled' | 'recurring';
  scheduledDate: string;
  scheduledTime: string;
  scheduledMode?: 'absolute' | 'relative';
  scheduledDelay?: string;
  scheduledDelayUnit?: 'minutes' | 'hours' | 'days';
  recurrenceFrequency: 'daily' | 'weekly';
  recurrenceStartsOn: string;
  recurrenceEndsOn: string;
  recurrenceLocalTime: string;
  recurrenceWeekdays: number[];
}

export type NotificationFormErrors = Partial<Record<NotificationFormField, string>>;

function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseScheduledDateTime(dateText: string, timeText: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  const time = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!match || !time) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (year < 1000 || hour > 23 || minute > 59) return null;

  const value = new Date(0);
  value.setFullYear(year, month - 1, day);
  value.setHours(hour, minute, 0, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return null;
  }
  return value;
}

export function buildCreateNotificationRequest(
  values: CreateNotificationFormValues,
  requestId: string,
  timeZone: string,
  now = new Date(),
): { payload: CreateNotificationDto | null; errors: NotificationFormErrors } {
  const errors: NotificationFormErrors = {};
  let delivery: Delivery = { mode: 'immediate' };

  if (values.deliveryMode === 'scheduled') {
    if (values.scheduledMode === 'relative') {
      const rawDelay = values.scheduledDelay?.trim() ?? '';
      const delay = /^\d+$/.test(rawDelay) ? Number(rawDelay) : NaN;
      const unit = values.scheduledDelayUnit ?? 'minutes';
      const multiplier = unit === 'days' ? 24 * 60 * 60_000 : unit === 'hours' ? 60 * 60_000 : 60_000;
      const scheduledAtMs = now.getTime() + delay * multiplier;
      if (!Number.isSafeInteger(delay) || delay <= 0 || !Number.isSafeInteger(scheduledAtMs)) {
        errors.scheduledDelay = 'Nhập số phút, giờ hoặc ngày nguyên dương hợp lệ.';
      } else {
        const scheduledAt = new Date(scheduledAtMs);
        if (scheduledAt.getTime() !== scheduledAtMs) {
          errors.scheduledDelay = 'Thời điểm gửi vượt quá giới hạn cho phép.';
        } else {
          delivery = { mode: 'scheduled', scheduledAt: scheduledAt.toISOString() };
        }
      }
    } else {
      const scheduledAt = parseScheduledDateTime(values.scheduledDate, values.scheduledTime);
      if (!scheduledAt) {
        errors.scheduledDate = 'Nhập ngày và giờ hợp lệ.';
        errors.scheduledTime = 'Nhập ngày và giờ hợp lệ.';
      } else if (scheduledAt <= now) {
        errors.scheduledDate = 'Thời điểm gửi phải ở trong tương lai.';
      } else {
        delivery = { mode: 'scheduled', scheduledAt: scheduledAt.toISOString() };
      }
    }
  }

  if (values.deliveryMode === 'recurring') {
    const startsOn = parseCalendarDate(values.recurrenceStartsOn);
    const endsOn = values.recurrenceEndsOn ? parseCalendarDate(values.recurrenceEndsOn) : null;
    if (!startsOn) errors.recurrenceStartsOn = 'Nhập ngày bắt đầu hợp lệ (YYYY-MM-DD).';
    if (values.recurrenceEndsOn && !endsOn)
      errors.recurrenceEndsOn = 'Nhập ngày kết thúc hợp lệ (YYYY-MM-DD).';
    if (
      startsOn &&
      endsOn &&
      new Date(Date.UTC(endsOn.year, endsOn.month - 1, endsOn.day)) <
        new Date(Date.UTC(startsOn.year, startsOn.month - 1, startsOn.day))
    ) {
      errors.recurrenceEndsOn = 'Ngày kết thúc không được trước ngày bắt đầu.';
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.recurrenceLocalTime))
      errors.recurrenceLocalTime = 'Nhập giờ hợp lệ theo dạng HH:mm.';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(now);
    } catch {
      errors.timeZone = 'Không xác định được múi giờ thiết bị.';
    }
    if (values.recurrenceFrequency === 'weekly' && values.recurrenceWeekdays.length === 0)
      errors.recurrenceWeekdays = 'Chọn ít nhất một ngày trong tuần.';

    if (startsOn && !Object.keys(errors).some((key) => key.startsWith('recurrence') || key === 'timeZone')) {
      const common = {
        timeZone,
        localTime: values.recurrenceLocalTime,
        startsOn: values.recurrenceStartsOn,
        ...(values.recurrenceEndsOn ? { endsOn: values.recurrenceEndsOn } : {}),
      };
      delivery =
        values.recurrenceFrequency === 'weekly'
          ? { mode: 'recurring', rule: { frequency: 'weekly', ...common, weekdays: values.recurrenceWeekdays } }
          : { mode: 'recurring', rule: { frequency: 'daily', ...common } };
    }
  }

  if (Object.keys(errors).length > 0) return { payload: null, errors };
  const result = createNotificationSchema.safeParse({
    clientRequestId: requestId,
    recipientId: values.recipientId,
    title: values.title,
    body: values.body,
    delivery,
  });
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && field in values && !errors[field as NotificationFormField]) {
        errors[field as NotificationFormField] = issue.message;
      } else if (field === 'recipientId' || field === 'title' || field === 'body') {
        errors[field] = issue.message;
      } else if (field === 'delivery') {
        errors[values.deliveryMode === 'scheduled'
          ? values.scheduledMode === 'relative' ? 'scheduledDelay' : 'scheduledDate'
          : 'recurrenceLocalTime'] = issue.message;
      }
    }
    return { payload: null, errors };
  }
  return { payload: result.data, errors: {} };
}

export function localCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
