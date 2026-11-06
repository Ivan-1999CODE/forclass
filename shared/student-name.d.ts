export const STUDENT_NAME_MAX_LENGTH: 10;
export function normalizeStudentName(value: unknown): string;
export function getStudentNameLength(value: unknown): number;
export function validateStudentName(value: unknown): string;
export function truncateStudentName(value: unknown, maxLength: number): string;
