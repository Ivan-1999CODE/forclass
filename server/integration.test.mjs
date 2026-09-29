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
  assert.ok(quizzes.length > 1);

  const smallestQuiz = quizzes.reduce((smallest, quiz) =>
    quiz.questionCount < smallest.questionCount ? quiz : smallest
  );
  assert.ok(smallestQuiz.questionCount > 0, "測試題庫應包含題目");
  // 同時驗證少於、等於與多於來源題數，不依賴正式題庫固定有 10 題。
  for (const questionCount of new Set([5, 10, 15, 20, smallestQuiz.questionCount, smallestQuiz.questionCount + 5])) {
    const sizedRoom = await emitAck(host, "host:createRoom", {
      quizId: smallestQuiz.id,
      questionCount
    });
    assert.equal(sizedRoom.ok, true);
    assert.match(sizedRoom.roomCode, /^[ACFHJKMNPRTUVWXY234679]{6}$/, "加入碼應為 6 碼且不含易混淆字元");
    assert.equal(sizedRoom.snapshot.quiz.questionCount, questionCount, `應建立 ${questionCount} 題的場次`);
  }

  const mixed = await emitAck(host, "host:createRoom", {
    quizIds: [quizzes[0].id, quizzes[1].id],
    questionCount: "all"
  });
  assert.equal(mixed.ok, true);
  assert.match(mixed.snapshot.quiz.title, /^混合題庫（2 份）/);
  assert.equal(mixed.snapshot.quiz.questionCount, quizzes[0].questionCount + quizzes[1].questionCount);

  const noQuizSelected = await emitAck(host, "host:createRoom", { quizIds: [], questionCount: 10 });
  assert.equal(noQuizSelected.ok, false);
  assert.equal(noQuizSelected.error, "請先勾選至少一個題庫。");

  // 舊版單一 quizId 格式仍可建立場次，避免既有客戶端更新期間中斷。
  const quizDetails = await Promise.all(quizzes.map(async (quiz) => {
    const response = await fetch(`${baseUrl}/api/quizzes/${encodeURIComponent(quiz.id)}`);
    return (await response.json()).quiz;
  }));
  const explainedQuiz = quizDetails.find((quiz) => quiz.questions.every((question) => question.explanation?.trim()));
  assert.ok(explainedQuiz, "需要含有解析的題庫驗證錯題回顧");
  const created = await emitAck(host, "host:createRoom", { quizId: explainedQuiz.id, questionCount: 1 });
  assert.equal(created.ok, true);
  const hostToken = created.hostToken;
  const roomCode = created.roomCode;

  const joinedA = await emitAck(studentA, "student:join", { roomCode: ` ${roomCode.toLowerCase()} `, name: "測試學生甲" });
  const joinedB = await emitAck(studentB, "student:join", { roomCode, name: "測試學生乙" });
  assert.equal(joinedA.ok, true);
  assert.equal(joinedB.ok, true);
  assert.equal(joinedA.snapshot.quiz.title, "課堂即時問答");
  assert.notEqual(created.snapshot.quiz.title, joinedA.snapshot.quiz.title, "學生端不可看到包含時態的題庫標題");

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
  assert.equal(hostResults.questionResults.find((student) => student.id === joinedA.studentId).selectedIndex, 0);
  assert.equal(hostResults.questionResults.find((student) => student.id === joinedB.studentId).selectedIndex, 1);
  for (const studentResults of [studentAResults, studentBResults]) {
    assert.equal(studentResults.ranking.length, 2);
    assert.deepEqual(studentResults.ranking.map((student) => student.rank), [1, 2]);
    assert.deepEqual(
      new Set(studentResults.ranking.map((student) => student.id)),
      new Set([joinedA.studentId, joinedB.studentId])
    );
  }

  const earlyReport = await emitAck(studentA, "student:report", {
    roomCode,
    studentId: joinedA.studentId,
    targetId: joinedB.studentId,
    reason: "干擾課堂"
  });
  assert.equal(earlyReport.ok, false);
  assert.equal(earlyReport.error, "課堂結束後才能檢舉。");

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
  assert.equal(finishedStudent.wrongAnswers[0].selectedIndex, wrongResult.selectedIndex);
  assert.equal(finishedStudent.wrongAnswers[0].correctIndex, hostResults.question.answerIndex);
  assert.deepEqual(finishedStudent.wrongAnswers[0].options, hostResults.question.options);
  assert.equal(finishedStudent.wrongAnswers[0].explanation, hostResults.question.explanation);
  assert.ok(finishedStudent.wrongAnswers[0].explanation.length > 0, "錯題回顧應保留題庫解析");
  assert.equal(finishedStudent.questionResults, undefined);

  const invalidReport = await emitAck(studentA, "student:report", {
    roomCode,
    studentId: joinedA.studentId,
    targetId: joinedB.studentId,
    reason: "自行輸入的原因"
  });
  assert.equal(invalidReport.ok, false);
  assert.equal(invalidReport.error, "請選擇有效的檢舉原因。");

  const hostReportUpdate = waitForSocketEvent(
    host,
    "host:update",
    (snapshot) => snapshot.reports?.some((report) => report.reason === "干擾課堂")
  );
  const validReport = await emitAck(studentA, "student:report", {
    roomCode,
    studentId: joinedA.studentId,
    targetId: joinedB.studentId,
    reason: "干擾課堂"
  });
  assert.equal(validReport.ok, true);
  const hostWithReport = await hostReportUpdate;
  assert.equal(hostWithReport.reports.length, 1);
  assert.equal(hostWithReport.reports[0].reporterName, "測試學生甲");
  assert.equal(hostWithReport.reports[0].targetName, "測試學生乙");
  assert.equal(hostWithReport.reports[0].reason, "干擾課堂");

  const duplicateReport = await emitAck(studentA, "student:report", {
    roomCode,
    studentId: joinedA.studentId,
    targetId: joinedB.studentId,
    reason: "冒用他人姓名"
  });
  assert.equal(duplicateReport.ok, false);
  assert.equal(duplicateReport.error, "每位學生每場只能檢舉一次。");

  const unansweredRoom = await emitAck(host, "host:createRoom", { quizId: quizzes[0].id, questionCount: 1 });
  const unansweredJoin = await emitAck(studentA, "student:join", { roomCode: unansweredRoom.roomCode, name: "未作答學生" });
  const unansweredCredentials = { roomCode: unansweredRoom.roomCode, hostToken: unansweredRoom.hostToken };
  await emitAck(host, "host:startGame", unansweredCredentials);
  const unansweredHostUpdate = waitForSocketEvent(host, "host:update", (snapshot) => snapshot.status === "results");
  await emitAck(host, "host:closeQuestion", unansweredCredentials);
  const unansweredHost = await unansweredHostUpdate;
  assert.deepEqual(unansweredHost.questionResults, [{ id: unansweredJoin.studentId, name: "未作答學生", selectedIndex: null, outcome: "unanswered" }]);
  const unansweredFinishedUpdate = waitForSocketEvent(studentA, "student:update", (snapshot) => snapshot.status === "finished");
  await emitAck(host, "host:endGame", unansweredCredentials);
  const unansweredFinished = await unansweredFinishedUpdate;
  assert.equal(unansweredFinished.wrongAnswers[0].selectedIndex, null);
  assert.equal(unansweredFinished.wrongAnswers[0].explanation, unansweredHost.question.explanation);

  if (server.exitCode !== null) {
    assert.fail(`伺服器提早結束：${serverOutput}`);
  }
});

