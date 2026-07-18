import React, { useState, useEffect } from 'react';
import { uid, nowISO, fmt, CATEGORIES, DISCLAIMER, DOC_LABEL, hoursLeft } from '../lib/utils.js';
import { Field, Area, Top, Empty, ScoreScale, Profile } from '../components/common.jsx';
import { DocUploader } from '../components/documents.jsx';
import { saveTest, setTestStatus, setAttemptReview, markAttemptViewed, updateProfile, updateProfileDocuments } from '../lib/db.js';

// Кабинет психолога: верификация, конструктор тестов, полученные результаты.
// Данные в Supabase; после каждой мутации — reload() снимка.

export function PsychApp({ me, db, reload, route, go, notify, logout }) {
  const status = me.profile?.verification_status;
  if (status !== "APPROVED") return <PendingScreen me={me} reload={reload} logout={logout} notify={notify} />;

  const myTests = db.tests.filter((t) => t.author_id === me.id);
  const results = db.attempts.filter((a) => a.psychologist_id === me.id && a.shared);

  let content;
  if (route.n === "editor") content = <TestEditor me={me} reload={reload} testId={route.id} go={go} notify={notify} db={db} />;
  else if (route.n === "result-detail") content = <ResultDetail me={me} db={db} reload={reload} id={route.id} go={go} notify={notify} />;
  else if (route.n === "results") content = <ResultsList results={results} go={go} />;
  else if (route.n === "tests") content = <MyTests tests={myTests} reload={reload} go={go} notify={notify} />;
  else if (route.n === "profile") content = <Profile me={me} go={go} logout={logout} />;
  else content = <PsychHome me={me} tests={myTests} results={results} go={go} />;

  const tab = ["home", "tests", "results", "profile"].includes(route.n) ? route.n : "home";
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{content}</div>
      <div className="nav">
        {[["home", "◈", "Главная"], ["tests", "▤", "Мои тесты"], ["results", "◫", "Результаты"], ["profile", "◇", "Я"]].map(([k, d, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}><span className="dot">{d}</span>{l}</button>
        ))}
      </div>
    </>
  );
}

export function PendingScreen({ me, reload, logout, notify }) {
  const p = me.profile;
  const s = p.verification_status;
  const [docs, setDocs] = useState(p.documents || []);
  const [editing, setEditing] = useState(false);

  const saveDocs = async (next) => {
    setDocs(next);
    await updateProfileDocuments(me.id, next);
    await reload();
  };

  const resubmit = async () => {
    await updateProfile(me.id, {
      documents: docs, verification_status: 'PENDING', submitted_at: nowISO(),
      rejection_reason: null, admin_comment: null,
    });
    setEditing(false);
    await reload();
    notify("Заявка отправлена повторно");
  };

  const left = hoursLeft(p.submitted_at || new Date().toISOString());

  return (
    <div className="body stack" style={{ paddingTop: 40 }}>
      {s === "PENDING" && (
        <>
          <span className="tag">На проверке</span>
          <h1>Заявка отправлена</h1>
          <p className="muted">
            Администратор проверит ваши документы <b>в течение 24 часов</b>. Пока заявка на рассмотрении, создавать тесты и получать результаты студентов нельзя.
          </p>
          <div className="card">
            <div className="eyebrow">Осталось примерно</div>
            <p style={{ fontFamily: "Spectral, serif", fontSize: 40, lineHeight: 1.1, marginTop: 4 }}>{left} ч</p>
            <p className="tiny">Отправлено {fmt(p.submitted_at)}. Решение придёт уведомлением на этот экран.</p>
          </div>
        </>
      )}

      {s === "NEEDS_MORE_DOCS" && (
        <>
          <span className="tag warn">Нужны документы</span>
          <h1>Администратор запросил документы</h1>
          <div className="card"><div className="eyebrow">Комментарий</div>
            <p style={{ marginTop: 8, fontSize: 14 }}>{p.admin_comment}</p></div>
          <p className="muted">Догрузите то, что просят, и отправьте заявку снова — на повторную проверку тоже отводится 24 часа.</p>
        </>
      )}

      {s === "REJECTED" && (
        <>
          <span className="tag warn">Отклонено</span>
          <h1>Заявка отклонена</h1>
          <div className="card"><div className="eyebrow">Причина</div>
            <p style={{ marginTop: 8, fontSize: 14 }}>{p.rejection_reason}</p></div>
          <p className="muted">Вы можете исправить документы и подать заявку заново.</p>
        </>
      )}

      <div className="divider" />
      <div className="between">
        <div className="eyebrow">Ваши документы ({docs.length})</div>
        {s !== "PENDING" && !editing && <button className="link" onClick={() => setEditing(true)}>Изменить</button>}
      </div>

      {!editing && docs.map((d) => (
        <div key={d.id} className="card">
          <p style={{ fontSize: 14 }}>{d.file_name || d.fileName}</p>
          <p className="tiny">{DOC_LABEL[d.type] || d.type}{(d.size_bytes || d.size) ? ` · ${(d.size_bytes || d.size) > 1024 * 1024 ? ((d.size_bytes || d.size) / 1024 / 1024).toFixed(1) + " МБ" : Math.round((d.size_bytes || d.size) / 1024) + " КБ"}` : ""}</p>
        </div>
      ))}

      {editing && (
        <>
          <DocUploader docs={docs} setDocs={saveDocs} />
          <button className="btn" disabled={!docs.some((d) => d.type === "DIPLOMA")} onClick={resubmit}>Отправить заявку повторно</button>
          <button className="btn quiet" onClick={() => setEditing(false)}>Отмена</button>
        </>
      )}

      <div className="divider" />
      <p className="tiny">Аккаунт: {me.email}</p>
      <button className="btn quiet" onClick={logout}>Выйти</button>
    </div>
  );
}

