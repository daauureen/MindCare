import React, { useState } from 'react';
import { uid, nowISO, fmt, hoursLeft } from '../lib/utils.js';
import { Area, Top, Empty, Profile } from '../components/common.jsx';
import { DocItem } from '../components/documents.jsx';

// Панель администратора: заявки, пользователи, модерация тестов, статистика

export function AdminApp({ me, db, commit, route, go, notify, logout }) {
  const pending = db.users.filter((u) => u.role === "PSYCHOLOGIST" && ["PENDING", "NEEDS_MORE_DOCS"].includes(u.profile?.verificationStatus));

  const TITLES = { APPROVED: "Заявка подтверждена", REJECTED: "Заявка отклонена", NEEDS_MORE_DOCS: "Нужны дополнительные документы" };
  const ACTIONS = { APPROVED: "APPROVE_PSYCHOLOGIST", REJECTED: "REJECT_PSYCHOLOGIST", NEEDS_MORE_DOCS: "REQUEST_DOCUMENTS" };

  const decide = (userId, status, reason) => {
    commit({
      ...db,
      users: db.users.map((u) => u.id === userId ? {
        ...u, profile: {
          ...u.profile, verificationStatus: status, verifiedAt: nowISO(),
          rejectionReason: status === "REJECTED" ? reason : null,
          adminComment: status === "NEEDS_MORE_DOCS" ? reason : null,
        },
      } : u),
      notifications: [{ id: uid(), userId, type: "VERIFICATION_" + status, title: TITLES[status], createdAt: nowISO(), read: false }, ...db.notifications],
      audit: [{ id: uid(), adminId: me.id, action: ACTIONS[status], targetId: userId, reason: reason || null, at: nowISO() }, ...db.audit],
    });
    notify(TITLES[status]);
    go("queue");
  };

  const hideTest = (testId) => {
    const reason = window.prompt("Причина скрытия теста");
    if (!reason) return;
    commit({
      ...db, tests: db.tests.map((t) => t.id === testId ? { ...t, status: "HIDDEN", hiddenReason: reason } : t),
      audit: [{ id: uid(), adminId: me.id, action: "HIDE_TEST", targetId: testId, reason, at: nowISO() }, ...db.audit],
    });
    notify("Тест скрыт");
  };

  const blockUser = (userId) => {
    const u = db.users.find((x) => x.id === userId);
    const reason = u.status === "ACTIVE" ? window.prompt("Причина блокировки") : null;
    if (u.status === "ACTIVE" && !reason) return;
    commit({
      ...db, users: db.users.map((x) => x.id === userId ? { ...x, status: x.status === "ACTIVE" ? "BLOCKED" : "ACTIVE", blockedReason: reason } : x),
      audit: [{ id: uid(), adminId: me.id, action: u.status === "ACTIVE" ? "BLOCK_USER" : "UNBLOCK_USER", targetId: userId, reason, at: nowISO() }, ...db.audit],
    });
  };

  let content;
  if (route.n === "request") {
    const u = db.users.find((x) => x.id === route.id);
    content = <AdminRequest u={u} go={go} decide={decide} />;
  } else if (route.n === "users") {
    content = (
      <>
        <Top title="Пользователи" />
        <div className="body stack">
          {db.users.filter((u) => u.role !== "ADMIN").map((u) => (
            <div key={u.id} className="card between">
              <div><h3>{u.fullName}</h3><p className="tiny" style={{ marginTop: 4 }}>{u.email} · {u.role === "STUDENT" ? "студент" : "психолог"}{u.status === "BLOCKED" ? " · заблокирован" : ""}</p></div>
              <button className="btn quiet sm" onClick={() => blockUser(u.id)}>{u.status === "ACTIVE" ? "Заблокировать" : "Снять блок"}</button>
            </div>
          ))}
        </div>
      </>
    );
  } else if (route.n === "tests") {
    content = (
      <>
        <Top title="Тесты" />
        <div className="body stack">
          {db.tests.map((t) => (
            <div key={t.id} className="card">
              <div className="between"><h3>{t.title}</h3><span className="tag grey">{t.status}</span></div>
              <p className="tiny" style={{ marginTop: 6 }}>{db.users.find((u) => u.id === t.authorId)?.fullName} · {t.questions.length} вопросов</p>
              {t.status === "PUBLISHED" && <button className="btn quiet sm" style={{ marginTop: 10 }} onClick={() => hideTest(t.id)}>Скрыть</button>}
            </div>
          ))}
        </div>
      </>
    );
  } else if (route.n === "stats") {
    const st = {
      "Студентов": db.users.filter((u) => u.role === "STUDENT").length,
      "Заявок психологов": db.users.filter((u) => u.role === "PSYCHOLOGIST").length,
      "Подтверждено психологов": db.users.filter((u) => u.profile?.verificationStatus === "APPROVED").length,
      "Опубликовано тестов": db.tests.filter((t) => t.status === "PUBLISHED").length,
      "Завершено тестов": db.attempts.filter((a) => a.status === "COMPLETED").length,
      "Отправлено психологам": db.attempts.filter((a) => a.shared).length,
      "Просмотрено психологами": db.attempts.filter((a) => a.reviewStatus && a.reviewStatus !== "NEW").length,
    };
    const completed = db.attempts.filter((a) => a.status === "COMPLETED").length;
    const shared = db.attempts.filter((a) => a.shared).length;
    content = (
      <>
        <Top title="Статистика" />
        <div className="body stack">
          {Object.entries(st).map(([k, v]) => (
            <div key={k} className="card between"><span style={{ fontSize: 14 }}>{k}</span>
              <span style={{ fontFamily: "Spectral, serif", fontSize: 24 }}>{v}</span></div>
          ))}
          <div className="card"><div className="eyebrow">Доля отправленных результатов</div>
            <p style={{ fontFamily: "Spectral, serif", fontSize: 34, marginTop: 4 }}>{completed ? Math.round((shared / completed) * 100) : 0}%</p>
            <p className="tiny">Целевой ориентир пилота — не ниже 30%.</p></div>
          <div className="divider" />
          <div className="eyebrow">Журнал действий</div>
          {db.audit.length === 0 && <p className="tiny">Пока пусто.</p>}
          {db.audit.slice(0, 12).map((l) => (
            <p key={l.id} className="tiny">{fmt(l.at)} · {l.action}{l.reason ? ` · ${l.reason}` : ""}</p>
          ))}
        </div>
      </>
    );
  } else if (route.n === "profile") {
    content = <Profile me={me} go={go} logout={logout} />;
  } else {
    content = (
      <>
        <Top title="Заявки психологов" />
        <div className="body stack">
          {pending.length === 0 && <Empty>Новых заявок нет.</Empty>}
          {pending.map((u) => {
            const left = hoursLeft(u.profile.submittedAt || nowISO());
            return (
              <button key={u.id} className="card" style={{ textAlign: "left", width: "100%", cursor: "pointer" }} onClick={() => go("request", { id: u.id })}>
                <div className="between"><h3>{u.fullName}</h3>
                  <span className={"tag " + (left <= 4 ? "warn" : "")}>{u.profile.verificationStatus === "NEEDS_MORE_DOCS" ? "ждём документы" : left > 0 ? `${left} ч на решение` : "срок вышел"}</span></div>
                <p className="tiny" style={{ marginTop: 8 }}>
                  {u.profile.specializations.join(" · ")} · {u.profile.documents.length} документ(ов)
                  {!u.emailVerifiedAt && " · email не подтверждён"}
                </p>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  const tab = ["queue", "users", "tests", "stats", "profile"].includes(route.n) ? route.n : "queue";
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>{content}</div>
      <div className="nav">
        {[["queue", "◉", "Заявки"], ["users", "◐", "Люди"], ["tests", "▤", "Тесты"], ["stats", "◫", "Статистика"], ["profile", "◇", "Я"]].map(([k, d, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => go(k)}><span className="dot">{d}</span>{l}</button>
        ))}
      </div>
    </>
  );
}

export function AdminRequest({ u, go, decide }) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState(null); // 'reject' | 'docs'
  if (!u) return <Empty>Заявка не найдена</Empty>;
  const p = u.profile;
  const left = hoursLeft(p.submittedAt || nowISO());
  return (
    <>
      <Top title="Заявка" onBack={() => go("queue")} />
      <div className="body stack">
        <h1>{u.fullName}</h1>
        <p className="tiny">{u.email} · {u.phone}</p>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className={"tag " + (left <= 4 ? "warn" : "")}>{left > 0 ? `решение через ${left} ч` : "срок 24 ч истёк"}</span>
          <span className={"tag " + (u.emailVerifiedAt ? "" : "warn")}>{u.emailVerifiedAt ? "email подтверждён" : "email не подтверждён"}</span>
        </div>
        <div className="card"><div className="eyebrow">Образование</div><p style={{ marginTop: 8, fontSize: 14 }}>{p.education}</p></div>
        <div className="card"><div className="eyebrow">Специализация и опыт</div><p style={{ marginTop: 8, fontSize: 14 }}>{p.specializations.join(" · ")} · {p.experienceYears} лет</p></div>
        {p.about && <div className="card"><div className="eyebrow">О себе</div><p style={{ marginTop: 8, fontSize: 14 }}>{p.about}</p></div>}
        <div className="eyebrow">Документы ({p.documents.length})</div>
        {p.documents.length === 0 && <p className="tiny">Документы не приложены.</p>}
        {p.documents.map((d) => <DocItem key={d.id} doc={d} />)}
        {!p.documents.some((d) => d.type === "DIPLOMA") && (
          <p className="tiny" style={{ color: "var(--ochre)" }}>Диплома в заявке нет — запросите документы, прежде чем подтверждать.</p>
        )}
        <div className="divider" />
        {mode === null && (
          <>
            <button className="btn" onClick={() => decide(u.id, "APPROVED")}>Подтвердить</button>
            <button className="btn quiet" onClick={() => { setMode("docs"); setReason(""); }}>Запросить документы</button>
            <button className="btn quiet" onClick={() => { setMode("reject"); setReason(""); }}>Отклонить</button>
          </>
        )}
        {mode === "docs" && (
          <>
            <Area label="Что нужно догрузить (увидит психолог)" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Диплом нечитаемый, загрузите разворот целиком" />
            <button className="btn" disabled={!reason.trim()} onClick={() => decide(u.id, "NEEDS_MORE_DOCS", reason)}>Отправить запрос</button>
            <button className="btn quiet" onClick={() => setMode(null)}>Отмена</button>
          </>
        )}
        {mode === "reject" && (
          <>
            <Area label="Причина отклонения (увидит психолог)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn warn" disabled={!reason.trim()} onClick={() => decide(u.id, "REJECTED", reason)}>Отклонить заявку</button>
            <button className="btn quiet" onClick={() => setMode(null)}>Отмена</button>
          </>
        )}
      </div>
    </>
  );
}
