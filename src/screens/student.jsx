import React, { useState, useEffect, useRef } from 'react';
import { uid, nowISO, fmt, CATEGORIES } from '../lib/utils.js';
import { Field, Area, Top, Empty, ScoreScale, Profile } from '../components/common.jsx';
import { isCrisis, askAI } from '../lib/ai.js';

// Всё, что видит студент

export function StudentApp({ me, db, commit, route, go, notify, logout }) {
  const tab = ["feed", "psychologists", "chat", "profile"].includes(route.n) ? route.n : route.tab || "feed";
  const publishedTests = db.tests.filter((t) => {
    const a = db.users.find((u) => u.id === t.authorId);
    return t.status === "PUBLISHED" && a && a.status === "ACTIVE" && a.profile?.verificationStatus === "APPROVED";
  });

  let content = null;
  if (route.n === "test") content = <TestCard db={db} test={db.tests.find((t) => t.id === route.id)} go={go} />;
  else if (route.n === "take") content = <TakeTest me={me} db={db} commit={commit} testId={route.id} go={go} />;
  else if (route.n === "result") content = <ResultScreen me={me} db={db} commit={commit} attemptId={route.id} go={go} notify={notify} />;
  else if (route.n === "history") content = <History me={me} db={db} go={go} />;
  else if (route.n === "psych-profile") content = <PsychPublic db={db} id={route.id} go={go} />;
  else if (tab === "feed") content = <Feed me={me} db={db} tests={publishedTests} go={go} />;
  else if (tab === "psychologists") content = <PsychList db={db} go={go} />;
  else if (tab === "chat") content = <AIChat me={me} db={db} commit={commit} go={go} tests={publishedTests} />;
  else content = <Profile me={me} go={go} logout={logout} extra={<button className="btn quiet" onClick={() => go("history")}>История результатов</button>} />;

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{content}</div>
      <div className="nav">
        {[["feed", "◈", "Тесты"], ["psychologists", "◐", "Психологи"], ["chat", "◍", "Поддержка"], ["profile", "◇", "Я"]].map(([k, d, l]) => (
          <button key={k} className={tab === k && ["feed", "psychologists", "chat", "profile"].includes(route.n) || tab === k && !["test", "take", "result", "history", "psych-profile"].includes(route.n) ? "on" : ""}
            onClick={() => go(k)}><span className="dot">{d}</span>{l}</button>
        ))}
      </div>
    </>
  );
}

