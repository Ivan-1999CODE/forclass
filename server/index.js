import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "socket.io";
import {
  getSessionExports,
  getSessionDetail,
  listSessions,
  persistenceEnabled,
  saveAnswer,
  saveSessionCreated,
  saveSessionStatus,
  saveStudent
} from "./persistence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const quizzesDir = path.join(rootDir, "quizzes");
const clientDir = path.join(rootDir, "client");
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const teacherPassword = process.env.TEACHER_PASSWORD || "";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = new Map();

app.use(express.json({ limit: "1mb" }));

app.get("/api/network-info", (_req, res) => {
  res.json({
    port,
    local: `http://localhost:${port}`,
    lan: getLanUrls(port)
  });
});

app.get("/api/quizzes", async (_req, res) => {
  try {
    const quizzes = await loadQuizList();
    res.json({ quizzes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/persistence/status", (_req, res) => {
  res.json({ enabled: persistenceEnabled });
});

app.get("/api/auth/status", (_req, res) => {
  res.json({ teacherPasswordRequired: Boolean(teacherPassword) });
});

app.post("/api/auth/teacher", (req, res) => {
  if (!teacherPassword) {
    res.json({ ok: true });
    return;
  }
  if (req.body?.password === teacherPassword) {
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false, error: "老師密碼錯誤。" });
});

app.get("/api/history", async (_req, res) => {
  try {
    res.json({ enabled: persistenceEnabled, sessions: await listSessions() });
  } catch (error) {
    res.status(500).json({ enabled: persistenceEnabled, error: error.message, sessions: [] });
  }
});

app.get("/api/history/:sessionId/summary.csv", async (req, res) => {
  try {
    const session = await getSessionExports(req.params.sessionId);
    if (!session) return res.status(404).send("Session not found");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${session.room_code}-summary.csv"`);
    res.send(toCsv(session.summary || []));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/history/:sessionId", async (req, res) => {
  try {
    const session = await getSessionDetail(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/history/:sessionId/responses.csv", async (req, res) => {
  try {
    const session = await getSessionExports(req.params.sessionId);
    if (!session) return res.status(404).send("Session not found");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${session.room_code}-responses.csv"`);
    res.send(toCsv(session.responses || []));
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/rooms/:roomCode/summary.csv", (req, res) => {
  const room = getAuthorizedRoom(req.params.roomCode, req.query.token);
  if (!room) return res.status(403).send("Invalid room or token");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${room.code}-summary.csv"`);
  res.send(toCsv(buildSummaryRows(room)));
});

app.get("/api/rooms/:roomCode/responses.csv", (req, res) => {
  const room = getAuthorizedRoom(req.params.roomCode, req.query.token);
  if (!room) return res.status(403).send("Invalid room or token");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${room.code}-responses.csv"`);
  res.send(toCsv(buildResponseRows(room)));
});

io.on("connection", (socket) => {
  socket.on("host:createRoom", async ({ quizId, questionCount }, callback) => {
    try {
      const quiz = await loadQuizById(quizId);
      const room = createRoom(selectQuestionsForSession(quiz, questionCount));
      void saveSessionCreated(room);
      socket.join(roomChannel(room.code));
      room.hostSocketId = socket.id;
      callback?.({
        ok: true,
        roomCode: room.code,
        hostToken: room.hostToken,
        snapshot: buildHostSnapshot(room)
      });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("host:resume", ({ roomCode, hostToken }, callback) => {
    const room = getRoom(roomCode);
    if (!room || room.hostToken !== hostToken) {
      callback?.({ ok: false, error: "找不到房間，或老師權限已失效。" });
      return;
    }
    room.hostSocketId = socket.id;
    socket.join(roomChannel(room.code));
    callback?.({ ok: true, snapshot: buildHostSnapshot(room) });
    broadcastRoom(room);
  });

  socket.on("host:startGame", ({ roomCode, hostToken }, callback) => {
    const room = getAuthorizedRoom(roomCode, hostToken);
    if (!room) return callback?.({ ok: false, error: "老師權限無效。" });
    if (room.students.size === 0) return callback?.({ ok: false, error: "目前沒有學生加入。" });
    startQuestion(room, 0);
    callback?.({ ok: true });
  });

  socket.on("host:closeQuestion", ({ roomCode, hostToken }, callback) => {
    const room = getAuthorizedRoom(roomCode, hostToken);
    if (!room) return callback?.({ ok: false, error: "老師權限無效。" });
    closeQuestion(room);
    callback?.({ ok: true });
  });

  socket.on("host:nextQuestion", ({ roomCode, hostToken }, callback) => {
    const room = getAuthorizedRoom(roomCode, hostToken);
    if (!room) return callback?.({ ok: false, error: "老師權限無效。" });
    const nextIndex = room.currentQuestionIndex + 1;
    if (nextIndex >= room.quiz.questions.length) {
      finishRoom(room);
    } else {
      startQuestion(room, nextIndex);
    }
    callback?.({ ok: true });
  });

  socket.on("host:endGame", ({ roomCode, hostToken }, callback) => {
    const room = getAuthorizedRoom(roomCode, hostToken);
    if (!room) return callback?.({ ok: false, error: "老師權限無效。" });
    finishRoom(room);
    callback?.({ ok: true });
  });

  socket.on("student:join", ({ roomCode, name, studentId }, callback) => {
    const room = getRoom(roomCode);
    if (!room) return callback?.({ ok: false, error: "找不到這個房間代碼。" });
    const cleanName = normalizeName(name);
    if (!cleanName) return callback?.({ ok: false, error: "請輸入姓名。" });

    let student = studentId ? room.students.get(studentId) : null;
    if (student) {
      student.socketId = socket.id;
      student.connected = true;
    } else {
      const id = crypto.randomUUID();
      student = {
        id,
        name: uniqueStudentName(room, cleanName),
        socketId: socket.id,
        connected: true,
        totalScore: 0,
        answers: new Map()
      };
      room.students.set(id, student);
    }
    void saveStudent(room, student);

    socket.join(roomChannel(room.code));
    socket.data.roomCode = room.code;
    socket.data.studentId = student.id;
    callback?.({ ok: true, studentId: student.id, snapshot: buildStudentSnapshot(room, student.id) });
    broadcastRoom(room);
  });

  socket.on("student:answer", ({ roomCode, studentId, selectedIndex }, callback) => {
    const room = getRoom(roomCode);
    const student = room?.students.get(studentId);
    if (!room || !student) return callback?.({ ok: false, error: "學生或房間不存在。" });
    if (room.status !== "question") return callback?.({ ok: false, error: "目前不能作答。" });
    if (student.answers.has(room.currentQuestionIndex)) return callback?.({ ok: false, error: "你已經作答過了。" });
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
      return callback?.({ ok: false, error: "選項無效。" });
    }

    const now = Date.now();
    const question = room.quiz.questions[room.currentQuestionIndex];
    const totalMs = getQuestionLimitMs(room, room.currentQuestionIndex);
    const responseMs = Math.max(0, now - room.questionStartedAt);
    const remainingMs = Math.max(0, room.questionEndsAt - now);
    const isCorrect = selectedIndex === question.answerIndex;
    const score = isCorrect ? Math.round(1000 * (0.5 + 0.5 * (remainingMs / totalMs))) : 0;

    student.answers.set(room.currentQuestionIndex, {
      selectedIndex,
      isCorrect,
      responseMs,
      score,
      answeredAt: now
    });
    student.totalScore += score;
    void saveAnswer(room, student, room.currentQuestionIndex, student.answers.get(room.currentQuestionIndex));
    callback?.({ ok: true, snapshot: buildStudentSnapshot(room, student.id) });
    broadcastRoom(room);
  });

  socket.on("display:join", ({ roomCode }, callback) => {
    const room = getRoom(roomCode);
    if (!room) return callback?.({ ok: false, error: "找不到這個房間代碼。" });
    socket.join(roomChannel(room.code));
    callback?.({ ok: true, snapshot: buildDisplaySnapshot(room) });
  });

  socket.on("disconnect", () => {
    const { roomCode, studentId } = socket.data;
    const room = getRoom(roomCode);
    const student = room?.students.get(studentId);
    if (student) {
      student.connected = false;
      broadcastRoom(room);
    }
  });
});

if (isProduction) {
  const distDir = path.join(clientDir, "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: clientDir,
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
}

server.listen(port, "0.0.0.0", () => {
  const lanUrls = getLanUrls(port);
  console.log("");
  console.log("課堂即時問答系統已啟動");
  console.log(`老師頁面: http://localhost:${port}/host-teacher-panel`);
  console.log(`學生本機測試: http://localhost:${port}/join`);
  if (lanUrls.length > 0) {
    console.log("手機測試網址:");
    for (const url of lanUrls) {
      console.log(`  ${url}/join`);
    }
  } else {
    console.log("未偵測到區網 IPv4。請確認 Wi-Fi 或網路介面。");
  }
  console.log("");
  console.log(`Supabase history: ${persistenceEnabled ? "enabled" : "disabled (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)"}`);
});

async function loadQuizList() {
  const files = await fs.readdir(quizzesDir);
  const quizzes = [];
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(quizzesDir, file), "utf8");
    const quiz = validateQuiz(JSON.parse(raw), file);
    quizzes.push({
      id: quiz.id,
      title: quiz.title,
      date: quiz.date,
      questionCount: quiz.questions.length,
      defaultTimeLimitSec: quiz.defaultTimeLimitSec,
      file
    });
  }
  return quizzes.sort((a, b) => `${b.date}-${b.title}`.localeCompare(`${a.date}-${a.title}`));
}

async function loadQuizById(quizId) {
  const files = await fs.readdir(quizzesDir);
  for (const file of files.filter((name) => name.endsWith(".json"))) {
    const raw = await fs.readFile(path.join(quizzesDir, file), "utf8");
    const quiz = validateQuiz(JSON.parse(raw), file);
    if (quiz.id === quizId) return quiz;
  }
  throw new Error("找不到指定的測驗。");
}

function validateQuiz(quiz, source) {
  if (!quiz || typeof quiz !== "object") throw new Error(`${source}: JSON 格式錯誤。`);
  if (!quiz.id || !quiz.title || !quiz.date) throw new Error(`${source}: 缺少 id/title/date。`);
  if (!Number.isInteger(quiz.defaultTimeLimitSec) || quiz.defaultTimeLimitSec <= 0) {
    throw new Error(`${source}: defaultTimeLimitSec 必須是正整數。`);
  }
  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    throw new Error(`${source}: questions 必須有至少一題。`);
  }
  quiz.questions.forEach((question, index) => {
    if (!question.prompt || !Array.isArray(question.options) || question.options.length !== 4) {
      throw new Error(`${source}: 第 ${index + 1} 題必須有 prompt 和四個 options。`);
    }
    if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) {
      throw new Error(`${source}: 第 ${index + 1} 題 answerIndex 必須是 0-3。`);
    }
    if (question.timeLimitSec !== undefined && (!Number.isInteger(question.timeLimitSec) || question.timeLimitSec <= 0)) {
      throw new Error(`${source}: 第 ${index + 1} 題 timeLimitSec 必須是正整數。`);
    }
  });
  return quiz;
}

function createRoom(quiz) {
  let code = "";
  do {
    code = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  const room = {
    code,
    sessionId: crypto.randomUUID(),
    hostToken: crypto.randomUUID(),
    quiz,
    status: "waiting",
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionEndsAt: null,
    timer: null,
    students: new Map(),
    createdAt: Date.now(),
    startedAt: null,
    summaryRowsBuilder: buildSummaryRows,
    responseRowsBuilder: buildResponseRows
  };
  rooms.set(code, room);
  return room;
}

function selectQuestionsForSession(quiz, requestedQuestionCount) {
  const questionLimit = normalizeQuestionLimit(requestedQuestionCount);
  if (!Number.isInteger(questionLimit) || questionLimit <= 0 || quiz.questions.length <= questionLimit) {
    return quiz;
  }
  return {
    ...quiz,
    questions: shuffleArray(quiz.questions).slice(0, questionLimit)
  };
}

function normalizeQuestionLimit(requestedQuestionCount) {
  if (requestedQuestionCount === "all") return Number.POSITIVE_INFINITY;
  const parsed = Number(requestedQuestionCount || process.env.QUIZ_QUESTION_LIMIT || 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10;
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function startQuestion(room, index) {
  clearRoomTimer(room);
  room.status = "question";
  room.currentQuestionIndex = index;
  room.questionStartedAt = Date.now();
  room.questionEndsAt = room.questionStartedAt + getQuestionLimitMs(room, index);
  room.timer = setTimeout(() => closeQuestion(room), getQuestionLimitMs(room, index));
  void saveSessionStatus(room);
  broadcastRoom(room);
}

function closeQuestion(room) {
  if (room.status !== "question") return;
  clearRoomTimer(room);
  room.status = "results";
  void saveSessionStatus(room);
  broadcastRoom(room);
}

function finishRoom(room) {
  clearRoomTimer(room);
  room.status = "finished";
  void saveSessionStatus(room);
  broadcastRoom(room);
}

function clearRoomTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
}

function broadcastRoom(room) {
  io.to(roomChannel(room.code)).emit("room:update", buildDisplaySnapshot(room));
  for (const student of room.students.values()) {
    io.to(student.socketId).emit("student:update", buildStudentSnapshot(room, student.id));
  }
  if (room.hostSocketId) {
    io.to(room.hostSocketId).emit("host:update", buildHostSnapshot(room));
  }
}

function buildHostSnapshot(room) {
  return {
    ...buildDisplaySnapshot(room),
    hostToken: room.hostToken,
    csv: {
      summaryUrl: `/api/rooms/${room.code}/summary.csv?token=${encodeURIComponent(room.hostToken)}`,
      responsesUrl: `/api/rooms/${room.code}/responses.csv?token=${encodeURIComponent(room.hostToken)}`
    }
  };
}

function buildDisplaySnapshot(room) {
  const currentQuestion = getCurrentQuestion(room);
  return {
    roomCode: room.code,
    status: room.status,
    quiz: {
      id: room.quiz.id,
      title: room.quiz.title,
      date: room.quiz.date,
      questionCount: room.quiz.questions.length
    },
    currentQuestionIndex: room.currentQuestionIndex,
    timeRemainingMs: room.status === "question" ? Math.max(0, room.questionEndsAt - Date.now()) : 0,
    question: currentQuestion
      ? {
          prompt: currentQuestion.prompt,
          options: currentQuestion.options,
          answerIndex: room.status === "results" || room.status === "finished" ? currentQuestion.answerIndex : null,
          explanation: room.status === "results" || room.status === "finished" ? currentQuestion.explanation || "" : ""
        }
      : null,
    students: [...room.students.values()].map((student) => ({
      id: student.id,
      name: student.name,
      connected: student.connected,
      totalScore: student.totalScore,
      answeredCurrent: room.currentQuestionIndex >= 0 && student.answers.has(room.currentQuestionIndex)
    })),
    ranking: buildRanking(room),
    stats: buildQuestionStats(room)
  };
}

function buildStudentSnapshot(room, studentId) {
  const base = buildDisplaySnapshot(room);
  const student = room.students.get(studentId);
  const answer = student?.answers.get(room.currentQuestionIndex);
  return {
    ...base,
    me: student
      ? {
          id: student.id,
          name: student.name,
          totalScore: student.totalScore,
          selectedIndex: answer?.selectedIndex ?? null,
          answeredCurrent: Boolean(answer)
        }
      : null
  };
}

function getCurrentQuestion(room) {
  if (room.currentQuestionIndex < 0) return null;
  return room.quiz.questions[room.currentQuestionIndex] ?? null;
}

function buildQuestionStats(room) {
  if (room.currentQuestionIndex < 0) return null;
  const counts = [0, 0, 0, 0];
  let answered = 0;
  let correct = 0;
  for (const student of room.students.values()) {
    const answer = student.answers.get(room.currentQuestionIndex);
    if (!answer) continue;
    answered += 1;
    counts[answer.selectedIndex] += 1;
    if (answer.isCorrect) correct += 1;
  }
  return {
    optionCounts: counts,
    answered,
    unanswered: Math.max(0, room.students.size - answered),
    correct
  };
}

function buildRanking(room) {
  return [...room.students.values()]
    .map((student) => ({
      id: student.id,
      name: student.name,
      totalScore: student.totalScore,
      correctCount: [...student.answers.values()].filter((answer) => answer.isCorrect).length,
      avgResponseMs: average([...student.answers.values()].map((answer) => answer.responseMs))
    }))
    .sort((a, b) => b.totalScore - a.totalScore || a.avgResponseMs - b.avgResponseMs)
    .map((student, index) => ({ ...student, rank: index + 1 }));
}

function buildSummaryRows(room) {
  return buildRanking(room).map((student) => ({
    rank: student.rank,
    studentName: student.name,
    totalScore: student.totalScore,
    correctCount: student.correctCount,
    totalQuestions: room.quiz.questions.length,
    accuracy: `${Math.round((student.correctCount / room.quiz.questions.length) * 100)}%`,
    avgResponseMs: student.avgResponseMs
  }));
}

function buildResponseRows(room) {
  const rows = [];
  for (const student of room.students.values()) {
    room.quiz.questions.forEach((question, questionIndex) => {
      const answer = student.answers.get(questionIndex);
      rows.push({
        studentName: student.name,
        questionIndex,
        prompt: question.prompt,
        selectedIndex: answer?.selectedIndex ?? "",
        selectedText: answer ? question.options[answer.selectedIndex] : "",
        correctIndex: question.answerIndex,
        isCorrect: answer?.isCorrect ?? false,
        responseMs: answer?.responseMs ?? "",
        score: answer?.score ?? 0
      });
    });
  }
  return rows;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return `\uFEFF${lines.join("\n")}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function getAuthorizedRoom(roomCode, hostToken) {
  const room = getRoom(roomCode);
  if (!room || room.hostToken !== hostToken) return null;
  return room;
}

function getRoom(roomCode) {
  return rooms.get(String(roomCode || "").trim().toUpperCase());
}

function roomChannel(roomCode) {
  return `room:${roomCode}`;
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function uniqueStudentName(room, baseName) {
  const existing = new Set([...room.students.values()].map((student) => student.name));
  if (!existing.has(baseName)) return baseName;
  let index = 2;
  while (existing.has(`${baseName} (${index})`)) index += 1;
  return `${baseName} (${index})`;
}

function getQuestionLimitMs(room, index) {
  const question = room.quiz.questions[index];
  return (question.timeLimitSec || room.quiz.defaultTimeLimitSec) * 1000;
}

function average(values) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getLanUrls(serverPort) {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${serverPort}`);
      }
    }
  }
  return urls;
}
