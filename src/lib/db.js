import { supabase, DOC_BUCKET } from './supabase.js';
import { uid, nowISO, code6, DISCLAIMER } from './utils.js';

/**
 * Слой данных поверх Supabase.
 * Заменяет прежний localStorage-слой: читает и пишет через Supabase JS-клиент.
 * Экраны работают с тем же объектом `db` (users, tests, attempts, notifications, audit),
 * но мутации идут отдельными функциями, а `loadDB()` собирает снимок для рендера.
 */

// ---------- чтение: снимок всей базы для рендера ----------
export async function loadDB() {
  const [users, tests, attempts, notifications, audit, profiles, docs, questions, options, ranges, answers] = await Promise.all([
    supabase.from('users').select('*').then((r) => r.data || []),
    supabase.from('tests').select('*').then((r) => r.data || []),
    supabase.from('test_attempts').select('*').then((r) => r.data || []),
    supabase.from('notifications').select('*').then((r) => r.data || []),
    supabase.from('audit').select('*').then((r) => r.data || []),
    supabase.from('psychologist_profiles').select('*').then((r) => r.data || []),
    supabase.from('documents').select('*').then((r) => r.data || []),
    supabase.from('questions').select('*').then((r) => r.data || []),
    supabase.from('answer_options').select('*').then((r) => r.data || []),
    supabase.from('score_ranges').select('*').then((r) => r.data || []),
    supabase.from('attempt_answers').select('*').then((r) => r.data || []),
  ]);

  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id, p]));
  const docsByOwner = docs.reduce((acc, d) => { (acc[d.owner_id] ||= []).push(d); return acc; }, {});
  const qsByTest = questions.reduce((acc, q) => { (acc[q.test_id] ||= []).push(q); return acc; }, {});
  const optsByQ = options.reduce((acc, o) => { (acc[o.question_id] ||= []).push(o); return acc; }, {});
  const rangesByTest = ranges.reduce((acc, r) => { (acc[r.test_id] ||= []).push(r); return acc; }, {});
  const answersByAttempt = answers.reduce((acc, a) => { (acc[a.attempt_id] ||= []).push(a); return acc; }, {});

  const usersFull = users.map((u) => {
    if (u.role !== 'PSYCHOLOGIST') return u;
    const p = profByUser[u.id] || {};
    return { ...u, profile: { ...p, documents: docsByOwner[u.id] || [] } };
  });

  const testsFull = tests.map((t) => ({
    ...t,
    minutes: t.estimated_minutes,
    questions: (qsByTest[t.id] || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map((q) => ({
        ...q,
        options: (optsByQ[q.id] || []).sort((a, b) => a.order_index - b.order_index).map((o) => ({ ...o })),
      })),
    ranges: (rangesByTest[t.id] || []).map((r) => ({
      ...r, text: r.result_text, rec: r.recommendation,
    })),
  }));

  const attemptsFull = attempts.map((a) => ({
    ...a,
    answers: (answersByAttempt[a.id] || []).sort((x, y) => x.answered_at?.localeCompare(y.answered_at)),
  }));

  return { users: usersFull, tests: testsFull, attempts: attemptsFull, notifications, audit, chats: {} };
}

// ---------- сессия (остаётся в localStorage — это не данные) ----------
const SESSION_KEY = 'mindcare:session:v3';
export async function loadSession() {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export async function saveSession(s) {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); return true; } catch { return false; }
}

// ---------- пользователи ----------
export async function findUserByEmail(email) {
  const { data } = await supabase.from('users').select('*').eq('email', email.trim().toLowerCase()).maybeSingle();
  return data;
}

export async function getUser(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (data && data.role === 'PSYCHOLOGIST') {
    const { data: p } = await supabase.from('psychologist_profiles').select('*').eq('user_id', id).maybeSingle();
    const { data: docs } = await supabase.from('documents').select('*').eq('owner_id', id);
    return { ...data, profile: { ...(p || {}), documents: docs || [] } };
  }
  return data;
}

