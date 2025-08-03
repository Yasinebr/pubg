// db_setup.ts (نسخه ادغام‌شده و نهایی)

import sqlite3 from 'sqlite3';
import path from 'path';

// [اصلاح]: مسیر صحیح دیتابیس مطابق با فایل server.ts شما
const dbPath = path.join(__dirname, 'database', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error("Error connecting to database:", err.message);
    }
    console.log("Connected to the SQLite database successfully.");
});

db.serialize(() => {
    db.exec("PRAGMA foreign_keys = ON;");

    const createTablesQuery = `
    -- جداول قبلی شما بدون تغییر باقی می‌مانند
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        initial TEXT,
        logo TEXT,
        FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        team_points INTEGER DEFAULT 0,
        team_elms INTEGER DEFAULT 0,
        is_eliminated INTEGER DEFAULT 0,
        FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
        FOREIGN KEY (match_id) REFERENCES matches (id) ON DELETE CASCADE
    );

    -- [جدید]: ساخت جدول برای بانک تیم‌ها (Team Library)
    CREATE TABLE IF NOT EXISTS team_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        initial TEXT NOT NULL,
        logo_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `;

    db.exec(createTablesQuery, (err) => {
        if (err) {
            console.error("Error creating tables:", err.message);
        } else {
            console.log("All tables created successfully or already exist.");
        }
        db.close((closeErr) => {
            if (closeErr) {
                console.error("Error closing database:", closeErr.message);
            } else {
                console.log("Database connection closed.");
            }
        });
    });
});