import { getDb } from "./database.js";

export interface TaskRecord {
  id: number;
  prompt: string;
  status: string;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export function createTask(prompt: string): number {
  const db = getDb();
  const stmt = db.prepare(`INSERT INTO tasks (prompt, status) VALUES (?, 'running')`);
  const info = stmt.run(prompt);
  return Number(info.lastInsertRowid);
}

export function completeTask(taskId: number, summary: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE tasks SET status = 'completed', summary = ?, completed_at = datetime('now') WHERE id = ?`
  ).run(summary, taskId);
}

export function failTask(taskId: number, summary: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE tasks SET status = 'failed', summary = ?, completed_at = datetime('now') WHERE id = ?`
  ).run(summary, taskId);
}

export function recordStep(
  taskId: number,
  stepIndex: number,
  tool: string,
  inputSummary: string,
  resultSummary: string,
  approved: boolean
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO task_steps (task_id, step_index, tool, input_summary, result_summary, approved)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(taskId, stepIndex, tool, inputSummary, resultSummary, approved ? 1 : 0);
}

export function getRecentTasks(limit = 10): TaskRecord[] {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as TaskRecord[];
}

export function setNote(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO notes (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value);
}

export function getNote(key: string): string | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM notes WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export interface NoteRecord {
  key: string;
  value: string;
  updated_at: string;
}

export function getAllNotes(): NoteRecord[] {
  const db = getDb();
  return db
    .prepare(`SELECT key, value, updated_at FROM notes ORDER BY updated_at DESC`)
    .all() as NoteRecord[];
}
