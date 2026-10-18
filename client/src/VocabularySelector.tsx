import React, { useEffect, useRef, useState } from "react";

export type VocabularyCatalogue = {
  lessons: Array<{ lesson: number; title: string; wordCount: number }>;
  totalWords: number;
  availableLessons: number;
};

function GroupCheckbox({ checked, mixed, disabled, onChange, label }: {
  checked: boolean; mixed: boolean; disabled: boolean; onChange: () => void; label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <input ref={ref} type="checkbox" checked={checked} aria-checked={mixed ? "mixed" : checked} aria-label={label} disabled={disabled} onChange={onChange} />;
}

export function VocabularySelector({ selected, onChange, catalogue, onCatalogue, disabled }: {
  selected: number[]; onChange: (lessons: number[]) => void; catalogue: VocabularyCatalogue | null;
  onCatalogue: (catalogue: VocabularyCatalogue) => void; disabled: boolean;
}) {
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<number[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/vocabulary/catalogue", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "單字課程暫時無法載入。");
        onCatalogue(data);
      })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt, onCatalogue]);

  const available = catalogue?.lessons.filter((item) => item.wordCount > 0).map((item) => item.lesson) || [];
  const selectedWords = catalogue?.lessons.filter((item) => selected.includes(item.lesson)).reduce((sum, item) => sum + item.wordCount, 0) || 0;
  const toggle = (lessons: number[]) => {
    const allSelected = lessons.every((lesson) => selected.includes(lesson));
    onChange(allSelected ? selected.filter((lesson) => !lessons.includes(lesson)) : [...new Set([...selected, ...lessons])].sort((a, b) => a - b));
  };

  return (
    <details className="vocabulary-selector">
      <summary className="vocabulary-selector-heading">
        <span>
          <strong>單字測驗</strong>
          <small>{selected.length > 0 ? `已選 ${selected.length} 課・${selectedWords} 個單字` : "進階第 1～133 課・尚未選課"}</small>
        </span>
        <span className="vocabulary-disclosure-closed">展開 ▾</span>
        <span className="vocabulary-disclosure-open">收合 ▴</span>
      </summary>
      <fieldset className="vocabulary-selector-content" aria-label="單字課次選擇" disabled={disabled}>
      <p className="hint">English Quest 進階第 1～133 課・英→中／中→英混合四選一</p>
      <p className="hint">勾選整組可一次選 10 課；按「展開」可單獨勾選篇章。可與上方題庫混合出題。</p>
      {!catalogue && !error && <p role="status">正在載入 133 課單字，首次載入約需數秒…</p>}
      {error && <div role="alert"><p className="notice error">{error}</p><button type="button" className="secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>重新載入單字</button></div>}
      {catalogue && <>
        <div className="vocabulary-toolbar">
          <span aria-live="polite">已選 {selected.length} 課・{selectedWords} 個單字</span>
          <div className="actions compact">
            <button type="button" className="secondary btn-sm" onClick={() => onChange(available)} disabled={disabled || selected.length === available.length}>全選單字</button>
            <button type="button" className="secondary btn-sm" onClick={() => onChange([])} disabled={disabled || !selected.length}>清除單字</button>
          </div>
        </div>
        {catalogue.availableLessons < 133 && <p role="status" className="notice">目前有 {catalogue.availableLessons} 課可用；沒有資料的課次無法勾選。</p>}
        <div className="vocabulary-groups">
          {Array.from({ length: 14 }, (_, groupIndex) => {
            const start = groupIndex * 10 + 1;
            const end = Math.min(start + 9, 133);
            const items = catalogue.lessons.filter((item) => item.lesson >= start && item.lesson <= end);
            const enabled = items.filter((item) => item.wordCount > 0).map((item) => item.lesson);
            const count = enabled.filter((lesson) => selected.includes(lesson)).length;
            const open = expanded.includes(start);
            return <div key={start} className={`vocabulary-group ${count ? "has-selection" : ""}`}>
              <div className="vocabulary-group-head">
                <label>
                  <GroupCheckbox checked={enabled.length > 0 && count === enabled.length} mixed={count > 0 && count < enabled.length} disabled={disabled || !enabled.length} label={`整組勾選第 ${start}～${end} 課`} onChange={() => toggle(enabled)} />
                  <span><strong>第 {start}～{end} 課</strong><small>已選 {count} / {enabled.length} 課</small></span>
                </label>
                <button type="button" className="secondary btn-sm" aria-expanded={open} aria-controls={`vocabulary-group-${start}`} aria-label={`${open ? "收合" : "展開"}第 ${start}～${end} 課`} onClick={() => setExpanded((current) => open ? current.filter((n) => n !== start) : [...current, start])}>{open ? "收合 ▴" : "展開 ▾"}</button>
              </div>
              {open && <div id={`vocabulary-group-${start}`} className="vocabulary-lessons">
                {items.map((item) => <label key={item.lesson} className={`quiz-check-option ${selected.includes(item.lesson) ? "selected" : ""}`}>
                  <input type="checkbox" aria-label={`單字第 ${item.lesson} 課`} checked={selected.includes(item.lesson)} disabled={disabled || !item.wordCount} onChange={() => toggle([item.lesson])} />
                  <span><strong>{item.title === `第 ${item.lesson} 課` ? item.title : `第 ${item.lesson} 課｜${item.title}`}</strong><small>{item.wordCount ? `${item.wordCount} 個單字` : "尚無資料"}</small></span>
                </label>)}
              </div>}
            </div>;
          })}
        </div>
      </>}
      </fieldset>
    </details>
  );
}
