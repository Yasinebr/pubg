import 'dotenv/config';
import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import { Server } from 'socket.io';
import http from 'http';
import * as fs from 'node:fs';

// ----------------- TYPE DEFINITIONS (اختیاری اما پیشنهادی) -----------------
interface TeamQueryResult {
    name: string;
    logo: string;
}

interface OverallStandingRow {
    name: string;
    initial: string;
    logo: string;
    total_pts: number;
    total_elms: number;
    overall_total: number;
}

// ----------------- SETUP -----------------
const app = express();
const port = 3001;
const server = http.createServer(app);
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

const dbPath = path.join(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Database connected successfully from path:", dbPath);

        // [اصلاح کلیدی]: فعال کردن کلید خارجی برای این اتصال
        db.exec('PRAGMA foreign_keys = ON;', (err) => {
            if (err) {
                console.error("Error enabling foreign keys:", err.message);
            } else {
                console.log("Foreign keys enabled for this connection.");
            }
        });
    }
});

// ----------------- MIDDLEWARE -----------------
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use('/team_data/team_logos', express.static(path.join(__dirname, '..', 'team_data/team_logos')));

// ----------------- SOCKET.IO CONNECTION LOGIC -----------------
io.on('connection', (socket) => {
    console.log('✅ A user connected:', socket.id);
    // [اصلاح کلیدی]: کلاینت باید بعد از اتصال به این روم جوین شود
    socket.on('joinMatch', (matchId) => {
        const roomName = `match_${matchId}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
    });
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});

// ----------------- API ROUTES -----------------

// GET /api/games/:gameId/matches - گرفتن مچ‌های یک بازی
app.get('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.all('SELECT * FROM matches WHERE game_id = ? ORDER BY created_at DESC', [gameId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/games/:gameId/matches - ساخت مچ جدید برای یک بازی
app.post('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Match name is required' });
    }
    db.run('INSERT INTO matches (game_id, name) VALUES (?, ?)', [gameId, name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.emit('matchesUpdated');
        res.status(201).json({ id: this.lastID, name });
    });
});

app.get('/api/games', (req: Request, res: Response) => {
    db.all('SELECT * FROM games ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/games - ساخت یک بازی جدید
app.post('/api/games', (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Game name is required' });
    }
    db.run('INSERT INTO games (name) VALUES (?)', [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // به همه کلاینت‌ها خبر می‌دهیم که لیست بازی‌ها آپدیت شده
        io.emit('gamesUpdated');
        res.status(201).json({ id: this.lastID, name });
    });
});

// ## Team & Point Data (Match-Aware) ##
app.get('/api/teams/:match_id', (req, res) => {
    const { match_id } = req.params;
    db.all('SELECT * FROM teams WHERE match_id = ?', [match_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/points/:match_id', (req, res) => {
    const { match_id } = req.params;
    db.all('SELECT * FROM team_points WHERE match_id = ?', [match_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});


app.get('/api/overall-standings/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;

    const query = `
        SELECT
            t.name, t.initial, t.logo,
            SUM(tp.team_points) as total_pts,
            SUM(tp.team_elms) as total_elms,
            (SUM(tp.team_points) + SUM(tp.team_elms)) as overall_total
        FROM teams t
        JOIN team_points tp ON t.id = tp.team_id
        -- [اصلاح کلیدی]: این خط نتایج را بر اساس بازی فعال فیلتر می‌کند
        WHERE t.match_id IN (SELECT id FROM matches WHERE game_id = ?)
        GROUP BY t.name, t.initial, t.logo
        ORDER BY overall_total DESC, total_pts DESC;
    `;

    db.all(query, [gameId], (err: Error | null, rows: OverallStandingRow[]) => {
        if (err) {
            console.error("Error fetching overall standings:", err.message);
            return res.status(500).json({ error: 'Failed to fetch overall standings.' });
        }
        res.json(rows);
    });
});


// API جدید برای حذف تمام مچ‌های یک بازی خاص
app.delete('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;

    // کوئری جدید که فقط مچ‌های با game_id مشخص را حذف می‌کند
    db.run('DELETE FROM matches WHERE game_id = ?', [gameId], function(err: Error | null) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete matches for this game.' });
        }
        console.log(`All matches for game ${gameId} deleted, ${this.changes} rows affected.`);
        io.emit('matchesUpdated'); // به فرانت‌اند خبر می‌دهیم که لیست مچ‌ها تغییر کرده
        res.status(200).json({ message: 'Matches for the game deleted successfully!' });
    });
});

// server.ts

// API جدید برای گرفتن اطلاعات یک بازی خاص
app.get('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Game not found.' });
        }
        res.json(row);
    });
});

app.delete('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;

    db.run('DELETE FROM games WHERE id = ?', [gameId], function(err: Error | null) {
        if (err) {
            return res.status(500).json({ error: 'Failed to delete game.' });
        }
        // اگر هیچ ردیفی حذف نشده بود (یعنی بازی پیدا نشد)
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Game not found.' });
        }
        // به همه خبر می‌دهیم که لیست بازی‌ها آپدیت شده
        io.emit('gamesUpdated');
        res.status(200).json({ message: `Game ${gameId} and all its data deleted successfully.` });
    });
});

app.post('/api/teams/eliminate', (req: Request, res: Response) => {
    // ما آیدی مچ و آیدی تیم را از فرانت‌اند دریافت می‌کنیم
    const { match_id, team_id } = req.body.data;

    // مطمئن می‌شویم که داده‌های لازم ارسال شده‌اند
    if (!match_id || !team_id) {
        return res.status(400).json({ error: 'Match ID and Team ID are required.' });
    }

    const query = 'UPDATE team_points SET is_eliminated = 1 WHERE team_id = ? AND match_id = ?';

    db.run(query, [team_id, match_id], function(err: Error | null) {
        if (err) {
            console.error("Error eliminating team:", err.message);
            return res.status(500).json({ error: 'Failed to eliminate team.' });
        }

        // به تمام کلاینت‌های این مچ خبر می‌دهیم که داده‌ها آپدیت شده
        io.to(`match_${match_id}`).emit('dataUpdated', { match_id });
        res.json({ message: `Team ${team_id} in match ${match_id} has been eliminated.` });
    });
});

// ## Point & Eliminations Update Routes (Refactored) ##
app.post('/api/update_points/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id, team_points } = req.body.data;
    const query = 'UPDATE team_points SET team_points = team_points + ? WHERE team_id = ? AND match_id = ?';
    db.run(query, [team_points, team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.to(`match_${match_id}`).emit('dataUpdated', { match_id });
        res.json({ message: 'Points updated successfully' });
    });
});

app.post('/api/elms/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { points, team_id } = req.body.data;
    const query = 'UPDATE team_points SET team_elms = team_elms + ? WHERE team_id = ? AND match_id = ?';
    db.run(query, [points, team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.to(`match_${match_id}`).emit('dataUpdated', { match_id });
        res.json({ message: 'Elims updated successfully' });
    });
});

app.post('/api/reset_points/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    db.run('UPDATE team_points SET team_points = 0 WHERE team_id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.to(`match_${match_id}`).emit('dataUpdated', { match_id });
        res.json({ message: 'Points reset successfully' });
    });
});

app.post('/api/reset_elims/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    db.run('UPDATE team_points SET team_elms = 0 WHERE team_id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        io.to(`match_${match_id}`).emit('dataUpdated', { match_id });
        res.json({ message: 'Elims reset successfully' });
    });
});

// ## Other Original Routes (Refactored) ##
app.post('/api/team_eliminated/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    const query = 'SELECT name, logo FROM teams WHERE id = ? AND match_id = ?';
    db.get(query, [team_id, match_id], async (err, row: TeamQueryResult) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Team not found' });
        try {
            const logoPath = path.join(__dirname, row.logo);
            const imageData = await fs.promises.readFile(logoPath);
            const logoBase64 = imageData.toString('base64');
            res.json({ team_name: row.name, team_logo_data: logoBase64 });
        } catch (fileError) {
            res.status(500).json({ error: 'Error reading logo file' });
        }
    });
});

app.post('/api/team_eliminated_sc/:match_id', (req, res) => {
    const { match_id } = req.params;
    io.to(`match_${match_id}`).emit('team-eliminate', req.body.data);
    res.json({ success: 'Successfully sent data!' });
});

app.post('/api/players_update/:match_id', (req, res) => {
    const { match_id } = req.params;
    io.to(`match_${match_id}`).emit('players_update', req.body.data);
    res.json({ success: 'Successfully sent player data!' });
});

app.get('/api/team_elims/:match_id', (req, res) => {
    const { match_id } = req.params;
    db.all('SELECT team_id, team_elms FROM team_points WHERE match_id = ?', [match_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.post('/api/matches/copy-teams', async (req: Request, res: Response) => {
    const { sourceMatchId, destinationMatchId } = req.body;

    if (!sourceMatchId || !destinationMatchId) {
        return res.status(400).json({ error: 'Source and destination match IDs are required.' });
    }

    try {
        // 1. Get all teams from the source match.
        const teamsToCopy: any[] = await new Promise((resolve, reject) => {
            db.all('SELECT name, initial, logo FROM teams WHERE match_id = ?', [sourceMatchId], (err: Error | null, rows: any[]) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        if (teamsToCopy.length === 0) {
            return res.status(404).json({ error: 'No teams found in the source match.' });
        }

        // 2. Start a database transaction to ensure all or nothing is committed.
        await new Promise<void>((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err: Error | null) => err ? reject(err) : resolve());
        });

        const teamStmt = db.prepare('INSERT INTO teams (match_id, name, initial, logo) VALUES (?, ?, ?, ?)');
        const pointsStmt = db.prepare('INSERT INTO team_points (match_id, team_id, team_points, team_elms, is_eliminated) VALUES (?, ?, 0, 0, 0)');

        // Use a for...of loop which works correctly with await.
        for (const team of teamsToCopy) {
            // Insert the team and get its new ID.
            const newTeamId = await new Promise<number>((resolve, reject) => {
                // Explicitly type `this` and `err` to satisfy TypeScript.
                teamStmt.run(destinationMatchId, team.name, team.initial, team.logo, function(this: sqlite3.RunResult, err: Error | null) {
                    if (err) return reject(err);
                    // `this` now correctly refers to the RunResult, which has lastID.
                    resolve(this.lastID);
                });
            });

            // Insert the initial points for the new team.
            await new Promise<void>((resolve, reject) => {
                // Here we don't need `this`, so an arrow function is fine. Just type `err`.
                pointsStmt.run(destinationMatchId, newTeamId, (err: Error | null) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }

        // Finalize the prepared statements.
        teamStmt.finalize();
        pointsStmt.finalize();

        // 3. If all insertions were successful, commit the transaction.
        await new Promise<void>((resolve, reject) => {
            db.run('COMMIT', (err: Error | null) => err ? reject(err) : resolve());
        });

        // 4. Send success response and notify clients.
        io.emit('teamDataUpdated', { match_id: destinationMatchId });
        res.status(200).json({ message: `${teamsToCopy.length} teams copied successfully.` });

    } catch (error: any) {
        // If any error occurs, roll back the entire transaction.
        db.run('ROLLBACK', (rollbackErr: Error | null) => {
            if (rollbackErr) {
                console.error("Fatal: Error rolling back transaction:", rollbackErr.message);
            }
        });
        console.error("Error copying teams (Transaction Rolled Back):", error.message);
        res.status(500).json({ error: 'Failed to copy teams. The operation was cancelled.' });
    }
});



// ## Admin Routes (Refactored to use Database ONLY) ##
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'team_data/team_logos/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

app.post('/api/admin/add-team/:match_id', upload.single('logo_file'), (req, res) => {
    const { match_id } = req.params;
    const { team_name, team_initial } = req.body;
    const logoFile = req.file;
    if (!team_name || !logoFile) return res.status(400).send('Team name and logo are required.');

    const logoPath = `team_data/team_logos/${logoFile.filename}`;
    db.serialize(() => {
        const teamQuery = 'INSERT INTO teams (match_id, name, initial, logo) VALUES (?, ?, ?, ?)';
        db.run(teamQuery, [match_id, team_name, team_initial, logoPath], function(err) {
            if (err) return res.status(500).send('Failed to add team.');
            const newTeamId = this.lastID;
            const pointsQuery = 'INSERT INTO team_points (match_id, team_id, team_points, team_elms) VALUES (?, ?, 0, 0)';
            db.run(pointsQuery, [match_id, newTeamId], (pointsErr) => {
                if (pointsErr) return res.status(500).send('Failed to initialize team points.');
                io.to(`match_${match_id}`).emit('teamDataUpdated', { match_id });
                res.status(200).send({ message: 'Team added successfully!' });
            });
        });
    });
});

app.post('/api/admin/delete-team/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    if (!team_id) return res.status(400).send('Team ID is required.');

    db.run('DELETE FROM teams WHERE id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).send('Failed to delete team.');
        if (this.changes === 0) return res.status(404).send('Team not found in this match.');
        // ON DELETE CASCADE در دیتابیس باید ردیف‌های team_points را هم حذف کند
        io.to(`match_${match_id}`).emit('teamDataUpdated', { match_id });
        res.status(200).send({ message: 'Team deleted successfully!' });
    });
});

app.post('/api/admin/update-name/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id, new_name } = req.body.data;
    db.run('UPDATE teams SET name = ? WHERE id = ? AND match_id = ?', [new_name, team_id, match_id], function(err) {
        if (err) return res.status(500).send('Failed to update team name.');
        if (this.changes === 0) return res.status(404).send('Team not found in this match.');
        io.to(`match_${match_id}`).emit('teamDataUpdated', { match_id });
        res.status(200).send({ message: 'Team name updated successfully' });
    });
});

app.post('/api/admin/update-logo/:match_id', upload.single('logo_file'), (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body;
    const logoFile = req.file;
    if (!logoFile) return res.status(400).send('Logo file is required.');

    const new_logo_path = `team_data/team_logos/${logoFile.filename}`;
    db.run('UPDATE teams SET logo = ? WHERE id = ? AND match_id = ?', [new_logo_path, team_id, match_id], function(err) {
        if (err) return res.status(500).send('Failed to update team logo.');
        if (this.changes === 0) return res.status(404).send('Team not found in this match.');
        io.to(`match_${match_id}`).emit('teamDataUpdated', { match_id });
        res.status(200).send({ message: 'Logo updated successfully' });
    });
});

io.on('connection', (socket) => {
    console.log('✅ A user connected via Socket.IO. Socket ID:', socket.id);
    socket.on('disconnect', () => {
        console.log('❌ User disconnected. Socket ID:', socket.id);
    });
});

// ----------------- START SERVER -----------------
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});