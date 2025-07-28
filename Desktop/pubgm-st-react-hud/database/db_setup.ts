// database/db_setup.ts

import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error creating database file:", err.message);
    } else {
        console.log("Database file created successfully at:", dbPath);
    }
});

db.serialize(() => {
    db.exec("PRAGMA foreign_keys = ON;");

    const createTablesQuery = `
    -- [جدید]: ساخت جدول برای بازی‌ها (تورنومنت‌ها)
    CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL, -- [اصلاح]: این ستون برای اتصال به بازی اضافه شد
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        -- [اصلاح]: با حذف یک بازی، تمام مچ‌های آن هم حذف می‌شوند
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
    `;

    db.exec(createTablesQuery, (err) => {
        if (err) {
            console.error("Error creating tables:", err.message);
        } else {
            console.log("Tables created successfully.");
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