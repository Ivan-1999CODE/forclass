import { createClient } from "@supabase/supabase-js";
import "./load-env.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export const persistenceEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);
export const persistenceStatus = {
  enabled: persistenceEnabled,
  hasUrl: Boolean(supabaseUrl),
  hasServiceRoleKey: Boolean(supabaseServiceRoleKey)
};

const supabase = persistenceEnabled
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

export async function saveSessionCreated(room) {
  if (!supabase) return;
  await reportError(
    supabase.from("quiz_sessions").upsert({
      id: room.sessionId,
      room_code: room.code,
      quiz_id: room.quiz.id,
      quiz_title: room.quiz.title,
      quiz_date: room.quiz.date,
      status: room.status,
      total_questions: room.quiz.questions.length,
      created_at: new Date(room.createdAt).toISOString()
    }),
    "save session"
  );
}

export async function saveSessionStatus(room) {
  if (!supabase) return;
  const patch = {
    status: room.status,
    current_question_index: room.currentQuestionIndex
  };
  if (room.status === "question" && room.currentQuestionIndex === 0 && !room.startedAt) {
    room.startedAt = Date.now();
    patch.started_at = new Date(room.startedAt).toISOString();
  }
  if (room.status === "results" || room.status === "finished") {
    patch.summary = buildSummaryForStorage(room);
    patch.responses = buildResponsesForStorage(room);
  }
  if (room.status === "finished") {
    patch.finished_at = new Date().toISOString();
  }
  await reportError(
    supabase.from("quiz_sessions").update(patch).eq("id", room.sessionId),
    "save session status"
  );
}

export async function saveStudent(room, student) {
  if (!supabase) return;
  await reportError(
    supabase.from("quiz_students").upsert({
      id: student.id,
      session_id: room.sessionId,
      display_name: student.name,
      total_score: student.totalScore
    }),
    "save student"
  );
}

export async function saveAnswer(room, student, questionIndex, answer) {
  if (!supabase) return;
  const question = room.quiz.questions[questionIndex];
  await reportError(
    supabase.from("quiz_answers").upsert({
      session_id: room.sessionId,
      student_id: student.id,
      question_index: questionIndex,
      prompt: question.prompt,
      selected_index: answer.selectedIndex,
      selected_text: question.options[answer.selectedIndex],
      correct_index: question.answerIndex,
      is_correct: answer.isCorrect,
      response_ms: answer.responseMs,
      score: answer.score,
      answered_at: new Date(answer.answeredAt).toISOString()
    }),
    "save answer"
  );
  await saveStudent(room, student);
}

export async function listSessions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, room_code, quiz_id, quiz_title, quiz_date, status, total_questions, created_at, started_at, finished_at, summary")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function getSessionExports(sessionId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, room_code, quiz_title, summary, responses")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  return data;
}

export async function getSessionDetail(sessionId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, room_code, quiz_id, quiz_title, quiz_date, status, total_questions, created_at, started_at, finished_at, summary, responses")
    .eq("id", sessionId)
    .single();
  if (error) throw error;
  return data;
}

function buildSummaryForStorage(room) {
  return room.summaryRowsBuilder ? room.summaryRowsBuilder(room) : [];
}

function buildResponsesForStorage(room) {
  return room.responseRowsBuilder ? room.responseRowsBuilder(room) : [];
}

async function reportError(queryPromise, label) {
  const { error } = await queryPromise;
  if (error) {
    console.error(`[supabase] ${label} failed: ${error.message}`);
  }
}
