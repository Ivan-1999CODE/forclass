import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, Socket } from "socket.io-client";
import "./styles.css";

type QuizSummary = {
  id: string;
  title: string;
  date: string;
  questionCount: number;
  defaultTimeLimitSec: number;
  file: string;
};

type Snapshot = {
  roomCode: string;
  status: "waiting" | "question" | "results" | "finished";
  quiz: { id: string; title: string; date: string; questionCount: number };
  currentQuestionIndex: number;
  timeRemainingMs: number;
  question: null | {
    prompt: string;
    options: string[];
    answerIndex: number | null;
    explanation: string;
  };
  students: Array<{ id: string; name: string; connected: boolean; totalScore: number; answeredCurrent: boolean }>;
  ranking: Array<{ id: string; name: string; rank: number; totalScore: number; correctCount: number; avgResponseMs: number }>;
  stats: null | { optionCounts: number[]; answered: number; unanswered: number; correct: number };
  me?: null | { id: string; name: string; totalScore: number; selectedIndex: number | null; answeredCurrent: boolean };
  hostToken?: string;
  csv?: { summaryUrl: string; responsesUrl: string };
};

type NetworkInfo = {
  local: string;
  lan: string[];
};

type HistorySession = {
  id: string;
  room_code: string;
  quiz_title: string;
  quiz_date: string;
  status: Snapshot["status"];
  total_questions: number;
  created_at: string;
  finished_at: string | null;
  summary: Array<{ studentName: string; totalScore: number }>;
};

const socket: Socket = io();
const hostStorageKey = "classroom-live-quiz-host";
const studentStorageKey = "classroom-live-quiz-student";

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/host-teacher-panel")) return <HostPage />;
  if (path.startsWith("/display/")) return <DisplayPage roomCode={path.split("/").filter(Boolean)[1] || ""} />;
  if (path.startsWith("/join")) return <JoinPage />;
  return <HomePage />;
}

function HomePage() {
  return (
    <main className="center-page">
      <section className="panel narrow">
        <h1>課堂即時問答</h1>
        <p>老師請進入隱藏控制頁建立房間，學生使用老師分享的連結加入。</p>
        <a className="primary-link" href="/host-teacher-panel">進入老師控制頁</a>
      </section>
    </main>
  );
}

