import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import "./styles.css";

type QuizSummary = {
  id: string;
  title: string;
  date: string;
  questionCount: number;
  defaultTimeLimitSec: number;
  file: string;
};

type QuizQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  timeLimitSec?: number;
};

type QuizDetail = Omit<QuizSummary, "questionCount" | "file"> & {
  questions: QuizQuestion[];
};

type Snapshot = {
  roomCode: string;
  status: "waiting" | "question" | "results" | "finished";
  quiz: { id: string; title: string; date: string; questionCount: number };
  currentQuestionIndex: number;
  timeRemainingMs: number;
  questionTimeLimitMs: number;
  autoRevealRemainingMs: number;
  autoRevealDelayMs: number;
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

type HistoryDetail = HistorySession & {
  responses: Array<{
    studentName: string;
    questionIndex: number;
    prompt: string;
    options?: string[];
    selectedIndex: number | "";
    selectedText: string;
    correctIndex: number;
    correctText?: string;
    isCorrect: boolean;
    responseMs: number | "";
    score: number;
  }>;
  summary: Array<{
    rank: number;
    studentName: string;
    totalScore: number;
    correctCount: number;
    totalQuestions: number;
    accuracy: string;
    avgResponseMs: number;
  }>;
};

const socket: Socket = io();
const hostStorageKey = "classroom-live-quiz-host";
const studentStorageKey = "classroom-live-quiz-student";
const teacherAuthStorageKey = "classroom-live-quiz-teacher-auth";

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
  const [questionCount, setQuestionCount] = useState("10");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [history, setHistory] = useState<{ enabled: boolean; sessions: HistorySession[] }>({ enabled: false, sessions: [] });
  const [historyDetails, setHistoryDetails] = useState<Record<string, HistoryDetail>>({});
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [savedHost, setSavedHost] = useState<{ roomCode: string; hostToken: string; quizTitle?: string } | null>(null);
  const [resumeMessage, setResumeMessage] = useState("");
  const [message, setMessage] = useState("");
  const [previewQuiz, setPreviewQuiz] = useState<QuizDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem(teacherAuthStorageKey) === "ok");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((data) => {
        const required = Boolean(data.teacherPasswordRequired);
        setPasswordRequired(required);
        if (!required || localStorage.getItem(teacherAuthStorageKey) === "ok") {
          setAuthenticated(true);
        }
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));

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

    const handleHostUpdate = (nextSnapshot: Snapshot) => {
      const saved = readJson<{ roomCode: string; hostToken: string }>(hostStorageKey);
      if (saved?.roomCode && saved?.hostToken) {
        if (saved.roomCode === nextSnapshot.roomCode && saved.hostToken === nextSnapshot.hostToken) {
          setSnapshot(nextSnapshot);
        }
        return;
      }

      setSnapshot((current) => {
        if (current?.roomCode === nextSnapshot.roomCode && current.hostToken === nextSnapshot.hostToken) {
          return nextSnapshot;
        }
        return current;
      });
    };

    socket.on("host:update", handleHostUpdate);
    return () => {
      socket.off("host:update", handleHostUpdate);
    };
  }, []);

  useEffect(() => {
    const resumeHostSession = () => {
      const currentHost = snapshot?.roomCode && snapshot.hostToken
        ? { roomCode: snapshot.roomCode, hostToken: snapshot.hostToken }
        : readJson<{ roomCode: string; hostToken: string }>(hostStorageKey);

      if (!currentHost?.roomCode || !currentHost.hostToken) return;

      socket.emit("host:resume", currentHost, (reply: SocketReply) => {
        if (reply.ok && reply.snapshot) {
          setSnapshot(reply.snapshot);
          setSavedHost(null);
        }
      });
    };

    socket.on("connect", resumeHostSession);
    window.addEventListener("focus", resumeHostSession);
    document.addEventListener("visibilitychange", resumeHostSession);
    if (socket.connected) resumeHostSession();
    return () => {
      socket.off("connect", resumeHostSession);
      window.removeEventListener("focus", resumeHostSession);
      document.removeEventListener("visibilitychange", resumeHostSession);
    };
  }, [snapshot?.roomCode, snapshot?.hostToken]);

  useEffect(() => {
    setPreviewQuiz(null);
    setPreviewMessage("");
  }, [selectedQuizId]);

  const loginTeacher = () => {
    setAuthMessage("");
    fetch("/api/auth/teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "老師密碼錯誤。");
        localStorage.setItem(teacherAuthStorageKey, "ok");
        setAuthenticated(true);
      })
      .catch((error) => setAuthMessage(error.message));
  };

  const createRoom = () => {
    setMessage("");
    socket.emit("host:createRoom", { quizId: selectedQuizId, questionCount }, (reply: SocketReply) => {
      if (!reply.ok) {
        setMessage(reply.error || "建立房間失敗。");
        return;
      }
      localStorage.setItem(hostStorageKey, JSON.stringify({ roomCode: reply.roomCode, hostToken: reply.hostToken, quizTitle: reply.snapshot?.quiz.title }));
      setSavedHost(null);
      setSnapshot(reply.snapshot);
    });
  };

  const createReviewRoom = () => {
    setMessage("");
    socket.emit("host:createReviewRoom", { sessionIds: selectedHistoryIds }, (reply: SocketReply) => {
      if (!reply.ok) {
        setMessage(reply.error || "建立錯題重練場次失敗。");
        return;
      }
      localStorage.setItem(hostStorageKey, JSON.stringify({ roomCode: reply.roomCode, hostToken: reply.hostToken, quizTitle: reply.snapshot?.quiz.title }));
      setSavedHost(null);
      setSnapshot(reply.snapshot);
      setSelectedHistoryIds([]);
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
    if (snapshot && !window.confirm("確定要建立新場次嗎？目前控制頁會離開現在這場。")) return;
    if (snapshot?.hostToken) {
      socket.emit("host:leaveRoom", { roomCode: snapshot.roomCode, hostToken: snapshot.hostToken });
    }
    localStorage.removeItem(hostStorageKey);
    setSnapshot(null);
    setSavedHost(null);
    setResumeMessage("");
    setMessage("");
  };

  const hostAction = (eventName: string) => {
    if (!snapshot?.hostToken) return;
    if (eventName === "host:endGame" && !window.confirm("確定要結束遊戲嗎？結束後不能回到這一題繼續作答。")) return;
    setMessage("");
    socket.emit(eventName, { roomCode: snapshot.roomCode, hostToken: snapshot.hostToken }, (reply: SocketReply) => {
      if (!reply.ok) setMessage(reply.error || "操作失敗。");
    });
  };

  const previewSelectedQuiz = () => {
    if (!selectedQuizId) return;
    setPreviewLoading(true);
    setPreviewMessage("");
    fetch(`/api/quizzes/${encodeURIComponent(selectedQuizId)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "載入題目預覽失敗。");
        setPreviewQuiz(data.quiz);
      })
      .catch((error) => {
        setPreviewQuiz(null);
        setPreviewMessage(error.message);
      })
      .finally(() => setPreviewLoading(false));
  };

  const isLocalOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const joinUrl = snapshot ? `${window.location.origin}/join?room=${snapshot.roomCode}` : "";
  const lanJoinUrls = snapshot && networkInfo && isLocalOrigin ? networkInfo.lan.map((url) => `${url}/join?room=${snapshot.roomCode}`) : [];
  const primaryJoinUrl = lanJoinUrls[0] || joinUrl;
  const displayUrl = snapshot ? `${window.location.origin}/display/${snapshot.roomCode}` : "";
  const isLastQuestion = snapshot ? snapshot.currentQuestionIndex >= snapshot.quiz.questionCount - 1 : false;

  if (!authReady) {
    return (
      <main className="center-page">
        <section className="panel narrow">
          <h1>老師控制頁</h1>
          <p>正在檢查老師權限...</p>
        </section>
      </main>
    );
  }

  if (passwordRequired && !authenticated) {
    return (
      <main className="center-page">
        <section className="panel narrow">
          <h1>老師控制頁</h1>
          <p className="hint">請輸入老師管理密碼。</p>
          <label>
            老師密碼
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loginTeacher()} />
          </label>
          <button onClick={loginTeacher}>登入</button>
          {authMessage && <p className="notice error">{authMessage}</p>}
        </section>
      </main>
    );
  }

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
          <div className="quiz-select-row">
            <select value={selectedQuizId} onChange={(event) => setSelectedQuizId(event.target.value)} disabled={Boolean(snapshot)}>
              {quizzes.map((quiz) => (
                <option value={quiz.id} key={quiz.id}>
                  {quiz.date} - {quiz.title} ({quiz.questionCount} 題)
                </option>
              ))}
            </select>
            <button className="secondary" onClick={previewSelectedQuiz} disabled={!selectedQuizId || previewLoading}>
              {previewLoading ? "載入中" : "預覽題目"}
            </button>
          </div>
          <label>
            每場題數
            <select value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} disabled={Boolean(snapshot)}>
              <option value="10">隨機 10 題</option>
              <option value="5">隨機 5 題</option>
              <option value="15">隨機 15 題</option>
              <option value="20">隨機 20 題</option>
              <option value="all">全部題目</option>
            </select>
          </label>
          <div className="actions">
            <button onClick={createRoom} disabled={!selectedQuizId || Boolean(snapshot)}>建立場次</button>
            <button className="secondary" onClick={resetRoom}>建立新場次</button>
          </div>
          {message && <p className="notice error">{message}</p>}
          {previewMessage && <p className="notice error">{previewMessage}</p>}
        </div>

        <div className="panel">
          <h2>學生加入方式</h2>
          {snapshot ? (
            <>
              <div className="qr-panel qr-panel-stacked">
                <QRCodeSVG value={primaryJoinUrl} size={180} />
                <div className="qr-room-code">
                  <span>加入碼</span>
                  <strong>{snapshot.roomCode}</strong>
                </div>
              </div>
              <CopyLine label="加入連結" value={primaryJoinUrl} />
              <CopyLine label="投影頁" value={displayUrl} />
            </>
          ) : (
            <p className="empty">建立場次後會顯示連結和加入碼。</p>
          )}
          <p className="hint">老師頁重新整理通常可以恢復；但 Render 重新部署、重啟或免費方案睡著後，進行中的場次會失效。已保存到 Supabase 的歷史資料不會消失。</p>
          {snapshot && <RoomPanel snapshot={snapshot} embedded />}
        </div>
      </section>

      {previewQuiz && <QuizPreviewPanel quiz={previewQuiz} />}

      {snapshot && (
        <section className="grid two">
          <div className="panel">
            <h2>遊戲控制</h2>
            <GameStatus snapshot={snapshot} />
            <div className="actions">
              <button onClick={() => hostAction("host:startGame")} disabled={snapshot.status !== "waiting"}>開始遊戲</button>
              <button className="secondary" onClick={() => hostAction("host:closeQuestion")} disabled={snapshot.status !== "question"}>提前公布答案</button>
              <button onClick={() => hostAction("host:nextQuestion")} disabled={snapshot.status !== "results" || isLastQuestion}>下一題</button>
              <button className="danger" onClick={() => hostAction("host:endGame")} disabled={snapshot.status === "finished"}>結束遊戲</button>
            </div>
            <p className="hint">每題會依題目設定自動倒數，時間到自動公布答案。非最後一題時按「下一題」，最後一題請按「結束遊戲」。</p>
            <p className="hint">成績會自動保存到 Supabase，可在下方「歷史場次」查看紀錄並建立錯題重練。</p>
          </div>
          <HostQuestionPanel snapshot={snapshot} />
          {snapshot.status === "finished" && (
            <section className="panel final-score-panel">
              <h2>結算分數</h2>
              <Leaderboard snapshot={snapshot} />
            </section>
          )}
        </section>
      )}

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>歷史場次</h2>
            <p className="hint">接上 Supabase 後，已完成的場次會保留在這裡，Render 睡著或重啟也不會消失。</p>
          </div>
          <div className="actions compact">
            <button onClick={createReviewRoom} disabled={selectedHistoryIds.length === 0 || Boolean(snapshot)}>從勾選場次建立錯題重練</button>
            <button className="secondary" onClick={() => fetchHistory(setHistory)}>重新整理</button>
          </div>
        </div>
        {selectedHistoryIds.length > 0 && <p className="hint">已勾選 {selectedHistoryIds.length} 場；錯題重練會整合答錯和未作答題目，最多 10 題。</p>}
        {!history.enabled && <p className="notice">尚未設定 Supabase 環境變數，歷史場次目前不會永久保存。</p>}
        {history.enabled && history.sessions.length === 0 && <p className="empty">目前還沒有歷史場次。</p>}
        <div className="history-list">
          {history.sessions.map((session) => (
            <div className="history-row" key={session.id}>
              <div>
                <label className="history-check">
                  <input
                    type="checkbox"
                    checked={selectedHistoryIds.includes(session.id)}
                    onChange={(event) => toggleSelectedHistory(session.id, event.target.checked, setSelectedHistoryIds)}
                  />
                  <span>
                    <strong>{formatDateTime(session.created_at)}｜{session.quiz_title}</strong>
                    <p>加入碼 {session.room_code} / {statusText(session.status)}</p>
                  </span>
                </label>
              </div>
              <div className="history-meta">
                <span>{session.summary?.length || 0} 人</span>
                <button className="secondary" onClick={() => toggleHistoryDetail(session.id, historyDetails, setHistoryDetails)}>
                  {historyDetails[session.id] ? "收合紀錄" : "查看紀錄"}
                </button>
              </div>
              {historyDetails[session.id] && <HistoryDetailPanel detail={historyDetails[session.id]} />}
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
        <span className="status-pill student-score-pill">
          <span>{snapshot.me?.name}</span>
          <strong>{snapshot.me?.totalScore ?? 0} 分</strong>
        </span>
      </header>

      {snapshot.status === "waiting" && (
        <section className="panel hero-panel">
          <h2>已加入等待室</h2>
          <p>請等待老師開始遊戲。</p>
        </section>
      )}

      {(snapshot.status === "question" || snapshot.status === "results") && snapshot.question && (
        <section className="panel question-panel">
          <StudentTimerBar snapshot={snapshot} />
          <h2>{snapshot.question.prompt}</h2>
          <QuestionOptions
            snapshot={snapshot}
            onAnswer={answer}
            disabled={snapshot.status !== "question" || Boolean(snapshot.me?.answeredCurrent)}
            showCounts={snapshot.status === "results"}
          />
          {snapshot.me?.answeredCurrent && snapshot.status === "question" && <p className="notice">已送出答案。</p>}
          {message && <p className="notice error">{message}</p>}
          {snapshot.status === "results" && <ResultBlock snapshot={snapshot} showStats={false} />}
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
          <QuestionOptions snapshot={snapshot} variant="display" showCounts={snapshot.status === "results"} />
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

function RoomPanel({ snapshot, embedded = false }: { snapshot: Snapshot; embedded?: boolean }) {
  return (
    <div className={embedded ? "room-panel embedded" : "panel room-panel"}>
      <h2>等待室</h2>
      <p className="big-code">{snapshot.roomCode}</p>
      <p className="hint">這是加入碼。學生點連結會自動帶入；沒有連結時，也可以在加入頁輸入這組代碼。</p>
      <div className="student-list">
        {snapshot.students.map((student) => (
          <div className="student-row" key={student.id}>
            <span className="student-name">{student.name}</span>
            <span className="student-score">{student.totalScore} 分</span>
            <span className={`student-status ${student.connected ? "online" : "offline"}`}>
              {student.answeredCurrent ? "已答" : student.connected ? "在線" : "離線"}
            </span>
          </div>
        ))}
        {snapshot.students.length === 0 && <p className="empty">尚無學生加入。</p>}
      </div>
    </div>
  );
}

function StudentTimerBar({ snapshot }: { snapshot: Snapshot }) {
  const isAutoReveal = snapshot.status === "question" && snapshot.autoRevealRemainingMs > 0;
  const activeRemainingMs = isAutoReveal ? snapshot.autoRevealRemainingMs : snapshot.timeRemainingMs;
  const activeTotalMs = isAutoReveal ? snapshot.autoRevealDelayMs : snapshot.questionTimeLimitMs;
  const [tick, setTick] = useState(Date.now());
  const [baseline, setBaseline] = useState({
    remainingMs: activeRemainingMs,
    totalMs: activeTotalMs,
    receivedAt: Date.now()
  });

  useEffect(() => {
    setBaseline({
      remainingMs: activeRemainingMs,
      totalMs: activeTotalMs,
      receivedAt: Date.now()
    });
  }, [
    snapshot.status,
    snapshot.currentQuestionIndex,
    snapshot.timeRemainingMs,
    snapshot.autoRevealRemainingMs,
    snapshot.questionTimeLimitMs,
    snapshot.autoRevealDelayMs
  ]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = snapshot.status === "question"
    ? Math.max(0, baseline.remainingMs - (tick - baseline.receivedAt))
    : 0;
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const percent = baseline.totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / baseline.totalMs) * 100)) : 0;

  return (
    <div className={`student-timer ${isAutoReveal ? "auto-reveal" : ""}`}>
      <div className="student-timer-meta">
        <span>{isAutoReveal ? "即將公布答案" : statusText(snapshot.status)}</span>
        <span>第 {Math.max(0, snapshot.currentQuestionIndex) + 1} / {snapshot.quiz.questionCount} 題</span>
      </div>
      <div className="student-timer-track" aria-label={isAutoReveal ? "即將公布答案倒數" : "作答倒數"}>
        <div className="student-timer-fill" style={{ width: `${percent}%` }} />
        <strong>{isAutoReveal ? `${seconds} 秒後公布` : `${seconds} 秒`}</strong>
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

function HostQuestionPanel({ snapshot }: { snapshot: Snapshot }) {
  if (!snapshot.question || snapshot.currentQuestionIndex < 0 || snapshot.status === "waiting") return null;
  return (
    <div className="panel question-panel host-question-panel">
      <h2>{snapshot.question.prompt}</h2>
      <QuestionOptions snapshot={snapshot} showCounts />
      {snapshot.status === "results" && <ResultBlock snapshot={snapshot} showStats={false} />}
    </div>
  );
}

function QuestionOptions({
  snapshot,
  onAnswer,
  disabled = true,
  showCounts = false,
  variant = "answer"
}: {
  snapshot: Snapshot;
  onAnswer?: (selectedIndex: number) => void;
  disabled?: boolean;
  showCounts?: boolean;
  variant?: "answer" | "display";
}) {
  const reveal = snapshot.status === "results" || snapshot.status === "finished";
  const answerIndex = snapshot.question?.answerIndex ?? null;
  const selectedIndex = snapshot.me?.selectedIndex ?? null;
  const gridClass = variant === "display" ? "display-options" : "option-grid";
  const optionClass = variant === "display" ? "display-option" : "option-button";

  return (
    <div className={gridClass}>
      {snapshot.question?.options.map((option, index) => {
        const isSelected = selectedIndex === index;
        const isCorrect = reveal && answerIndex === index;
        const isWrong = reveal && isSelected && answerIndex !== null && answerIndex !== index;
        const className = `${optionClass} ${isSelected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`;
        const content = (
          <>
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span className="option-text">{option}</span>
            {showCounts && <span className="option-count">{snapshot.stats?.optionCounts[index] || 0} 人</span>}
          </>
        );

        if (!onAnswer) {
          return (
            <div className={className} key={`${index}-${option}`}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={`${index}-${option}`}
            className={className}
            onClick={() => onAnswer(index)}
            disabled={disabled}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

function ResultBlock({ snapshot, showStats = true }: { snapshot: Snapshot; showStats?: boolean }) {
  return (
    <div className="results-grid">
      <div className="result-details">
        {snapshot.question?.explanation && (
          <section className="result-explanation">
            <h3>題目答案的解釋</h3>
            <p className="explanation">{snapshot.question.explanation}</p>
          </section>
        )}
        {showStats && <section className="answer-stats-section">
          <h3>作答統計</h3>
          <AnswerStats snapshot={snapshot} revealCorrect />
        </section>}
      </div>
      <Leaderboard snapshot={snapshot} compact />
    </div>
  );
}

function AnswerStats({ snapshot, revealCorrect }: { snapshot: Snapshot; revealCorrect: boolean }) {
  return (
    <div className="answer-stat-grid">
      {snapshot.question?.options.map((option, index) => {
        const isCorrect = revealCorrect && snapshot.question?.answerIndex === index;
        return (
          <div className={`answer-stat-card ${isCorrect ? "correct" : ""}`} key={`${index}-${option}`}>
            <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
            <span className="answer-text">{option}</span>
            <span className="answer-count">{snapshot.stats?.optionCounts[index] || 0}</span>
          </div>
        );
      })}
      <div className="answer-stat-card unanswered">
        <span className="answer-letter">-</span>
        <span className="answer-text">未作答</span>
        <span className="answer-count">{snapshot.stats?.unanswered || 0}</span>
      </div>
    </div>
  );
}

function Leaderboard({ snapshot, compact = false }: { snapshot: Snapshot; compact?: boolean }) {
  const rows = compact ? snapshot.ranking.slice(0, 5) : snapshot.ranking;
  return (
    <div className="leaderboard">
      {rows.map((student) => (
        <div className={`rank-row ${student.rank <= 4 ? `rank-award rank-${student.rank}` : ""}`} key={student.id}>
          <span className="rank-badge">#{student.rank}</span>
          <strong className="rank-name">{student.name}</strong>
          <span className="score-badge">{student.totalScore} 分</span>
        </div>
      ))}
      {rows.length === 0 && <p className="empty">尚無排名。</p>}
    </div>
  );
}

function QuizPreviewPanel({ quiz }: { quiz: QuizDetail }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className={`panel quiz-preview-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="section-header">
        <div>
          <h2>題目預覽</h2>
          <p className="hint">
            {quiz.date}｜{quiz.title}｜共 {quiz.questions.length} 題｜預設 {quiz.defaultTimeLimitSec} 秒
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "展開題目" : "收合題目"}
        </button>
      </div>
      {collapsed ? (
        <p className="quiz-preview-collapsed-note">題目清單已收合，共 {quiz.questions.length} 題。</p>
      ) : (
        <div className="quiz-preview-list">
          {quiz.questions.map((question, questionIndex) => (
            <article className="quiz-preview-question" key={`${questionIndex}-${question.prompt}`}>
              <div className="quiz-preview-question-head">
                <span>第 {questionIndex + 1} 題</span>
                <strong>{question.prompt}</strong>
                <small>{question.timeLimitSec || quiz.defaultTimeLimitSec} 秒</small>
              </div>
              <div className="quiz-preview-options">
                {question.options.map((option, optionIndex) => {
                  const isCorrect = optionIndex === question.answerIndex;
                  return (
                    <div className={`quiz-preview-option ${isCorrect ? "correct" : ""}`} key={`${optionIndex}-${option}`}>
                      <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                      <span className="option-text">{option}</span>
                      {isCorrect && <span className="correct-label">正解</span>}
                    </div>
                  );
                })}
              </div>
              {question.explanation && (
                <div className="preview-explanation">
                  <strong>解析</strong>
                  <p>{question.explanation}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HistoryDetailPanel({ detail }: { detail: HistoryDetail }) {
  const questions = groupResponsesByQuestion(detail.responses || []);
  const mistakeSummaries = buildMistakeSummaries(detail);
  return (
    <div className="history-detail">
      <h3>錯題重練建議</h3>
      {mistakeSummaries.length === 0 ? (
        <p className="empty">這一場沒有錯題。</p>
      ) : (
        <div className="mistake-list">
          {mistakeSummaries.slice(0, 5).map((item) => (
            <div className="mistake-row" key={`${item.questionIndex}-${item.prompt}`}>
              <span>第 {item.questionIndex + 1} 題</span>
              <strong>{item.prompt}</strong>
              <span>{item.mistakeCount} 人錯/未答</span>
            </div>
          ))}
        </div>
      )}

      <h3>排行榜</h3>
      <div className="history-table">
        <div className="history-table-head">
          <span>名次</span>
          <span>姓名</span>
          <span>分數</span>
          <span>答對</span>
          <span>正確率</span>
        </div>
        {detail.summary.map((row) => (
          <div className="history-table-row" key={`${row.rank}-${row.studentName}`}>
            <span>#{row.rank}</span>
            <span>{row.studentName}</span>
            <span>{row.totalScore}</span>
            <span>{row.correctCount} / {row.totalQuestions}</span>
            <span>{row.accuracy}</span>
          </div>
        ))}
      </div>

      <h3>每題答題狀況</h3>
      {questions.map((question) => (
        <div className="question-review" key={question.questionIndex}>
          <strong>第 {question.questionIndex + 1} 題：{question.prompt}</strong>
          <div className="answer-chip-list">
            {question.responses.map((response) => (
              <span className={`answer-chip ${response.isCorrect ? "correct" : "wrong"}`} key={`${response.studentName}-${response.questionIndex}`}>
                {response.studentName}: {response.isCorrect ? "答對" : "答錯"}{response.selectedText ? ` (${response.selectedText})` : " (未作答)"}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildMistakeSummaries(detail: HistoryDetail) {
  const totalStudents = detail.summary.length;
  return groupResponsesByQuestion(detail.responses || [])
    .map((question) => {
      const wrongAnswers = question.responses.filter((response) => !response.isCorrect).length;
      const unanswered = Math.max(0, totalStudents - question.responses.length);
      return {
        questionIndex: question.questionIndex,
        prompt: question.prompt,
        mistakeCount: wrongAnswers + unanswered
      };
    })
    .filter((item) => item.mistakeCount > 0)
    .sort((a, b) => b.mistakeCount - a.mistakeCount || a.questionIndex - b.questionIndex);
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 1800);
    }
  };

  return (
    <div className="copy-line">
      <span>{label}</span>
      <input value={value} readOnly />
      <button className="secondary" onClick={copy}>{copied ? "已複製網址" : copyFailed ? "複製失敗" : "複製"}</button>
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

function groupResponsesByQuestion(responses: HistoryDetail["responses"]) {
  const groups = new Map<number, { questionIndex: number; prompt: string; responses: HistoryDetail["responses"] }>();
  for (const response of responses) {
    if (!groups.has(response.questionIndex)) {
      groups.set(response.questionIndex, {
        questionIndex: response.questionIndex,
        prompt: response.prompt,
        responses: []
      });
    }
    groups.get(response.questionIndex)?.responses.push(response);
  }
  return [...groups.values()].sort((a, b) => a.questionIndex - b.questionIndex);
}

function toggleHistoryDetail(
  sessionId: string,
  details: Record<string, HistoryDetail>,
  setDetails: React.Dispatch<React.SetStateAction<Record<string, HistoryDetail>>>
) {
  if (details[sessionId]) {
    setDetails((current) => {
      const next = { ...current };
      delete next[sessionId];
      return next;
    });
    return;
  }

  fetch(`/api/history/${sessionId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.session) {
        setDetails((current) => ({ ...current, [sessionId]: data.session }));
      }
    });
}

function toggleSelectedHistory(
  sessionId: string,
  selected: boolean,
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
) {
  setSelected((current) => {
    if (selected) return current.includes(sessionId) ? current : [...current, sessionId];
    return current.filter((id) => id !== sessionId);
  });
}

function formatDateTime(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function fetchHistory(setHistory: React.Dispatch<React.SetStateAction<{ enabled: boolean; sessions: HistorySession[] }>>) {
  fetch("/api/history")
    .then((response) => response.json())
    .then((data) => setHistory({ enabled: Boolean(data.enabled), sessions: data.sessions || [] }))
    .catch(() => setHistory({ enabled: false, sessions: [] }));
}

createRoot(document.getElementById("root")!).render(<App />);
