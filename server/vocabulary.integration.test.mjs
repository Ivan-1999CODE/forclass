import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import test from "node:test";
import { io } from "socket.io-client";

const baseUrl = "http://127.0.0.1:3141";
const ack = (socket, event, payload) => new Promise((resolve, reject) => {
  socket.timeout(10000).emit(event, payload, (error, reply) => error ? reject(error) : resolve(reply));
});

test("單字獨立／混合建場、133 課範圍、兩名學生作答與英中方向", async (t) => {
  const server = spawn(process.execPath, ["--import", "./server/fixtures/vocabulary-fetch.mjs", "server/index.js"], {
    env: { ...process.env, PORT: "3141", NODE_ENV: "production", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", SUPABASE_SERVICE_KEY: "", TEACHER_PASSWORD: "", AUTO_REVEAL_DELAY_MS: "60000" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  server.stdout.on("data", (data) => { output += data; });
  server.stderr.on("data", (data) => { output += data; });
  t.after(() => server.kill());
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(`${baseUrl}/api/network-info`)).ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  assert.equal((await (await fetch(`${baseUrl}/api/persistence/status`)).json()).enabled, false);
  const catalogue = await (await fetch(`${baseUrl}/api/vocabulary/catalogue`)).json();
  assert.equal(catalogue.availableLessons, 133);
  assert.equal(catalogue.totalWords, 798);
  const preview = await (await fetch(`${baseUrl}/api/vocabulary/preview?lessons=1,133`)).json();
  assert.equal(preview.quiz.questions.length, 12);
  assert.equal((await fetch(`${baseUrl}/api/vocabulary/preview?lessons=134`)).status, 400);
  const host = io(baseUrl, { transports: ["websocket"] });
  const a = io(baseUrl, { transports: ["websocket"] });
  const b = io(baseUrl, { transports: ["websocket"] });
  t.after(() => { host.close(); a.close(); b.close(); });
  await Promise.all([once(host, "connect"), once(a, "connect"), once(b, "connect")]);
  for (const lessons of [[0], [134], ["1"]]) {
    assert.equal((await ack(host, "host:createRoom", { quizIds: [], vocabularyLessons: lessons, questionCount: 5 })).ok, false);
  }
  const created = await ack(host, "host:createRoom", { quizIds: [], vocabularyLessons: [1, 133], questionCount: 5 });
  assert.equal(created.ok, true, created.error);
  assert.equal(created.snapshot.quiz.questionCount, 5);
  assert.match(created.snapshot.quiz.title, /單字測驗/);
  const credentials = { roomCode: created.roomCode, hostToken: created.hostToken };
  const joinedA = await ack(a, "student:join", { roomCode: created.roomCode, name: "單字甲" });
  const joinedB = await ack(b, "student:join", { roomCode: created.roomCode, name: "單字乙" });
  assert.ok(joinedA.ok && joinedB.ok);
  assert.equal((await ack(host, "host:startGame", credentials)).ok, true);
  for (let i = 0; i < 5; i++) {
    const current = (await ack(host, "host:resume", credentials)).snapshot;
    assert.equal(current.status, "question");
    assert.match(current.question.prompt, i % 2 ? /的英文/ : /的中文/);
    assert.equal(current.question.options.length, 4);
    const resumedA = await ack(a, "student:join", { roomCode: created.roomCode, name: "單字甲", studentId: joinedA.studentId });
    assert.equal(resumedA.snapshot.question.answerIndex, null, "學生作答前不能取得答案");
    assert.equal(resumedA.snapshot.question.explanation, "");
    assert.equal(resumedA.snapshot.question.alternateQuestion, undefined);
    assert.equal((await ack(a, "student:answer", { roomCode: created.roomCode, studentId: joinedA.studentId, selectedIndex: 0 })).ok, true);
    assert.equal((await ack(b, "student:answer", { roomCode: created.roomCode, studentId: joinedB.studentId, selectedIndex: 1 })).ok, true);
    await ack(host, "host:closeQuestion", credentials);
    const result = (await ack(host, "host:resume", credentials)).snapshot;
    assert.equal(result.stats.answered, 2);
    assert.match(result.question.explanation, /第 (1|133) 課/);
    assert.ok(Number.isInteger(result.question.answerIndex));
    const translated = result.question.explanation.split("：")[1];
    const english = result.question.explanation.split("｜")[1].split(" ")[0];
    assert.equal(result.question.options[result.question.answerIndex], i % 2 ? english : translated, "隨機重排仍保留正確答案");
    if (i < 4) await ack(host, "host:nextQuestion", credentials);
  }
  await ack(host, "host:endGame", credentials);
  const finished = await ack(a, "student:join", { roomCode: created.roomCode, name: "單字甲", studentId: joinedA.studentId });
  assert.equal(finished.snapshot.status, "finished");
  assert.equal(finished.snapshot.ranking.length, 2);
  assert.ok(Array.isArray(finished.snapshot.wrongAnswers));
  const { quizzes } = await (await fetch(`${baseUrl}/api/quizzes`)).json();
  const mixed = await ack(host, "host:createRoom", { quizIds: [quizzes[0].id], vocabularyLessons: [133], questionCount: "all" });
  assert.equal(mixed.ok, true, mixed.error);
  assert.equal(mixed.snapshot.quiz.questionCount, quizzes[0].questionCount + 6);
});
