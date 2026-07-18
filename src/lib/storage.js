/**
 * Слой хранения данных.
 *
 * В прототипе всё лежит в localStorage браузера: своя база у каждого устройства,
 * данные не покидают компьютер. API оставлен асинхронным намеренно — когда появится
 * бэкенд, эти четыре функции заменяются на fetch к серверу, а экраны не меняются.
 */

const DB_KEY = 'mindcare:db:v2';
const SESSION_KEY = 'mindcare:session:v2';
const FILE_PREFIX = 'mindcare:doc:';

const read = (k) => {
  try { return localStorage.getItem(k); } catch { return null; }
};
const write = (k, v) => {
  try { localStorage.setItem(k, v); return true; } catch (e) { console.error('storage', e); return false; }
};

export async function loadDB() {
  const raw = read(DB_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function saveDB(db) {
  return write(DB_KEY, JSON.stringify(db));
}

export async function loadSession() {
  const raw = read(SESSION_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export async function saveSession(session) {
  if (session) return write(SESSION_KEY, JSON.stringify(session));
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { console.error(e); }
  return true;
}

/** Файлы хранятся отдельными ключами, чтобы не раздувать основную базу. */
export async function putFile(id, dataUrl) {
  return write(FILE_PREFIX + id, dataUrl);
}

export async function getFile(id) {
  return read(FILE_PREFIX + id);
}

export async function deleteFile(id) {
  try { localStorage.removeItem(FILE_PREFIX + id); } catch (e) { console.error(e); }
}

/** Полный сброс — удобно при демонстрациях. */
export async function resetAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('mindcare:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) { console.error(e); }
}