export function Feed({ me, db, tests, go }) {
  const [cat, setCat] = useState(null);
  const [q, setQ] = useState("");
  const list = tests.filter((t) => (!cat || t.category === cat) && (!q || (t.title + t.description).toLowerCase().includes(q.toLowerCase())));
  const mine = db.attempts.filter((a) => a.studentId === me.id && a.status === "COMPLETED");

  return (
    <>
      <div className="top" style={{ paddingBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <div className="eyebrow">Здравствуйте, {me.fullName.split(" ")[0]}</div>
          <h2 style={{ marginTop: 4 }}>Тесты</h2>
        </div>
      </div>
      <div className="body stack">
        <input placeholder="Поиск по названию" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <button className={"chip" + (!cat ? " on" : "")} onClick={() => setCat(null)}>Все</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={"chip" + (cat === c ? " on" : "")} onClick={() => setCat(cat === c ? null : c)}>{c}</button>
          ))}
        </div>
        {mine.length > 0 && <p className="tiny">Вы прошли {mine.length} тест(ов) · <button className="link" style={{ fontSize: 12 }} onClick={() => go("history")}>смотреть историю</button></p>}
        {list.length === 0 && <Empty>Здесь пока пусто.<br />Тесты появятся, когда психологи их опубликуют.</Empty>}
        {list.map((t) => {
          const a = db.users.find((u) => u.id === t.authorId);
          return (
            <button key={t.id} className="card" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => go("test", { id: t.id })}>
              <span className="tag">{t.category}</span>
              <h3 style={{ marginTop: 10 }}>{t.title}</h3>
              <p className="muted" style={{ marginTop: 6 }}>{t.description}</p>
              <p className="tiny" style={{ marginTop: 10 }}>{a?.fullName} · {t.questions.length} вопросов · ~{t.minutes} мин</p>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function TestCard({ db, test, go }) {
  if (!test) return <Empty>Тест не найден</Empty>;
  const author = db.users.find((u) => u.id === test.authorId);
  return (
    <>
      <Top title="" onBack={() => go("feed")} />
      <div className="body stack">
        <span className="tag">{test.category}</span>
        <h1>{test.title}</h1>
        <p className="muted">{test.description}</p>
        <div className="card">
          <div className="eyebrow">Инструкция</div>
          <p style={{ marginTop: 8, fontSize: 14 }}>{test.instruction}</p>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <div><div className="eyebrow">Вопросов</div><p style={{ fontFamily: "Spectral, serif", fontSize: 22 }}>{test.questions.length}</p></div>
          <div><div className="eyebrow">Время</div><p style={{ fontFamily: "Spectral, serif", fontSize: 22 }}>~{test.minutes} мин</p></div>
        </div>
        <p className="tiny">Автор: {author?.fullName}</p>
        <div className="crisis" style={{ background: "var(--card)", borderColor: "var(--line)" }}>
          <p className="tiny">{test.disclaimer}</p>
        </div>
        <button className="btn" onClick={() => go("take", { id: test.id })}>Начать</button>
      </div>
    </>
  );
}

export function TakeTest({ me, db, commit, testId, go }) {
  const test = db.tests.find((t) => t.id === testId);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  if (!test) return <Empty>Тест не найден</Empty>;
  const q = test.questions[i];
  const chosen = answers[q.id];
  const last = i === test.questions.length - 1;

  const finish = () => {
    const picked = test.questions.map((qq) => {
      const opt = qq.options.find((o) => o.id === answers[qq.id]);
      return { questionId: qq.id, questionText: qq.text, optionId: opt.id, optionText: opt.text, score: opt.score };
    });
    const total = picked.reduce((s, a) => s + a.score, 0);
    const range = test.ranges.find((r) => total >= r.min && total <= r.max) || test.ranges[test.ranges.length - 1];
    const attempt = {
      id: uid(), studentId: me.id, studentName: me.fullName, testId: test.id, testTitle: test.title,
      psychologistId: test.authorId, status: "COMPLETED", answers: picked, totalScore: total, rangeId: range.id,
      startedAt: nowISO(), completedAt: nowISO(), shared: false, sharedAt: null, reviewStatus: null, note: "",
    };
    commit({ ...db, attempts: [attempt, ...db.attempts] });
    go("result", { id: attempt.id });
  };

  return (
    <>
      <Top title={test.title} onBack={() => (i === 0 ? go("test", { id: test.id }) : setI(i - 1))} />
      <div className="body">
        <div className="progress"><i style={{ width: `${((i + 1) / test.questions.length) * 100}%` }} /></div>
        <div className="eyebrow">Вопрос {i + 1} из {test.questions.length}</div>
        <h2 style={{ marginTop: 10, marginBottom: 20 }}>{q.text}</h2>
        {q.options.map((o) => (
          <button key={o.id} className={"opt" + (chosen === o.id ? " on" : "")}
            onClick={() => setAnswers({ ...answers, [q.id]: o.id })}>{o.text}</button>
        ))}
        <div style={{ marginTop: 24 }}>
          <button className="btn" disabled={!chosen} onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? "Завершить и посмотреть результат" : "Дальше"}
          </button>
        </div>
      </div>
    </>
  );
}

export function ResultScreen({ me, db, commit, attemptId, go, notify }) {
  const a = db.attempts.find((x) => x.id === attemptId);
  const test = db.tests.find((t) => t.id === a?.testId);
  const [confirm, setConfirm] = useState(false);
  if (!a || !test) return <Empty>Результат не найден</Empty>;
  const range = test.ranges.find((r) => r.id === a.rangeId);
  const psy = db.users.find((u) => u.id === a.psychologistId);

  const share = () => {
    commit({
      ...db,
      attempts: db.attempts.map((x) => x.id === a.id ? { ...x, shared: true, sharedAt: nowISO(), reviewStatus: "NEW" } : x),
      notifications: [{ id: uid(), userId: a.psychologistId, type: "RESULT_SHARED", title: "Вам отправлен новый результат", createdAt: nowISO(), read: false }, ...db.notifications],
    });
    setConfirm(false);
    notify("Результат отправлен психологу");
  };
  const revoke = () => {
    commit({ ...db, attempts: db.attempts.map((x) => x.id === a.id ? { ...x, shared: false, reviewStatus: null } : x) });
    notify("Отправка отозвана");
  };

  return (
    <>
      <Top title="Результат" onBack={() => go("feed")} />
      <div className="body stack">
        <div className="eyebrow">{test.title}</div>
        <h1>{range.title}</h1>
        <ScoreScale ranges={test.ranges} score={a.totalScore} activeId={range.id} />
        <p style={{ fontSize: 15 }}>{range.text}</p>
        {range.rec && <div className="card"><div className="eyebrow">Что можно сделать</div><p style={{ marginTop: 8, fontSize: 14 }}>{range.rec}</p></div>}
        <p className="tiny">{test.disclaimer}</p>
        <div className="divider" />
        {!a.shared && !confirm && (
          <>
            <h3>Показать результат психологу?</h3>
            <p className="tiny">Решение за вами. Без вашего согласия результат не увидит никто.</p>
            <button className="btn" onClick={() => setConfirm(true)}>Отправить {psy?.fullName}</button>
            <button className="btn quiet" onClick={() => go("feed")}>Оставить себе</button>
          </>
        )}
        {confirm && (
          <div className="card stack">
            <h3>Что увидит психолог</h3>
            <p className="tiny">Ваше имя, название теста, все ваши ответы, сумму баллов и итоговый диапазон. Психолог сможет добавить приватную заметку. Отозвать отправку можно в любой момент.</p>
            <button className="btn" onClick={share}>Согласен(на), отправить</button>
            <button className="btn quiet" onClick={() => setConfirm(false)}>Отмена</button>
          </div>
        )}
        {a.shared && (
          <div className="card stack">
            <span className="tag">Отправлено {psy?.fullName}</span>
            <p className="tiny">Статус: {{ NEW: "ждёт просмотра", VIEWED: "психолог просмотрел", NEEDS_CONSULT: "психолог предлагает консультацию", CLOSED: "закрыт" }[a.reviewStatus]}</p>
            <button className="btn quiet" onClick={revoke}>Отозвать отправку</button>
          </div>
        )}
      </div>
    </>
  );
}

export function History({ me, db, go }) {
  const list = db.attempts.filter((a) => a.studentId === me.id && a.status === "COMPLETED");
  return (
    <>
      <Top title="История" onBack={() => go("profile")} />
      <div className="body stack">
        {list.length === 0 && <Empty>Вы ещё не проходили тесты.</Empty>}
        {list.map((a) => {
          const t = db.tests.find((x) => x.id === a.testId);
          const r = t?.ranges.find((x) => x.id === a.rangeId);
          return (
            <button key={a.id} className="card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => go("result", { id: a.id })}>
              <div className="between"><h3>{a.testTitle}</h3><span className={"tag " + (a.shared ? "" : "grey")}>{a.shared ? "отправлен" : "только у вас"}</span></div>
              <p className="tiny" style={{ marginTop: 8 }}>{r?.title} · {a.totalScore} баллов · {fmt(a.completedAt)}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}

export function PsychList({ db, go }) {
  const list = db.users.filter((u) => u.role === "PSYCHOLOGIST" && u.profile?.verificationStatus === "APPROVED" && u.status === "ACTIVE");
  return (
    <>
      <Top title="Психологи" />
      <div className="body stack">
        {list.length === 0 && <Empty>Подтверждённых психологов пока нет.</Empty>}
        {list.map((p) => (
          <button key={p.id} className="card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => go("psych-profile", { id: p.id })}>
            <h3>{p.fullName}</h3>
            <p className="tiny" style={{ marginTop: 6 }}>{p.profile.specializations.join(" · ")} · опыт {p.profile.experienceYears} лет</p>
          </button>
        ))}
      </div>
    </>
  );
}

export function PsychPublic({ db, id, go }) {
  const p = db.users.find((u) => u.id === id);
  const tests = db.tests.filter((t) => t.authorId === id && t.status === "PUBLISHED");
  if (!p) return <Empty>Не найдено</Empty>;
  return (
    <>
      <Top title="" onBack={() => go("psychologists")} />
      <div className="body stack">
        <h1>{p.fullName}</h1>
        <p className="muted">{p.profile.specializations.join(" · ")}</p>
        <div className="card"><div className="eyebrow">Образование</div><p style={{ marginTop: 8, fontSize: 14 }}>{p.profile.education}</p></div>
        {p.profile.about && <p style={{ fontSize: 15 }}>{p.profile.about}</p>}
        <div className="divider" />
        <div className="eyebrow">Тесты автора</div>
        {tests.length === 0 && <p className="tiny">Пока нет опубликованных тестов.</p>}
        {tests.map((t) => (
          <button key={t.id} className="card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => go("test", { id: t.id })}>
            <h3>{t.title}</h3><p className="tiny" style={{ marginTop: 6 }}>{t.category} · ~{t.minutes} мин</p>
          </button>
        ))}
      </div>
    </>
  );
}

export function AIChat({ me, db, commit, go, tests }) {
  const msgs = db.chats[me.id] || [];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, busy]);

  const push = (arr) => commit({ ...db, chats: { ...db.chats, [me.id]: arr } });

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    const next = [...msgs, { role: "user", content: t, at: nowISO() }];
    push(next);
    if (isCrisis(t)) { setCrisis(true); return; }
    setBusy(true);
    const catalog = tests.slice(0, 6).map((x) => `${x.title} (${x.category})`).join('; ');
    const reply = await askAI(next, catalog);
    push([...next, { role: 'assistant', content: reply, at: nowISO() }]);
    setBusy(false);
  };

  if (crisis)
    return (
      <>
        <Top title="Срочная помощь" onBack={() => setCrisis(false)} />
        <div className="body stack">
          <div className="crisis">
            <h2>Это важнее, чем приложение</h2>
            <p style={{ marginTop: 10, fontSize: 15 }}>Судя по вашему сообщению, вам сейчас очень тяжело. Пожалуйста, свяжитесь с человеком, который может помочь прямо сейчас.</p>
          </div>
          <div className="card"><div className="eyebrow">Казахстан</div>
            <p style={{ marginTop: 8, fontSize: 15 }}>112 — единая экстренная служба<br />150 — телефон доверия для детей и молодёжи<br />Психологическая служба вашего вуза</p></div>
          <p className="tiny">Если рядом есть человек, которому вы доверяете, — расскажите ему. Не оставайтесь одни.</p>
          <button className="btn quiet" onClick={() => setCrisis(false)}>Я посмотрел(а) контакты</button>
        </div>
      </>
    );

  return (
    <>
      <Top title="Поддержка" />
      <div className="body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="tiny" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
          Это ИИ-собеседник. Он не ставит диагнозы и не заменяет психолога. При угрозе жизни звоните 112.
        </p>
        {msgs.length === 0 && (
          <div className="stack">
            <p className="muted">С чего начнём?</p>
            {["Не могу заставить себя учиться", "Тревожно перед сессией", "Плохо сплю уже неделю"].map((s) => (
              <button key={s} className="opt" onClick={() => setText(s)}>{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, k) => <div key={k} className={"msg " + (m.role === "user" ? "me" : "ai")}>{m.content}</div>)}
        {busy && <div className="msg ai">…</div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 20px 14px", borderTop: "1px solid var(--line)", background: "var(--card)" }}>
        <div className="row">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Напишите, что происходит" />
          <button className="btn sm" style={{ width: "auto" }} onClick={send} disabled={busy}>→</button>
        </div>
      </div>
    </>
  );
}