test("踢除、連線檢查與全員答完倒數不受斷線誤判影響", async (t) => {
  const testUrl = "http://127.0.0.1:3138";
  const server = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: "3138",
      NODE_ENV: "production",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_SERVICE_KEY: "",
      AUTO_REVEAL_DELAY_MS: "300"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  t.after(() => server.kill());
  await waitForServer(server, testUrl);
  const sockets = [];
  const connect = async () => {
    const socket = io(testUrl, { transports: ["websocket"] });
    sockets.push(socket);
    await once(socket, "connect");
    return socket;
  };
  t.after(() => sockets.forEach((socket) => socket.close()));
  const host = await connect();
  const a = await connect();
  const b = await connect();
  const { quizzes } = await (await fetch(`${testUrl}/api/quizzes`)).json();
  let credentials;
  const create = async () => {
    const created = await emitAck(host, "host:createRoom", { quizId: quizzes[0].id, questionCount: 2 });
    credentials = { roomCode: created.roomCode, hostToken: created.hostToken };
    return created;
  };
  const join = (socket, name, studentId) => emitAck(socket, "student:join", { roomCode: credentials.roomCode, name, studentId });
  const snapshot = async () => (await emitAck(host, "host:resume", credentials)).snapshot;
  const answer = (socket, studentId) => emitAck(socket, "student:answer", { roomCode: credentials.roomCode, studentId, selectedIndex: 0 });
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  await t.test("連按加入沿用帳號；離線未答者不觸發提前倒數", async () => {
    await create();
    const [joinedA, repeatedA] = await Promise.all([join(a, "甲"), join(a, "甲")]);
    assert.equal(joinedA.studentId, repeatedA.studentId);
    const joinedB = await join(b, "乙");
    assert.equal((await snapshot()).students.length, 2);
    await emitAck(host, "host:startGame", credentials);
    const offline = waitForSocketEvent(host, "host:update", (state) => state.students.some((student) => student.id === joinedB.studentId && !student.connected));
    b.disconnect();
    await offline;
    await answer(a, joinedA.studentId);
    await pause(450);
    assert.equal((await snapshot()).status, "question");
    assert.equal((await snapshot()).autoRevealRemainingMs, 0);
    b.connect();
    await once(b, "connect");
    const resumed = await join(b, "乙", joinedB.studentId);
    assert.equal(resumed.studentId, joinedB.studentId);
    assert.equal(resumed.snapshot.me.answeredCurrent, false);
    assert.equal(resumed.snapshot.students.length, 2);
    const results = waitForSocketEvent(host, "host:update", (state) => state.status === "results");
    await answer(b, joinedB.studentId);
    assert.ok((await snapshot()).autoRevealRemainingMs > 0);
    await results;
  });

  await t.test("新連線取代舊連線後，舊連線不能答題也不能把學生標成離線", async () => {
    await create();
    const joined = await join(a, "甲");
    const replacement = await connect();
    const removed = waitForSocketEvent(a, "student:removed", () => true);
    const resumed = await join(replacement, "甲", joined.studentId);
    await removed;
    assert.equal(resumed.studentId, joined.studentId);
    a.disconnect();
    await pause(50);
    assert.equal((await snapshot()).students[0].connected, true);
    a.connect();
    await once(a, "connect");
    await emitAck(host, "host:startGame", credentials);
    assert.equal((await answer(a, joined.studentId)).ok, false);
    assert.equal((await answer(replacement, joined.studentId)).ok, true);
  });

  await t.test("只有老師能踢除；移除未答帳號後自動揭曉且舊帳號不會自動回來", async () => {
    await create();
    const joinedA = await join(a, "甲");
    const joinedB = await join(b, "甲");
    await emitAck(host, "host:startGame", credentials);
    await answer(a, joinedA.studentId);
    const denied = await emitAck(b, "host:kickStudent", { ...credentials, hostToken: "wrong", studentId: joinedA.studentId });
    assert.equal(denied.ok, false);
    assert.equal((await snapshot()).students.length, 2);
    const removed = waitForSocketEvent(b, "student:removed", () => true);
    const results = waitForSocketEvent(host, "host:update", (state) => state.status === "results");
    assert.equal((await emitAck(host, "host:kickStudent", { ...credentials, studentId: joinedB.studentId })).ok, true);
    await removed;
    assert.equal((await answer(b, joinedB.studentId)).ok, false);
    const rejectedResume = await join(b, "甲", joinedB.studentId);
    assert.equal(rejectedResume.ok, false);
    assert.equal(rejectedResume.removed, true);
    const revealed = await results;
    assert.equal(revealed.students.length, 1);
    assert.equal(revealed.ranking.length, 1);
    assert.equal(revealed.stats.answered, 1);
    const deliberateRejoin = await join(b, "甲");
    assert.equal(deliberateRejoin.ok, true);
    assert.notEqual(deliberateRejoin.studentId, joinedB.studentId);
  });

  await t.test("倒數途中加入會取消倒數，等待新學生作答", async () => {
    await create();
    const joinedA = await join(a, "甲");
    await emitAck(host, "host:startGame", credentials);
    await answer(a, joinedA.studentId);
    assert.ok((await snapshot()).autoRevealRemainingMs > 0);
    const joinedB = await join(b, "乙");
    assert.equal(joinedB.snapshot.autoRevealRemainingMs, 0);
    await pause(450);
    assert.equal((await snapshot()).status, "question");
    const results = waitForSocketEvent(host, "host:update", (state) => state.status === "results");
    await answer(b, joinedB.studentId);
    await results;
  });

  await t.test("探測正常與未回應頁面；未回應不代表已作答，重新同步會恢復在線", async () => {
    await create();
    const joinedA = await join(a, "甲");
    const joinedB = await join(b, "乙");
    const acknowledge = (_request, ack) => ack({ ok: true });
    a.on("student:checkConnection", acknowledge);
    assert.equal((await emitAck(a, "host:checkConnections", { ...credentials, hostToken: "wrong" })).ok, false);
    const check = await emitAck(host, "host:checkConnections", credentials, 5000);
    assert.equal(check.ok, true);
    assert.equal(check.snapshot.students.find((student) => student.id === joinedA.studentId).connected, true);
    assert.equal(check.snapshot.students.find((student) => student.id === joinedB.studentId).connected, false);
    await emitAck(host, "host:startGame", credentials);
    await answer(a, joinedA.studentId);
    await pause(450);
    assert.equal((await snapshot()).status, "question");
    const resumed = await join(b, "乙", joinedB.studentId);
    assert.equal(resumed.snapshot.students.find((student) => student.id === joinedB.studentId).connected, true);
    // 探測發出後，同一連線重新同步，不應被稍後逾時的舊探測覆寫。
    const probing = waitForSocketEvent(b, "student:checkConnection", () => true);
    const pendingCheck = emitAck(host, "host:checkConnections", credentials, 5000);
    await probing;
    await join(b, "乙", joinedB.studentId);
    const checked = await pendingCheck;
    assert.equal(checked.snapshot.students.find((student) => student.id === joinedB.studentId).connected, true);
    a.off("student:checkConnection", acknowledge);
  });

  await t.test("移除最後一人不會因空名單觸發全員作答；離線帳號也可踢除", async () => {
    await create();
    const joined = await join(b, "乙");
    await emitAck(host, "host:startGame", credentials);
    const offline = waitForSocketEvent(host, "host:update", (state) => state.students[0]?.connected === false);
    b.disconnect();
    await offline;
    assert.equal((await emitAck(host, "host:kickStudent", { ...credentials, studentId: joined.studentId })).ok, true);
    await pause(450);
    const state = await snapshot();
    assert.equal(state.students.length, 0);
    assert.equal(state.status, "question");
    assert.equal(state.autoRevealRemainingMs, 0);
  });
});

async function waitForServer(server, url = baseUrl) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`測試伺服器無法啟動，退出碼 ${server.exitCode}`);
    try {
      const response = await fetch(`${url}/api/network-info`);
      if (response.ok) return;
    } catch {
      // 伺服器尚在啟動。
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("等待測試伺服器啟動逾時");
}

function emitAck(socket, eventName, payload, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${eventName} 回覆逾時`)), timeoutMs);
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
