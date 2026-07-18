import React, { useState, useEffect } from 'react';
import { loadDB, saveDB, loadSession, saveSession } from './lib/storage.js';
import { seedDB } from './lib/seed.js';
import { Auth, VerifyEmail } from './screens/auth.jsx';
import { StudentApp } from './screens/student.jsx';
import { PsychApp } from './screens/psychologist.jsx';
import { AdminApp } from './screens/admin.jsx';

// Корневой компонент: хранит базу, сессию и маршрут, раздаёт их экранам по ролям

export default function App() {
  const [db, setDb] = useState(null);
  const [session, setSession] = useState(null);
  const [route, setRoute] = useState({ n: "welcome" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      let d = await loadDB();
      if (!d) { d = seedDB(); await saveDB(d); }
      const s = await loadSession();
      setDb(d);
      if (s && d.users.some((u) => u.id === s.userId)) { setSession(s); setRoute({ n: "home" }); }
    })();
  }, []);

  const commit = (next) => { setDb(next); saveDB(next); };
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const go = (n, params = {}) => setRoute({ n, ...params });

  const me = db && session ? db.users.find((u) => u.id === session.userId) : null;

  const login = async (email, password) => {
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return "Неверный email или пароль";
    if (u.status === "BLOCKED") return "Аккаунт заблокирован администратором";
    const s = { userId: u.id };
    setSession(s); await saveSession(s); go("home");
    return null;
  };
  const logout = async () => { setSession(null); await saveSession(null); go("welcome"); };

  if (!db) return <div className="mc"><div className="frame"><div className="body"><p className="muted">Загрузка…</p></div></div></div>;

  let screen;
  if (!me) {
    screen = <Auth db={db} commit={commit} route={route} go={go} login={login} notify={notify} />;
  } else if (!me.emailVerifiedAt) {
    screen = <VerifyEmail me={me} db={db} commit={commit} logout={logout} notify={notify} />;
  } else if (me.role === "ADMIN") {
    screen = <AdminApp me={me} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  } else if (me.role === "PSYCHOLOGIST") {
    screen = <PsychApp me={me} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  } else {
    screen = <StudentApp me={me} db={db} commit={commit} route={route} go={go} notify={notify} logout={logout} />;
  }

  return (
    <div className="mc">
      <div className="frame">{screen}{toast && <div className="toast">{toast}</div>}</div>
    </div>
  );
}