export function PsychHome({ me, tests, results, go }) {
  const fresh = results.filter((r) => r.review_status === "NEW").length;
  return (
    <>
      <div className="top"><div style={{ flex: 1 }}>
        <div className="eyebrow">Кабинет психолога</div><h2 style={{ marginTop: 4 }}>{me.full_name}</h2></div></div>
      <div className="body stack">
        <button className="card" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => go("results")}>
          <div className="eyebrow">Новых результатов</div>
          <p style={{ fontFamily: "Spectral, serif", fontSize: 40, lineHeight: 1.1, marginTop: 4 }}>{fresh}</p>
          <p className="tiny">всего получено: {results.length}</p>
        </button>
        <button className="card" style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => go("tests")}>
          <div className="eyebrow">Мои тесты</div>
          <p style={{ fontFamily: "Spectral, serif", fontSize: 40, lineHeight: 1.1, marginTop: 4 }}>{tests.filter((t) => t.status === "PUBLISHED").length}</p>
          <p className="tiny">черновиков: {tests.filter((t) => t.status === "DRAFT").length}</p>
        </button>
        <button className="btn" onClick={() => go("editor", { id: "new" })}>Создать тест</button>
      </div>
    </>
  );
}

export function MyTests({ tests, reload, go, notify }) {
  const setStatus = async (id, status) => {
    await setTestStatus(id, status);
    await reload();
    notify(status === "PUBLISHED" ? "Тест опубликован" : "Тест в архиве");
  };
  return (
    <>
      <Top title="Мои тесты" right={<button className="btn sm" style={{ width: "auto" }} onClick={() => go("editor", { id: "new" })}>+ Тест</button>} />
      <div className="body stack">
        {tests.length === 0 && <Empty>Тестов пока нет.<br />Создайте первый — студенты увидят его в ленте.</Empty>}
        {tests.map((t) => (
          <div key={t.id} className="card">
            <div className="between">
              <h3 style={{ flex: 1 }}>{t.title || "Без названия"}</h3>
              <span className={"tag " + (t.status === "PUBLISHED" ? "" : t.status === "HIDDEN" ? "warn" : "grey")}>
                {{ DRAFT: "черновик", PUBLISHED: "опубликован", ARCHIVED: "архив", HIDDEN: "скрыт админом" }[t.status]}
              </span>
            </div>
            <p className="tiny" style={{ marginTop: 8 }}>{t.category} · {t.questions.length} вопросов</p>
            {t.hidden_reason && <p className="tiny" style={{ color: "var(--ochre)", marginTop: 6 }}>Причина: {t.hidden_reason}</p>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn quiet sm" onClick={() => go("editor", { id: t.id })}>Редактировать</button>
              {t.status === "DRAFT" && <button className="btn sm" onClick={() => setStatus(t.id, "PUBLISHED")}>Опубликовать</button>}
              {t.status === "PUBLISHED" && <button className="btn quiet sm" onClick={() => setStatus(t.id, "ARCHIVED")}>В архив</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TestEditor({ me, reload, testId, go, notify, db }) {
  const existing = db.tests.find((t) => t.id === testId);
  const [t, setT] = useState(
    existing || {
      id: uid(), authorId: me.id, title: "", description: "", category: CATEGORIES[0], instruction: "",
      minutes: 5, disclaimer: DISCLAIMER, status: "DRAFT", questions: [], ranges: [],
    }
  );
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value });

  const maxScore = t.questions.reduce((s, q) => s + Math.max(0, ...q.options.map((o) => Number(o.score) || 0)), 0);

  const addQ = () => setT({ ...t, questions: [...t.questions, { id: uid(), text: "", options: [{ id: uid(), text: "", score: 0 }, { id: uid(), text: "", score: 1 }] }] });
  const updQ = (qid, patch) => setT({ ...t, questions: t.questions.map((q) => q.id === qid ? { ...q, ...patch } : q) });
  const addOpt = (qid) => updQ(qid, { options: [...t.questions.find((q) => q.id === qid).options, { id: uid(), text: "", score: 0 }] });
  const updOpt = (qid, oid, patch) => updQ(qid, { options: t.questions.find((q) => q.id === qid).options.map((o) => o.id === oid ? { ...o, ...patch } : o) });
  const addRange = () => setT({ ...t, ranges: [...t.ranges, { id: uid(), min: 0, max: maxScore, title: "", text: "", rec: "" }] });
  const updRange = (rid, patch) => setT({ ...t, ranges: t.ranges.map((r) => r.id === rid ? { ...r, ...patch } : r) });

  const save = async (status) => {
    setBusy(true); setErr("");
    try {
      const clean = {
        ...t, status,
        questions: t.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o, score: Number(o.score) || 0 })) })),
        ranges: t.ranges.map((r) => ({ ...r, min: Number(r.min) || 0, max: Number(r.max) || 0 })),
        minutes: Number(t.minutes) || 5,
      };
      await saveTest(clean, { isNew: !existing });
      await reload();
      notify(status === "PUBLISHED" ? "Тест опубликован" : "Черновик сохранён");
      go("tests");
    } catch (e) { setErr(e.message || "Не удалось сохранить"); }
    setBusy(false);
  };

  const publishErrors = [];
  if (!t.title.trim()) publishErrors.push("нет названия");
  if (t.questions.length < 3) publishErrors.push("нужно минимум 3 вопроса");
  if (t.questions.some((q) => !q.text.trim() || q.options.length < 2 || q.options.some((o) => !o.text.trim()))) publishErrors.push("есть пустые вопросы или варианты");
  if (t.ranges.length < 2) publishErrors.push("нужно минимум 2 диапазона результата");
  if (t.ranges.some((r) => !r.title.trim() || !r.text.trim())) publishErrors.push("есть незаполненные диапазоны");

  return (
    <>
      <Top title={existing ? "Редактирование" : "Новый тест"} onBack={() => (step === 1 ? go("tests") : setStep(step - 1))} />
      <div className="body stack">
        <div className="progress"><i style={{ width: `${step * 33.3}%` }} /></div>

        {step === 1 && (
          <>
            <div className="eyebrow">Шаг 1 · о тесте</div>
            <Field label="Название" value={t.title} onChange={set("title")} placeholder="Уровень тревоги перед сессией" />
            <Area label="Описание для студента" value={t.description} onChange={set("description")} />
            <label className="f"><span>Категория</span>
              <select value={t.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <Area label="Инструкция" value={t.instruction} onChange={set("instruction")} placeholder="Как отвечать" />
            <Field label="Примерное время, мин" type="number" value={t.minutes} onChange={set("minutes")} />
            <button className="btn" onClick={() => setStep(2)}>Дальше · вопросы</button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="eyebrow">Шаг 2 · вопросы и баллы</div>
            {t.questions.map((q, qi) => (
              <div key={q.id} className="card stack">
                <div className="between"><span className="eyebrow">Вопрос {qi + 1}</span>
                  <button className="link" onClick={() => setT({ ...t, questions: t.questions.filter((x) => x.id !== q.id) })}>Удалить</button></div>
                <input value={q.text} onChange={(e) => updQ(q.id, { text: e.target.value })} placeholder="Текст вопроса" />
                {q.options.map((o) => (
                  <div key={o.id} className="row">
                    <input style={{ flex: 3 }} value={o.text} onChange={(e) => updOpt(q.id, o.id, { text: e.target.value })} placeholder="Вариант ответа" />
                    <input style={{ flex: 1 }} type="number" value={o.score} onChange={(e) => updOpt(q.id, o.id, { score: e.target.value })} />
                  </div>
                ))}
                <button className="link" onClick={() => addOpt(q.id)}>+ вариант ответа</button>
              </div>
            ))}
            <button className="btn ghost" onClick={addQ}>+ Вопрос</button>
            <p className="tiny">Максимально возможная сумма баллов: {maxScore}</p>
            <button className="btn" onClick={() => setStep(3)}>Дальше · результаты</button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="eyebrow">Шаг 3 · диапазоны результата</div>
            <p className="tiny">Разбейте шкалу от 0 до {maxScore} баллов на интервалы и напишите, что видит студент.</p>
            {t.ranges.map((r, i) => (
              <div key={r.id} className="card stack">
                <div className="between"><span className="eyebrow">Диапазон {i + 1}</span>
                  <button className="link" onClick={() => setT({ ...t, ranges: t.ranges.filter((x) => x.id !== r.id) })}>Удалить</button></div>
                <div className="row">
                  <label className="f" style={{ flex: 1 }}><span>от</span><input type="number" value={r.min} onChange={(e) => updRange(r.id, { min: e.target.value })} /></label>
                  <label className="f" style={{ flex: 1 }}><span>до</span><input type="number" value={r.max} onChange={(e) => updRange(r.id, { max: e.target.value })} /></label>
                </div>
                <input value={r.title} onChange={(e) => updRange(r.id, { title: e.target.value })} placeholder="Заголовок, напр. «Заметное напряжение»" />
                <textarea value={r.text} onChange={(e) => updRange(r.id, { text: e.target.value })} placeholder="Текст результата" />
                <textarea value={r.rec} onChange={(e) => updRange(r.id, { rec: e.target.value })} placeholder="Рекомендация (необязательно)" style={{ minHeight: 60 }} />
              </div>
            ))}
            <button className="btn ghost" onClick={addRange}>+ Диапазон</button>
            <div className="divider" />
            {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
            {publishErrors.length > 0 && <p className="tiny" style={{ color: "var(--ochre)" }}>Для публикации: {publishErrors.join(", ")}.</p>}
            <button className="btn" disabled={publishErrors.length > 0 || busy} onClick={() => save("PUBLISHED")}>{busy ? "Сохраняем…" : "Опубликовать"}</button>
            <button className="btn quiet" disabled={busy} onClick={() => save("DRAFT")}>Сохранить черновик</button>
          </>
        )}
      </div>
    </>
  );
}

export function ResultsList({ results, go }) {
  const [filter, setFilter] = useState(null);
  const list = results.filter((r) => !filter || r.review_status === filter);
  const L = { NEW: "новые", VIEWED: "просмотренные", NEEDS_CONSULT: "нужна консультация", CLOSED: "закрытые" };
  return (
    <>
      <Top title="Результаты" />
      <div className="body stack">
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <button className={"chip" + (!filter ? " on" : "")} onClick={() => setFilter(null)}>все</button>
          {Object.entries(L).map(([k, v]) => (
            <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(filter === k ? null : k)}>{v}</button>
          ))}
        </div>
        {list.length === 0 && <Empty>Здесь появятся результаты студентов,<br />которые согласились их отправить.</Empty>}
        {list.map((a) => (
          <button key={a.id} className="card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => go("result-detail", { id: a.id })}>
            <div className="between"><h3>{a.student_name}</h3>
              <span className={"tag " + (a.review_status === "NEEDS_CONSULT" ? "warn" : a.review_status === "NEW" ? "" : "grey")}>{L[a.review_status]}</span></div>
            <p className="tiny" style={{ marginTop: 8 }}>{a.test_title} · {a.total_score} баллов · {fmt(a.shared_at)}</p>
          </button>
        ))}
      </div>
    </>
  );
}

