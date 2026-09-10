export const numberFormatter = new Intl.NumberFormat("zh-CN");
export const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});
