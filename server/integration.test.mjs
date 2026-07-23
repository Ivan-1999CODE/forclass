import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";
import { io } from "socket.io-client";

const port = 3137;
const baseUrl = `http://127.0.0.1:${port}`;

test("老師可看單題結果、個別留言，學生結束後可看自己的錯題", async (t) => {
  const server = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "production",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SERVICE_KEY: "",
      TEACHER_PASSWORD: "",
      AUTO_REVEAL_DELAY_MS: "60000",
      TEACHER_MESSAGE_TTL_MS: "100"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  t.after(() => server.kill());

  await waitForServer(server);

  const persistenceResponse = await fetch(`${baseUrl}/api/persistence/status`);
  const persistence = await persistenceResponse.json();
  assert.equal(persistence.enabled, false, "整合測試不得連接正式 Supabase");

  const host = io(baseUrl, { transports: ["websocket"] });
  const studentA = io(baseUrl, { transports: ["websocket"] });
  const studentB = io(baseUrl, { transports: ["websocket"] });
  t.after(() => {
    host.close();
    studentA.close();
    studentB.close();
  });
  await Promise.all([once(host, "connect"), once(studentA, "connect"), once(studentB, "connect")]);

  const quizResponse = await fetch(`${baseUrl}/api/quizzes`);
  const { quizzes } = await quizResponse.json();
  assert.ok(quizzes.length > 0);

  const created = await emitAck(host, "host:createRoom", { quizId: quizzes[0].id, questionCount: 1 });
  assert.equal(created.ok, true);
  const hostToken = created.hostToken;
  const roomCode = created.roomCode;

  const joinedA = await emitAck(studentA, "student:join", { roomCode, name: "測試學生甲" });
  const joinedB = await emitAck(studentB, "student:join", { roomCode, name: "測試學生乙" });
  assert.equal(joinedA.ok, true);
  assert.equal(joinedB.ok, true);

  await emitAck(host, "host:startGame", { roomCode, hostToken });
  await emitAck(studentA, "student:answer", { roomCode, studentId: joinedA.studentId, selectedIndex: 0 });
  await emitAck(studentB, "student:answer", { roomCode, studentId: joinedB.studentId, selectedIndex: 1 });

  const hostResultsUpdate = waitForSocketEvent(host, "host:update", (snapshot) => snapshot.status === "results");
  const studentAResultsUpdate = waitForSocketEvent(studentA, "student:update", (snapshot) => snapshot.status === "results");
  const studentBResultsUpdate = waitForSocketEvent(studentB, "student:update", (snapshot) => snapshot.status === "results");
  await emitAck(host, "host:closeQuestion", { roomCode, hostToken });
  const hostResults = await hostResultsUpdate;
  const [studentAResults, studentBResults] = await Promise.all([studentAResultsUpdate, studentBResultsUpdate]);
  assert.equal(hostResults.status, "results");
  assert.equal(hostResults.questionResults.length, 2);
  for (const studentResults of [studentAResults, studentBResults]) {
    assert.equal(studentResults.ranking.length, 2);
    assert.deepEqual(studentResults.ranking.map((student) => student.rank), [1, 2]);
    assert.deepEqual(
      new Set(studentResults.ranking.map((student) => student.id)),
      new Set([joinedA.studentId, joinedB.studentId])
    );
  }

  const wrongResult = hostResults.questionResults.find((result) => result.outcome === "wrong");
  assert.ok(wrongResult, "兩位學生選不同答案時，至少一位應答錯");
  const wrongSocket = wrongResult.id === joinedA.studentId ? studentA : studentB;

  const messageUpdate = waitForSocketEvent(wrongSocket, "student:update", (snapshot) => snapshot.teacherMessages?.length > 0);
  const sent = await emitAck(host, "host:sendStudentMessage", {
    roomCode,
    hostToken,
    studentId: wrongResult.id,
    text: "請再看一次這題的解釋。"
  });
  assert.equal(sent.ok, true);
  const studentWithMessage = await messageUpdate;
  assert.equal(studentWithMessage.teacherMessages.at(-1).text, "請再看一次這題的解釋。");
  assert.equal(studentWithMessage.questionResults, undefined);

  await new Promise((resolve) => setTimeout(resolve, 150));
  const resumedBeforeViewing = await emitAck(wrongSocket, "student:join", {
    roomCode,
    name: wrongResult.name,
    studentId: wrongResult.id
  });
  assert.equal(resumedBeforeViewing.snapshot.teacherMessages.length, 1, "學生尚未確認看過時，留言不應先過期");

  const expiredMessageUpdatePromise = waitForSocketEvent(
    wrongSocket,
    "student:update",
    (snapshot) => snapshot.teacherMessages?.length === 0,
    1000
  );
  const viewed = await emitAck(wrongSocket, "student:viewTeacherMessages", {
    roomCode,
    studentId: wrongResult.id,
    messageIds: [studentWithMessage.teacherMessages.at(-1).id]
  });
  assert.equal(viewed.ok, true);
  const expiredMessageUpdate = await expiredMessageUpdatePromise;
  assert.equal(expiredMessageUpdate.teacherMessages.length, 0);

  const finishedUpdate = waitForSocketEvent(wrongSocket, "student:update", (snapshot) => snapshot.status === "finished");
  await emitAck(host, "host:endGame", { roomCode, hostToken });
  const finishedStudent = await finishedUpdate;
  assert.equal(finishedStudent.status, "finished");
  assert.equal(finishedStudent.wrongAnswers.length, 1);
  assert.equal(finishedStudent.wrongAnswers[0].questionIndex, 0);
  assert.equal(finishedStudent.questionResults, undefined);

  if (server.exitCode !== null) {
    assert.fail(`伺服器提早結束：${serverOutput}`);
  }
});

async function waitForServer(server) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`測試伺服器無法啟動，退出碼 ${server.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/network-info`);
      if (response.ok) return;
    } catch {
      // 伺服器尚在啟動。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("等待測試伺服器啟動逾時");
}

function emitAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${eventName} 回覆逾時`)), 3000);
    socket.emit(eventName, payload, (reply) => {
      clearTimeout(timeout);
      resolve(reply);
    });
  });
}

function waitForSocketEvent(socket, eventName, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`${eventName} 事件逾時`));
    }, timeoutMs);
    const handleEvent = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(eventName, handleEvent);
      resolve(payload);
    };
    socket.on(eventName, handleEvent);
  });
}
