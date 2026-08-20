import fs from "node:fs";
import Database from "better-sqlite3";
import { PILOT_DB_PATH, PILOT_HOME } from "../core/constants.js";
import { runMigrations } from "./migrations.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  if (!fs.existsSync(PILOT_HOME)) {
    fs.mkdirSync(PILOT_HOME, { recursive: true, mode: 0o700 });
  }
  db = new Database(PILOT_DB_PATH);
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