function HostPage() {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [history, setHistory] = useState<{ enabled: boolean; sessions: HistorySession[] }>({ enabled: false, sessions: [] });
  const [savedHost, setSavedHost] = useState<{ roomCode: string; hostToken: string; quizTitle?: string } | null>(null);
  const [resumeMessage, setResumeMessage] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/quizzes")
      .then((response) => response.json())
      .then((data) => {
        setQuizzes(data.quizzes || []);
        setSelectedQuizId(data.quizzes?.[0]?.id || "");
      })
      .catch((error) => setMessage(error.message));

    fetch("/api/network-info")
      .then((response) => response.json())
      .then(setNetworkInfo)
      .catch(() => undefined);

    fetchHistory(setHistory);

    const saved = readJson<{ roomCode: string; hostToken: string; quizTitle?: string }>(hostStorageKey);
    if (saved?.roomCode && saved?.hostToken) {
      setSavedHost(saved);
    }

    socket.on("host:update", setSnapshot);
    return () => {
      socket.off("host:update", setSnapshot);
    };
  }, []);

  const createRoom = () => {
    setMessage("");
    socket.emit("host:createRoom", { quizId: selectedQuizId }, (reply: SocketReply) => {
      if (!reply.ok) {
        setMessage(reply.error || "建立房間失敗。");
        return;
      }
      localStorage.setItem(hostStorageKey, JSON.stringify({ roomCode: reply.roomCode, hostToken: reply.hostToken, quizTitle: reply.snapshot?.quiz.title }));
      setSavedHost(null);
      setSnapshot(reply.snapshot);
    });
  };

  const resumeRoom = () => {
    if (!savedHost) return;
    setResumeMessage("");
    socket.emit("host:resume", savedHost, (reply: SocketReply) => {
      if (reply.ok) {
        setSnapshot(reply.snapshot);
        setSavedHost(null);
      } else {
        setResumeMessage("上一個場次已失效，可能是 Render 重新部署、重啟或睡著後清掉了進行中場次。請建立新場次。");
      }
    });
  };

  const resetRoom = () => {
    localStorage.removeItem(hostStorageKey);
    setSnapshot(null);
    setSavedHost(null);
    setResumeMessage("");
    setMessage("");
  };

  const hostAction = (eventName: string) => {
    if (!snapshot?.hostToken) return;
    setMessage("");
    socket.emit(eventName, { roomCode: snapshot.roomCode, hostToken: snapshot.hostToken }, (reply: SocketReply) => {
      if (!reply.ok) setMessage(reply.error || "操作失敗。");
    });
  };

  const isLocalOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const joinUrl = snapshot ? `${window.location.origin}/join?room=${snapshot.roomCode}` : "";
  const lanJoinUrls = snapshot && networkInfo && isLocalOrigin ? networkInfo.lan.map((url) => `${url}/join?room=${snapshot.roomCode}`) : [];
  const displayUrl = snapshot ? `${window.location.origin}/display/${snapshot.roomCode}` : "";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Teacher Console</p>
          <h1>老師控制頁</h1>
        </div>
        <span className="status-pill">{snapshot ? `加入碼 ${snapshot.roomCode}` : "尚未建立場次"}</span>
      </header>

      <section className="grid two">
        <div className="panel">
          <h2>選擇測驗</h2>
          <p className="hint">題目 JSON 放在專案的 quizzes 資料夾。新增檔案後重新整理此頁，就會出現在這裡。</p>
          {savedHost && !snapshot && (
            <div className="resume-card">
              <strong>偵測到上一個場次</strong>
              <p>{savedHost.quizTitle || "上一個測驗"} / 加入碼 {savedHost.roomCode}</p>
              <div className="actions">
                <button onClick={resumeRoom}>返回剛剛那場</button>
                <button className="secondary" onClick={resetRoom}>建立新場次</button>
              </div>
              {resumeMessage && <p className="notice error">{resumeMessage}</p>}
            </div>
          )}
          <select value={selectedQuizId} onChange={(event) => setSelectedQuizId(event.target.value)} disabled={Boolean(snapshot)}>
            {quizzes.map((quiz) => (
              <option value={quiz.id} key={quiz.id}>
                {quiz.date} - {quiz.title} ({quiz.questionCount} 題)
              </option>
            ))}
          </select>
          <div className="actions">
            <button onClick={createRoom} disabled={!selectedQuizId}>建立場次</button>
            <button className="secondary" onClick={resetRoom}>建立新場次</button>
          </div>
          {message && <p className="notice error">{message}</p>}
        </div>

        <div className="panel">
          <h2>學生加入方式</h2>
          {snapshot ? (
            <>
              <CopyLine label="學生連結" value={joinUrl} />
              {lanJoinUrls.map((url) => <CopyLine key={url} label="同 Wi-Fi 手機測試" value={url} />)}
              <CopyLine label="投影頁" value={displayUrl} />
              <p className="hint">把「學生連結」傳給學生即可加入；如果學生只開 /join，也可以手動輸入加入碼 {snapshot.roomCode}。</p>
              <p className="hint">「投影頁」是給老師投影到教室螢幕用，只顯示等待室、題目、統計和排行榜，不能控制遊戲。</p>
              {isLocalOrigin && <p className="hint">本機測試時，手機需和老師電腦連同一個 Wi-Fi。Windows 防火牆跳出時，請允許 Node.js 在私人網路通訊。</p>}
            </>
          ) : (
            <p className="empty">建立場次後會顯示連結和加入碼。</p>
          )}
          <p className="hint">老師頁重新整理通常可以恢復；但 Render 重新部署、重啟或免費方案睡著後，進行中的場次會失效。已保存到 Supabase 的歷史資料不會消失。</p>
        </div>
      </section>

      {snapshot && (
        <section className="grid two">
          <div className="panel">
            <h2>遊戲控制</h2>
            <GameStatus snapshot={snapshot} />
            <div className="actions">
              <button onClick={() => hostAction("host:startGame")} disabled={snapshot.status !== "waiting"}>開始遊戲</button>
              <button className="secondary" onClick={() => hostAction("host:closeQuestion")} disabled={snapshot.status !== "question"}>提前公布答案</button>
              <button onClick={() => hostAction("host:nextQuestion")} disabled={snapshot.status !== "results"}>下一題</button>
              <button className="danger" onClick={() => hostAction("host:endGame")} disabled={snapshot.status === "finished"}>結束遊戲</button>
            </div>
            <p className="hint">每題會依題目設定自動倒數，時間到自動公布答案。通常只需要按「下一題」。</p>
            <p className="hint">成績會自動保存到 Supabase。需要匯出時，請到下方「歷史場次」下載 CSV。</p>
          </div>
          <RoomPanel snapshot={snapshot} />
        </section>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>歷史場次</h2>
            <p className="hint">接上 Supabase 後，已完成的場次會保留在這裡，Render 睡著或重啟也不會消失。</p>
          </div>
          <button className="secondary" onClick={() => fetchHistory(setHistory)}>重新整理</button>
        </div>
        {!history.enabled && <p className="notice">尚未設定 Supabase 環境變數，歷史場次目前不會永久保存。</p>}
        {history.enabled && history.sessions.length === 0 && <p className="empty">目前還沒有歷史場次。</p>}
        <div className="history-list">
          {history.sessions.map((session) => (
            <div className="history-row" key={session.id}>
              <div>
                <strong>{session.quiz_title}</strong>
                <p>{session.quiz_date} / 加入碼 {session.room_code} / {statusText(session.status)}</p>
              </div>
              <div className="history-meta">
                <span>{session.summary?.length || 0} 人</span>
                <a className="button-link secondary" href={`/api/history/${session.id}/summary.csv`}>summary.csv</a>
                <a className="button-link secondary" href={`/api/history/${session.id}/responses.csv`}>responses.csv</a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function JoinPage() {
  const params = new URLSearchParams(window.location.search);
  const initialRoom = params.get("room") || window.location.pathname.split("/").filter(Boolean)[1] || "";
  const savedStudent = readJson<{ id: string; roomCode: string; name?: string }>(studentStorageKey);
  const [roomCode, setRoomCode] = useState(initialRoom.toUpperCase());
  const [name, setName] = useState(savedStudent?.name || "");
  const [studentId, setStudentId] = useState(savedStudent?.id || "");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    socket.on("student:update", setSnapshot);
    return () => {
      socket.off("student:update", setSnapshot);
    };
  }, []);

  useEffect(() => {
    const resume = () => {
      if (!studentId || !roomCode || !snapshot?.me?.name) return;
      socket.emit("student:join", { roomCode, name: snapshot.me.name, studentId }, (reply: SocketReply) => {
        if (reply.ok) setSnapshot(reply.snapshot);
      });
    };

    socket.on("connect", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      socket.off("connect", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [roomCode, snapshot?.me?.name, studentId]);

  const join = () => {
    setMessage("");
    socket.emit("student:join", { roomCode, name, studentId }, (reply: SocketReply) => {
      if (!reply.ok) {
        setMessage(reply.error || "加入失敗。");
        return;
      }
      setStudentId(reply.studentId);
      localStorage.setItem(studentStorageKey, JSON.stringify({ id: reply.studentId, roomCode, name: reply.snapshot?.me?.name || name }));
      setSnapshot(reply.snapshot);
    });
  };

  if (!snapshot) {
    return (
      <main className="center-page">
        <section className="panel narrow">
          <h1>加入課堂問答</h1>
          <label>
            房間代碼
            <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="例如 A1B2C3" />
          </label>
          <label>
            姓名
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="請輸入你的名字" />
          </label>
          <button onClick={join}>加入等待室</button>
          {message && <p className="notice error">{message}</p>}
        </section>
      </main>
    );
  }

  return <StudentGame snapshot={snapshot} roomCode={roomCode} studentId={studentId} />;
}

function StudentGame({ snapshot, roomCode, studentId }: { snapshot: Snapshot; roomCode: string; studentId: string }) {
  const [message, setMessage] = useState("");

  const answer = (selectedIndex: number) => {
    setMessage("");
    socket.emit("student:answer", { roomCode, studentId, selectedIndex }, (reply: SocketReply) => {
      if (!reply.ok) setMessage(reply.error || "送出失敗。");
    });
  };

  return (
    <main className="app-shell student-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room {snapshot.roomCode}</p>
          <h1>{snapshot.quiz.title}</h1>
        </div>
        <span className="status-pill">{snapshot.me?.name}</span>
      </header>

      {snapshot.status === "waiting" && (
        <section className="panel hero-panel">
          <h2>已加入等待室</h2>
          <p>請等待老師開始遊戲。</p>
        </section>
      )}

      {(snapshot.status === "question" || snapshot.status === "results") && snapshot.question && (
        <section className="panel question-panel">
          <GameStatus snapshot={snapshot} />
          <h2>{snapshot.question.prompt}</h2>
          <div className="option-grid">
            {snapshot.question.options.map((option, index) => {
              const isSelected = snapshot.me?.selectedIndex === index;
              const isCorrect = snapshot.question?.answerIndex === index;
              const reveal = snapshot.status === "results";
              return (
                <button
                  key={option}
                  className={`option-button ${isSelected ? "selected" : ""} ${reveal && isCorrect ? "correct" : ""} ${reveal && isSelected && !isCorrect ? "wrong" : ""}`}
                  onClick={() => answer(index)}
                  disabled={snapshot.status !== "question" || snapshot.me?.answeredCurrent}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              );
            })}
          </div>
          {snapshot.me?.answeredCurrent && snapshot.status === "question" && <p className="notice">已送出答案。</p>}
          {message && <p className="notice error">{message}</p>}
          {snapshot.status === "results" && <ResultBlock snapshot={snapshot} />}
        </section>
      )}

      {snapshot.status === "finished" && (
        <section className="panel">
          <h2>遊戲結束</h2>
          <Leaderboard snapshot={snapshot} />
        </section>
      )}
    </main>
  );
}

function DisplayPage({ roomCode }: { roomCode: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    socket.emit("display:join", { roomCode: roomCode.toUpperCase() }, (reply: SocketReply) => {
      if (!reply.ok) setMessage(reply.error || "投影頁加入失敗。");
      else setSnapshot(reply.snapshot);
    });
    socket.on("room:update", setSnapshot);
    return () => {
      socket.off("room:update", setSnapshot);
    };
  }, [roomCode]);

  if (!snapshot) {
    return (
      <main className="center-page">
        <section className="panel narrow">
          <h1>投影頁</h1>
          <p>{message || "正在連線..."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="display-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Room {snapshot.roomCode}</p>
          <h1>{snapshot.quiz.title}</h1>
        </div>
        <span className="status-pill">{statusText(snapshot.status)}</span>
      </header>
      {snapshot.status === "waiting" && <RoomPanel snapshot={snapshot} />}
      {(snapshot.status === "question" || snapshot.status === "results") && snapshot.question && (
        <section className="panel question-panel">
          <GameStatus snapshot={snapshot} />
          <h2>{snapshot.question.prompt}</h2>
          <div className="display-options">
            {snapshot.question.options.map((option, index) => (
              <div className={`display-option ${snapshot.question?.answerIndex === index ? "correct" : ""}`} key={option}>
                <span>{String.fromCharCode(65 + index)}</span>
                {option}
              </div>
            ))}
          </div>
          {snapshot.status === "results" && <ResultBlock snapshot={snapshot} />}
        </section>
      )}
      {snapshot.status === "finished" && (
        <section className="panel">
          <h2>最終排行榜</h2>
          <Leaderboard snapshot={snapshot} />
        </section>
      )}
    </main>
  );
}

function RoomPanel({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="panel">
      <h2>等待室</h2>
      <p className="big-code">{snapshot.roomCode}</p>
      <p className="hint">這是加入碼。學生點連結會自動帶入；沒有連結時，也可以在加入頁輸入這組代碼。</p>
      <div className="student-list">
        {snapshot.students.map((student) => (
          <div className="student-row" key={student.id}>
            <span>{student.name}</span>
            <span>{student.answeredCurrent ? "已答" : student.connected ? "在線" : "離線"}</span>
          </div>
        ))}
        {snapshot.students.length === 0 && <p className="empty">尚無學生加入。</p>}
      </div>
    </div>
  );
}

function GameStatus({ snapshot }: { snapshot: Snapshot }) {
  const [tick, setTick] = useState(Date.now());
  const [baseline, setBaseline] = useState({ remainingMs: snapshot.timeRemainingMs, receivedAt: Date.now() });

  useEffect(() => {
    setBaseline({ remainingMs: snapshot.timeRemainingMs, receivedAt: Date.now() });
  }, [snapshot.status, snapshot.currentQuestionIndex, snapshot.timeRemainingMs]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.ceil((baseline.remainingMs - (tick - baseline.receivedAt)) / 1000));

  return (
    <div className="game-status">
      <span>{statusText(snapshot.status)}</span>
      <span>第 {Math.max(0, snapshot.currentQuestionIndex) + 1} / {snapshot.quiz.questionCount} 題</span>
      {snapshot.status === "question" && <span>{seconds} 秒</span>}
    </div>
  );
}

function ResultBlock({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="results-grid">
      <div>
        <h3>作答統計</h3>
        <div className="stats-list">
          {snapshot.question?.options.map((option, index) => (
            <div key={option}>
              {String.fromCharCode(65 + index)}. {option}: {snapshot.stats?.optionCounts[index] || 0}
            </div>
          ))}
          <div>未作答: {snapshot.stats?.unanswered || 0}</div>
        </div>
        {snapshot.question?.explanation && <p className="explanation">{snapshot.question.explanation}</p>}
      </div>
      <Leaderboard snapshot={snapshot} compact />
    </div>
  );
}

function Leaderboard({ snapshot, compact = false }: { snapshot: Snapshot; compact?: boolean }) {
  const rows = compact ? snapshot.ranking.slice(0, 5) : snapshot.ranking;
  return (
    <div className="leaderboard">
      {rows.map((student) => (
        <div className="rank-row" key={student.id}>
          <span>#{student.rank}</span>
          <strong>{student.name}</strong>
          <span>{student.totalScore} 分</span>
        </div>
      ))}
      {rows.length === 0 && <p className="empty">尚無排名。</p>}
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="copy-line">
      <span>{label}</span>
      <input value={value} readOnly />
      <button className="secondary" onClick={() => navigator.clipboard?.writeText(value)}>複製</button>
    </div>
  );
}

function statusText(status: Snapshot["status"]) {
  const labels = {
    waiting: "等待中",
    question: "作答中",
    results: "公布答案",
    finished: "已結束"
  };
  return labels[status];
}

type SocketReply = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  hostToken?: string;
  studentId?: string;
  snapshot?: Snapshot;
};

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function fetchHistory(setHistory: React.Dispatch<React.SetStateAction<{ enabled: boolean; sessions: HistorySession[] }>>) {
  fetch("/api/history")
    .then((response) => response.json())
    .then((data) => setHistory({ enabled: Boolean(data.enabled), sessions: data.sessions || [] }))
    .catch(() => setHistory({ enabled: false, sessions: [] }));
}

createRoot(document.getElementById("root")!).render(<App />);
