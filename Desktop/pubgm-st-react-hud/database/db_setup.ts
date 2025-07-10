import sqlite3 from 'sqlite3';
import teamData from '../team_data/config.json';

// آدرس صحیح پایگاه داده
const db = new sqlite3.Database('./database/database.db', (err) => {
    if (err) {
        return console.error('Error opening database', err.message);
    }
    console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS team_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER UNIQUE,
        team_points INTEGER DEFAULT 0,
        team_elms INTEGER DEFAULT 0
    )`;

    db.run(createTableQuery, (err) => {
        if (err) {
            return console.error('Error creating table', err.message);
        }
        console.log('Table "team_points" created or already exists.');

        const insertStmt = db.prepare('INSERT OR IGNORE INTO team_points (team_id, team_points, team_elms) VALUES (?, ?, ?)');

        for (let i = 0; i < teamData.team_data.length; i++) {
            insertStmt.run(i + 1, 0, 0);
        }

        // فقط بعد از اینکه آخرین دستور تمام شد، دیتابیس را می‌بندیم
        insertStmt.finalize((err) => {
            if (err) {
                return console.error('Error inserting data', err.message);
            }
            console.log('Data insertion complete.');

            // <<<<< دستور بستن به اینجا منتقل شد
            db.close((err) => {
                if (err) {
                    return console.error('Error closing database', err.message);
                }
                console.log('Closed the database connection.');
            });
        });
    });
});