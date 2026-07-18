import React, { useState, useEffect, useCallback } from 'react';
import { loadDB, loadSession, saveSession, getUser } from './lib/db.js';
import { Auth, VerifyEmail } from './screens/auth.jsx';
import { StudentApp } from './screens/student.jsx';
import { PsychApp } from './screens/psychologist.jsx';
import { AdminApp } from './screens/admin.jsx';

// Корневой компонент: хранит снимок базы, сессию и маршрут, раздаёт их экранам по ролям.
// Данные живут в Supabase; reload() перечитывает снимок после любой мутации.

export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState({ n: "welcome" });
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    const next = await loadDB();
    setDb(next);
    if (session) {
      const u = await getUser(session.userId);
      setMe(u);
    }
    return next;
  }, [session]);

  useEffect(() => {
    (async () => {
      const d = await loadDB();
      setDb(d);
      const s = await loadSession();
      if (s && d.users.some((u) => u.id === s.userId)) {
        setSession(s);
        const u = await getUser(s.userId);
        setMe(u);
        setRoute({ n: "home" });
      }
    })();
  }, []);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const go = (n, params = {}) => setRoute({ n, ...params });

  const login = async (email, password) => {
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return "Неверный email или пароль";
    if (u.status === "BLOCKED") return "Аккаунт заблокирован администратором";
    const s = { userId: u.id };
    setSession(s); await saveSession(s);
    const full = await getUser(u.id);
    setMe(full);
    go("home");
    return null;
  };
  const logout = async () => {
    setSession(null); setMe(null); await saveSession(null); go("welcome");
  };

  if (!db) return <div className="mc"><div className="frame"><div className="body"><p className="muted">Загрузка…</p></div></div></div>;

  let screen;
  if (!me) {
    screen = <Auth db={db} reload={reload} route={route} go={go} login={login} notify={notify} />;
  } else if (!me.email_verified_at) {
    screen = <VerifyEmail me={me} reload={reload} logout={logout} notify={notify} />;
  } else if (me.role === "ADMIN") {
    screen = <AdminApp me={me} db={db} reload={reload} route={route} go={go} notify={notify} logout={logout} />;
  } else if (me.role === "PSYCHOLOGIST") {
    screen = <PsychApp me={me} db={db} reload={reload} route={route} go={go} notify={notify} logout={logout} />;
  } else {
    screen = <StudentApp me={me} db={db} reload={reload} route={route} go={go} notify={notify} logout={logout} />;
  }

  return (
    <div className="mc">
      <div className="frame">{screen}{toast && <div className="toast">{toast}</div>}</div>
    </div>
  );
}
