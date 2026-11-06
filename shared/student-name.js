export const STUDENT_NAME_MAX_LENGTH = 10;

const nameSegmenter = typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

export function normalizeStudentName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function nameCharacters(value) {
  const name = normalizeStudentName(value);
  return nameSegmenter
    ? Array.from(nameSegmenter.segment(name), ({ segment }) => segment)
    : Array.from(name);
}

export function getStudentNameLength(value) {
  return nameCharacters(value).length;
}

export function validateStudentName(value) {
  const length = getStudentNameLength(value);
  if (length === 0) return "請輸入姓名。";
  if (length > STUDENT_NAME_MAX_LENGTH) return `名字太長，最多只能輸入 ${STUDENT_NAME_MAX_LENGTH} 個字。`;
  return "";
}

// 只供重名自動編號騰出空間；使用者輸入超長時必須提示，不能直接截掉。
export function truncateStudentName(value, maxLength) {
  return nameCharacters(value).slice(0, Math.max(0, maxLength)).join("").trimEnd();
}
