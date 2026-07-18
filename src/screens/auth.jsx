import React, { useState } from 'react';
import { uid, code6, CATEGORIES } from '../lib/utils.js';
import { Field, Area, Top } from '../components/common.jsx';
import { DocUploader } from '../components/documents.jsx';
import { createStudent, createPsychologist, setVerified, resendCode } from '../lib/db.js';

// Экраны до входа в приложение: приветствие, вход, регистрация, подтверждение почты

export function VerifyEmail({ me, reload, logout, notify }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);

  const confirm = async () => {
    if (code.trim() !== me.email_code) {
      setTries(tries + 1);
      return setErr(tries >= 3 ? "Код не совпадает. Запросите новый." : "Код не совпадает");
    }
    await setVerified(me.id);
    await reload();
    notify("Email подтверждён");
  };

  const resend = async () => {
    await resendCode(me.id);
    await reload();
    setErr(""); setTries(0);
    notify("Новый код отправлен");
  };

  return (
    <div className="body stack" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh" }}>
      <div className="eyebrow">Шаг подтверждения</div>
      <h1>Подтвердите почту</h1>
      <p className="muted">Мы отправили шестизначный код на {me.email}. Введите его, чтобы продолжить.</p>
      <div className="card" style={{ background: "var(--mosslite)", borderColor: "var(--moss)" }}>
        <div className="eyebrow">Прототип · письмо не уходит</div>
        <p style={{ fontFamily: "Spectral, serif", fontSize: 30, letterSpacing: ".18em", marginTop: 6 }}>{me.email_code}</p>
        <p className="tiny">В рабочей версии код придёт письмом и здесь показываться не будет.</p>
      </div>
      <Field label="Код из письма" value={code} inputMode="numeric" maxLength={6}
        onChange={(e) => { setCode(e.target.value); setErr(""); }} placeholder="000000" />
      {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
      <button className="btn" disabled={code.trim().length !== 6} onClick={confirm}>Подтвердить</button>
      <button className="link" style={{ width: "100%" }} onClick={resend}>Отправить код заново</button>
      <div className="divider" />
      <button className="btn quiet" onClick={logout}>Выйти</button>
    </div>
  );
}

export function Auth({ db, reload, route, go, login, notify }) {
  const [err, setErr] = useState("");

  if (route.n === "welcome")
    return (
      <div className="body" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh" }}>
        <div className="eyebrow">Психологическая поддержка студентов</div>
        <h1 style={{ marginTop: 10 }}>MINDCARE</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          Проходите тесты, которые составили практикующие психологи. Решайте сами, показывать ли результат специалисту.
        </p>
        <div className="divider" />
        <div className="stack">
          <button className="btn" onClick={() => go("reg-student")}>Я студент</button>
          <button className="btn ghost" onClick={() => go("reg-psy")}>Я психолог</button>
          <button className="link" style={{ width: "100%" }} onClick={() => go("login")}>У меня уже есть аккаунт</button>
        </div>
        <p className="tiny" style={{ marginTop: 28 }}>
          Приложение не оказывает медицинскую помощь и не ставит диагнозы. При угрозе жизни звоните 112.
        </p>
      </div>
    );

  if (route.n === "login")
    return <LoginScreen go={go} login={login} err={err} setErr={setErr} />;

  if (route.n === "reg-student")
    return <RegStudent db={db} reload={reload} go={go} login={login} />;

  if (route.n === "reg-psy")
    return <RegPsych db={db} reload={reload} go={go} login={login} notify={notify} />;

  return null;
}

export function LoginScreen({ go, login, err, setErr }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <>
      <Top title="Вход" onBack={() => go("welcome")} />
      <div className="body stack">
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.kz" />
        <Field label="Пароль" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
        <button className="btn" onClick={async () => setErr((await login(email, pw)) || "")}>Войти</button>
        <div className="divider" />
        <div className="card">
          <div className="eyebrow">Демо-доступы</div>
          <p className="tiny" style={{ marginTop: 8 }}>
            Администратор — admin@mindcare.kz / admin123<br />
            Психолог (подтверждён) — aigerim@mindcare.kz / demo1234
          </p>
        </div>
      </div>
    </>
  );
}

