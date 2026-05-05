const JST_TIME_ZONE = "Asia/Tokyo";

const jstDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  month: "2-digit",
  timeZone: JST_TIME_ZONE,
  year: "numeric"
});

const jstDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: JST_TIME_ZONE,
  year: "numeric"
});

const jstMediumDateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: JST_TIME_ZONE
});

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function formatJstDate(value: string | Date) {
  return jstDateFormatter.format(toDate(value));
}

export function formatJstDateTime(value: string | Date) {
  return jstDateTimeFormatter.format(toDate(value));
}

export function formatJstMediumDateTime(value: string | Date) {
  return jstMediumDateTimeFormatter.format(toDate(value));
}
