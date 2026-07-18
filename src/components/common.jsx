import React from 'react';

// Мелкие переиспользуемые элементы интерфейса

export const Field = ({ label, ...p }) => (
  <label className="f"><span>{label}</span><input {...p} /></label>
);
export const Area = ({ label, ...p }) => (
  <label className="f"><span>{label}</span><textarea {...p} /></label>
);
export const Top = ({ title, onBack, right }) => (
  <div className="top">
    {onBack && <button className="back" onClick={onBack} aria-label="Назад">←</button>}
    <h2 style={{ flex: 1 }}>{title}</h2>
    {right}
  </div>
);
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function ScoreScale({ ranges, score, activeId }) {
  return (
    <div className="scale">
      <div className="bar">
        {ranges.map((r) => (
          <div key={r.id} className={"seg" + (r.id === activeId ? " here" : "")}>{r.title}</div>
        ))}
      </div>
      <div className="ends">
        <span className="tiny">{ranges[0].min} баллов</span>
        <span className="tiny" style={{ fontWeight: 600, color: "var(--ink)" }}>ваш результат: {score}</span>
        <span className="tiny">{ranges[ranges.length - 1].max}</span>
      </div>
    </div>
  );
}

export function Profile({ me, go, logout, extra }) {
  return (
    <>
      <Top title="Профиль" />
      <div className="body stack">
        <div className="card">
          <h3>{me.fullName}</h3>
          <p className="tiny" style={{ marginTop: 6 }}>{me.email}</p>
          <p className="tiny">{{ STUDENT: "Студент", PSYCHOLOGIST: "Психолог", ADMIN: "Администратор" }[me.role]}</p>
        </div>
        {extra}
        <div className="divider" />
        <p className="tiny">Политика конфиденциальности · Пользовательское соглашение</p>
        <button className="btn quiet" onClick={logout}>Выйти</button>
      </div>
    </>
  );
}