export function RegStudent({ db, reload, go, login }) {
  const [f, setF] = useState({ fullName: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.fullName.trim().length > 2 && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8 && agree;

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      if (db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase()))
        return setErr("Такой email уже зарегистрирован");
      await createStudent(f);
      await reload();
      await login(f.email, f.password);
    } catch (e) { setErr(e.message || "Не удалось создать аккаунт"); }
    setBusy(false);
  };

  return (
    <>
      <Top title="Регистрация студента" onBack={() => go("welcome")} />
      <div className="body stack">
        <Field label="ФИО" value={f.fullName} onChange={set("fullName")} placeholder="Айсулу Ермекова" />
        <Field label="Email" type="email" value={f.email} onChange={set("email")} />
        <Field label="Пароль (от 8 символов)" type="password" value={f.password} onChange={set("password")} />
        <button className="opt" onClick={() => setAgree(!agree)} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16 }}>{agree ? "◼" : "◻"}</span>
          <span className="tiny">Согласен(на) с политикой конфиденциальности и обработкой данных о моём состоянии</span>
        </button>
        {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
        <button className="btn" disabled={!ok || busy} onClick={submit}>{busy ? "Создаём…" : "Создать аккаунт"}</button>
      </div>
    </>
  );
}

export function RegPsych({ db, reload, go, login, notify }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ fullName: "", email: "", phone: "", password: "", education: "", experienceYears: "", about: "" });
  const [specs, setSpecs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const step1ok = f.fullName.trim().length > 2 && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8;
  const step2ok = f.education.trim() && specs.length && String(f.experienceYears).length;
  const step3ok = docs.some((d) => d.type === "DIPLOMA");

  const submit = async () => {
    setBusy(true); setErr("");
    try {
      if (db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase()))
        return setErr("Такой email уже зарегистрирован");
      await createPsychologist({
        fullName: f.fullName, email: f.email, phone: f.phone, password: f.password,
        education: f.education, specializations: specs, experienceYears: f.experienceYears, about: f.about,
        documents: docs,
      });
      await reload();
      await login(f.email, f.password);
      notify("Заявка отправлена на проверку");
    } catch (e) { setErr(e.message || "Не удалось отправить заявку"); }
    setBusy(false);
  };

  return (
    <>
      <Top title="Регистрация психолога" onBack={() => (step === 1 ? go("welcome") : setStep(step - 1))} />
      <div className="body stack">
        <div className="progress"><i style={{ width: `${step * 33.3}%` }} /></div>
        {step === 1 && (
          <>
            <div className="eyebrow">Шаг 1 из 3 · контакты</div>
            <Field label="ФИО" value={f.fullName} onChange={set("fullName")} />
            <Field label="Email" type="email" value={f.email} onChange={set("email")} />
            <Field label="Телефон" value={f.phone} onChange={set("phone")} placeholder="+7" />
            <Field label="Пароль (от 8 символов)" type="password" value={f.password} onChange={set("password")} />
            <button className="btn" disabled={!step1ok} onClick={() => setStep(2)}>Дальше</button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="eyebrow">Шаг 2 из 3 · квалификация</div>
            <Area label="Образование" value={f.education} onChange={set("education")} placeholder="Вуз, специальность, год выпуска" />
            <div>
              <span className="tiny">Специализация</span>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 8, gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <button key={c} className={"chip" + (specs.includes(c) ? " on" : "")}
                    onClick={() => setSpecs(specs.includes(c) ? specs.filter((x) => x !== c) : [...specs, c])}>{c}</button>
                ))}
              </div>
            </div>
            <Field label="Опыт работы, лет" type="number" value={f.experienceYears} onChange={set("experienceYears")} />
            <Area label="О себе (увидят студенты)" value={f.about} onChange={set("about")} />
            <button className="btn" disabled={!step2ok} onClick={() => setStep(3)}>Дальше</button>
          </>
        )}
        {step === 3 && (
          <>
            <div className="eyebrow">Шаг 3 из 3 · документы</div>
            <p className="tiny">Загрузите диплом — без него заявку не примут. Сертификаты и другие подтверждения добавьте, если они есть.</p>
            <DocUploader docs={docs} setDocs={setDocs} />
            {!step3ok && docs.length > 0 && <p className="tiny" style={{ color: "var(--ochre)" }}>Нужен хотя бы один документ с типом «Диплом».</p>}
            {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
            <button className="btn" disabled={!step3ok || busy} onClick={submit}>{busy ? "Отправляем…" : "Отправить заявку"}</button>
          </>
        )}
      </div>
    </>
  );
}