export async function createStudent({ fullName, email, password }) {
  const row = {
    email: email.trim().toLowerCase(), password, role: 'STUDENT', full_name: fullName,
    status: 'ACTIVE', email_code: code6(), email_verified_at: null,
  };
  const { data, error } = await supabase.from('users').insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPsychologist({ fullName, email, phone, password, education, specializations, experienceYears, about, documents }) {
  const userId = uid();
  const userRow = {
    id: userId, email: email.trim().toLowerCase(), password, role: 'PSYCHOLOGIST',
    full_name: fullName, phone, status: 'ACTIVE', email_code: code6(), email_verified_at: null,
  };
  const profileRow = {
    user_id: userId, education, specializations, experience_years: Number(experienceYears) || 0,
    about, verification_status: 'PENDING', submitted_at: nowISO(),
  };
  const { error: ue } = await supabase.from('users').insert(userRow);
  if (ue) throw new Error(ue.message);
  const { error: pe } = await supabase.from('psychologist_profiles').insert(profileRow);
  if (pe) throw new Error(pe.message);
  if (documents?.length) {
    const docRows = documents.map((d) => ({
      id: d.id, owner_id: userId, type: d.type, file_name: d.fileName,
      mime_type: d.mimeType, size_bytes: d.size, storage_key: d.storageKey,
    }));
    const { error: de } = await supabase.from('documents').insert(docRows);
    if (de) throw new Error(de.message);
  }
  return getUser(userId);
}

export async function setVerified(userId) {
  const { error } = await supabase.from('users').update({ email_verified_at: nowISO(), email_code: null }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function resendCode(userId) {
  const { error } = await supabase.from('users').update({ email_code: code6() }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function updateProfile(userId, patch) {
  const { error } = await supabase.from('psychologist_profiles').update(patch).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function updateProfileDocuments(userId, documents) {
  const { data: existing } = await supabase.from('documents').select('id').eq('owner_id', userId);
  const keep = new Set(documents.map((d) => d.id));
  const toDelete = (existing || []).filter((d) => !keep.has(d.id)).map((d) => d.id);
  if (toDelete.length) {
    await supabase.from('documents').delete().in('id', toDelete);
    await supabase.storage.from(DOC_BUCKET).remove(toDelete);
  }
  const toInsert = documents.filter((d) => !existing?.some((e) => e.id === d.id));
  if (toInsert.length) {
    await supabase.from('documents').insert(toInsert.map((d) => ({
      id: d.id, owner_id: userId, type: d.type, file_name: d.fileName,
      mime_type: d.mimeType, size_bytes: d.size, storage_key: d.storageKey,
    })));
  }
}

// ---------- уведомления ----------
export async function createNotification(userId, type, title) {
  await supabase.from('notifications').insert({ user_id: userId, type, title, read: false, created_at: nowISO() });
}

// ---------- админ: верификация ----------
export async function adminDecide(userId, status, reason, adminId) {
  const patch = { verification_status: status, verified_at: nowISO(), verified_by: adminId };
  if (status === 'REJECTED') patch.rejection_reason = reason;
  else patch.rejection_reason = null;
  if (status === 'NEEDS_MORE_DOCS') patch.admin_comment = reason;
  else patch.admin_comment = null;
  const { error } = await supabase.from('psychologist_profiles').update(patch).eq('user_id', userId);
  if (error) throw new Error(error.message);
  const titles = { APPROVED: 'Заявка подтверждена', REJECTED: 'Заявка отклонена', NEEDS_MORE_DOCS: 'Нужны дополнительные документы' };
  await createNotification(userId, 'VERIFICATION_' + status, titles[status]);
  const actions = { APPROVED: 'APPROVE_PSYCHOLOGIST', REJECTED: 'REJECT_PSYCHOLOGIST', NEEDS_MORE_DOCS: 'REQUEST_DOCUMENTS' };
  await supabase.from('audit').insert({ admin_id: adminId, action: actions[status], target_id: userId, reason: reason || null, created_at: nowISO() });
}

export async function hideTest(testId, reason, adminId) {
  const { error } = await supabase.from('tests').update({ status: 'HIDDEN', hidden_reason: reason }).eq('id', testId);
  if (error) throw new Error(error.message);
  await supabase.from('audit').insert({ admin_id: adminId, action: 'HIDE_TEST', target_id: testId, reason, created_at: nowISO() });
}

export async function blockUser(userId, adminId, reason) {
  const { data: u } = await supabase.from('users').select('status').eq('id', userId).maybeSingle();
  const willBlock = u?.status === 'ACTIVE';
  const { error } = await supabase.from('users').update({ status: willBlock ? 'BLOCKED' : 'ACTIVE', blocked_reason: willBlock ? reason : null }).eq('id', userId);
  if (error) throw new Error(error.message);
  await supabase.from('audit').insert({ admin_id: adminId, action: willBlock ? 'BLOCK_USER' : 'UNBLOCK_USER', target_id: userId, reason, created_at: nowISO() });
}

// ---------- тесты ----------
export async function saveTest(test, { isNew }) {
  const row = {
    id: test.id, author_id: test.authorId, title: test.title, description: test.description,
    category: test.category, instruction: test.instruction, estimated_minutes: Number(test.minutes) || 5,
    disclaimer: test.disclaimer, status: test.status, published_at: test.status === 'PUBLISHED' ? nowISO() : test.publishedAt,
    updated_at: nowISO(),
  };
  if (isNew) {
    row.created_at = nowISO();
    const { error } = await supabase.from('tests').insert(row);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('tests').update(row).eq('id', test.id);
    if (error) throw new Error(error.message);
    // пересоздаём дочерние элементы
    const { data: oldQs } = await supabase.from('questions').select('id').eq('test_id', test.id);
    if (oldQs?.length) await supabase.from('questions').delete().in('id', oldQs.map((q) => q.id));
  }
  for (let qi = 0; qi < test.questions.length; qi++) {
    const q = test.questions[qi];
    const qRow = { id: q.id, test_id: test.id, text: q.text, order_index: qi };
    const { error: qe } = await supabase.from('questions').insert(qRow);
    if (qe) throw new Error(qe.message);
    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      const { error: oe } = await supabase.from('answer_options').insert({
        id: o.id, question_id: q.id, text: o.text, score: Number(o.score) || 0, order_index: oi,
      });
      if (oe) throw new Error(oe.message);
    }
  }
  // диапазоны: удаляем старые и вставляем новые
  const { data: oldR } = await supabase.from('score_ranges').select('id').eq('test_id', test.id);
  if (oldR?.length) await supabase.from('score_ranges').delete().in('id', oldR.map((r) => r.id));
  for (const r of test.ranges) {
    const { error: re } = await supabase.from('score_ranges').insert({
      id: r.id, test_id: test.id, min_score: Number(r.min) || 0, max_score: Number(r.max) || 0,
      title: r.title, result_text: r.text, recommendation: r.rec,
    });
    if (re) throw new Error(re.message);
  }
}

export async function setTestStatus(testId, status) {
  const patch = { status, updated_at: nowISO() };
  if (status === 'PUBLISHED') patch.published_at = nowISO();
  const { error } = await supabase.from('tests').update(patch).eq('id', testId);
  if (error) throw new Error(error.message);
}

// ---------- попытки ----------
export async function completeAttempt(attempt) {
  const { error } = await supabase.from('test_attempts').insert({
    id: attempt.id, student_id: attempt.studentId, student_name: attempt.studentName,
    test_id: attempt.testId, test_title: attempt.testTitle, psychologist_id: attempt.psychologistId,
    status: 'COMPLETED', total_score: attempt.totalScore, range_id: attempt.rangeId,
    started_at: attempt.startedAt, completed_at: attempt.completedAt,
    shared: false, review_status: null, note: '',
  });
  if (error) throw new Error(error.message);
  const rows = attempt.answers.map((a) => ({
    attempt_id: attempt.id, question_id: a.questionId, question_text: a.questionText,
    option_id: a.optionId, option_text: a.optionText, score: a.score,
  }));
  const { error: ae } = await supabase.from('attempt_answers').insert(rows);
  if (ae) throw new Error(ae.message);
}

export async function shareAttempt(attemptId, psychId) {
  const { error } = await supabase.from('test_attempts').update({
    shared: true, shared_at: nowISO(), review_status: 'NEW', revoked_at: null,
  }).eq('id', attemptId);
  if (error) throw new Error(error.message);
  await createNotification(psychId, 'RESULT_SHARED', 'Вам отправлен новый результат');
}

export async function revokeAttempt(attemptId) {
  const { error } = await supabase.from('test_attempts').update({
    shared: false, review_status: null, revoked_at: nowISO(),
  }).eq('id', attemptId);
  if (error) throw new Error(error.message);
}

export async function setAttemptReview(attemptId, status, note) {
  const patch = { review_status: status, note };
  if (status && status !== 'NEW') patch.reviewed_at = nowISO();
  const { error } = await supabase.from('test_attempts').update(patch).eq('id', attemptId);
  if (error) throw new Error(error.message);
}

export async function markAttemptViewed(attemptId, studentId) {
  const { error } = await supabase.from('test_attempts').update({ review_status: 'VIEWED', reviewed_at: nowISO() }).eq('id', attemptId);
  if (error) throw new Error(error.message);
  await createNotification(studentId, 'RESULT_VIEWED', 'Психолог посмотрел ваш результат');
}

// ---------- AI-чат ----------
export async function loadChat(userId) {
  const { data: conv } = await supabase.from('ai_conversations').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!conv) return [];
  const { data: msgs } = await supabase.from('ai_messages').select('role,content,created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true });
  return (msgs || []).map((m) => ({ role: m.role, content: m.content, at: m.created_at }));
}

export async function appendMessage(userId, role, content, riskLevel = 'NONE') {
  let { data: conv } = await supabase.from('ai_conversations').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!conv) {
    const { data: c, error } = await supabase.from('ai_conversations').insert({ user_id: userId, created_at: nowISO(), last_message_at: nowISO() }).select().single();
    if (error) throw new Error(error.message);
    conv = c;
  } else {
    await supabase.from('ai_conversations').update({ last_message_at: nowISO() }).eq('id', conv.id);
  }
  const { error } = await supabase.from('ai_messages').insert({
    conversation_id: conv.id, role, content, risk_level: riskLevel, created_at: nowISO(),
  });
  if (error) throw new Error(error.message);
}

// ---------- документы (Storage) ----------
export async function uploadDocument(id, file) {
  const { error } = await supabase.storage.from(DOC_BUCKET).upload(id, file, { upsert: true });
  if (error) throw new Error(error.message);
}

export async function documentUrl(storageKey) {
  if (!storageKey) return null;
  const { data } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(storageKey, 300);
  return data?.signedUrl || null;
}