export function ResultDetail({ me, db, reload, id, go, notify }) {
  const a = db.attempts.find((x) => x.id === id);
  const test = db.tests.find((t) => t.id === a?.test_id);
  const [note, setNote] = useState(a?.note || "");
  useEffect(() => {
    if (a && a.review_status === "NEW") {
      (async () => {
        await markAttemptViewed(a.id, a.student_id);
        await reload();
      })();
    }
  }, []);
  if (!a || !test) return <Empty>Результат недоступен</Empty>;
  if (a.psychologist_id !== me.id || !a.shared) return <Empty>У вас нет доступа к этому результату.</Empty>;
  const range = test.ranges.find((r) => r.id === a.range_id);

  const setStatus = async (s) => {
    await setAttemptReview(a.id, s, note);
    await reload();
    notify("Статус обновлён");
  };

  return (
    <>
      <Top title={a.student_name} onBack={() => go("results")} />
      <div className="body stack">
        <div className="eyebrow">{a.test_title} · отправлено {fmt(a.shared_at)}</div>
        <h1>{range?.title}</h1>
        <ScoreScale ranges={test.ranges} score={a.total_score} activeId={a.range_id} />
        <div className="divider" />
        <div className="eyebrow">Ответы</div>
        {a.answers.map((ans, i) => (
          <div key={i} className="card">
            <p className="tiny">{i + 1}. {ans.question_text}</p>
            <div className="between" style={{ marginTop: 6 }}>
              <p style={{ fontSize: 14 }}>{ans.option_text}</p>
              <span className="tag grey">{ans.score}</span>
            </div>
          </div>
        ))}
        <div className="divider" />
        <Area label="Заметка (студент её не видит)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="eyebrow">Статус</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {[["VIEWED", "просмотрен"], ["NEEDS_CONSULT", "нужна консультация"], ["CLOSED", "закрыт"]].map(([k, l]) => (
            <button key={k} className={"chip" + (a.review_status === k ? " on" : "")} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
        <button className="btn" onClick={() => setStatus(a.review_status || "VIEWED")}>Сохранить заметку</button>
      </div>
    </>
  );
}
