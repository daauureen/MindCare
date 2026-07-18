// Утилиты: идентификаторы, даты, форматирование, справочники

export const uid = () => Math.random().toString(36).slice(2, 10);
export const nowISO = () => new Date().toISOString();
export const fmt = (iso) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const CATEGORIES = ["Стресс", "Тревога", "Сон", "Учёба и выгорание", "Отношения", "Самооценка"];

export const DISCLAIMER =
  "Результат теста — не медицинский диагноз. Он показывает, как вы описали своё состояние сегодня, и может быть поводом поговорить со специалистом.";

export const MAX_FILE = 3 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const code6 = () => String(Math.floor(100000 + Math.random() * 900000));

export const readAsDataURL = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("read"));
    r.readAsDataURL(file);
  });
export const kb = (n) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " МБ" : Math.round(n / 1024) + " КБ");
export const DOC_LABEL = { DIPLOMA: "Диплом", CERTIFICATE: "Сертификат", OTHER: "Другой документ" };

export function hoursLeft(submittedAt) {
  const ms = new Date(submittedAt).getTime() + 24 * 3600 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / 3600000));
}
