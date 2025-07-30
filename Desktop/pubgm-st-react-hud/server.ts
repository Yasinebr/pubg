import 'dotenv/config';
import cors from 'cors';
import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import { Server, Socket } from 'socket.io';
import http from 'http';
import * as fs from 'node:fs';

// ----------------- TYPE DEFINITIONS -----------------
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
        console.log("Database connected successfully.");
        db.exec('PRAGMA foreign_keys = ON;', (err) => {
            if (err) console.error("Error enabling foreign keys:", err.message);
            else console.log("Foreign keys enabled.");
        });
    }
});

// ----------------- MIDDLEWARE -----------------
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
app.use('/team_data/team_logos', express.static(path.join(__dirname, '..', 'team_data/team_logos')));


// =================================================================
// ## تابع کمکی مرکزی برای ارسال داده‌های مچ ##
// =================================================================
const getUpdatedMatchDataAndEmit = (matchId: string, targetSocket?: import('socket.io').Socket) => {
    const query = `
        SELECT
            t.id, t.name, t.initial, t.logo,
            tp.team_points, tp.team_elms, tp.is_eliminated
        FROM teams t
        LEFT JOIN team_points tp ON t.id = tp.team_id
        WHERE t.match_id = ?
        ORDER BY (tp.team_points + tp.team_elms) DESC, tp.team_points DESC, tp.team_elms DESC;
    `;
    db.all(query, [matchId], (err, rows) => {
        if (err) {
            console.error(`Error fetching data for match ${matchId}:`, err.message);
            return;
        }
        const roomName = `match_${matchId}`;
        const target = targetSocket ? targetSocket : io.to(roomName);
        target.emit('matchDataUpdated', rows);

        // [تغییر کلیدی]: بعد از هر آپدیت مچ، رده‌بندی کلی را هم آپدیت می‌کنیم
        db.get('SELECT game_id FROM matches WHERE id = ?', [matchId], (err, matchRow: { game_id: string }) => {
            if (matchRow) {
                getUpdatedOverallStandingsAndEmit(matchRow.game_id);
            }
        });
    });
};

io.on('connection', (socket) => {
    console.log('✅ A user connected:', socket.id);

    // برای صفحات مربوط به یک مچ خاص (Control, Table, MatchStandings)
    socket.on('joinMatch', (matchId) => {
        if (!matchId) return;
        const roomName = `match_${String(matchId)}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
        getUpdatedMatchDataAndEmit(String(matchId), socket);
    });

    // برای صفحه رده‌بندی کلی یک بازی
    socket.on('joinGame', (gameId) => {
        if (!gameId) return;
        const roomName = `game_${String(gameId)}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
        getUpdatedOverallStandingsAndEmit(String(gameId));
    });

    // [بخش جدید]: برای صفحه انتخاب بازی (GameSelector)
    socket.on('joinGamesList', () => {
        console.log(`Socket ${socket.id} requested the games list.`);
        // تابع کمکی که قبلاً ساختیم را فراخوانی می‌کنیم تا لیست اولیه را فقط برای همین کاربر بفرستد
        getUpdatedGamesAndEmit(socket);
    });

    // برای قطع اتصال
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});


// ----------------- API ROUTES (All routes preserved and optimized) -----------------

// ## Game and Match Management Routes ##
app.get('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.all('SELECT * FROM matches WHERE game_id = ? ORDER BY created_at DESC', [gameId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

const getUpdatedGamesAndEmit = (targetSocket?: import('socket.io').Socket) => {
    db.all('SELECT * FROM games ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error("Error fetching games list:", err.message);
            return;
        }
        // رویداد جدید را به صورت عمومی برای همه یا برای یک کاربر خاص ارسال می‌کنیم
        const target = targetSocket || io;
        target.emit('gamesUpdated', rows);
    });
};

app.post('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;
    const { name } = req.body;
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

app.post('/api/games', (req: Request, res: Response) => {
    const { name } = req.body;
    db.run('INSERT INTO games (name) VALUES (?)', [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        // [اصلاح کلیدی]: تابع کمکی جدید را فراخوانی می‌کنیم
        getUpdatedGamesAndEmit();
        res.status(201).json({ id: this.lastID, name });
    });
});

app.delete('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.run('DELETE FROM games WHERE id = ?', [gameId], function(err: Error | null) {
        if (err) return res.status(500).json({ error: 'Failed to delete game.' });
        // [اصلاح کلیدی]: تابع کمکی جدید را فراخوانی می‌کنیم
        getUpdatedGamesAndEmit();
        res.status(200).json({ message: `Game ${gameId} deleted.` });
    });
});

app.delete('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.run('DELETE FROM games WHERE id = ?', [gameId], function(err: Error | null) {
        if (err) return res.status(500).json({ error: 'Failed to delete game.' });
        io.emit('gamesUpdated');
        res.status(200).json({ message: `Game ${gameId} deleted.` });
    });
});

app.delete('/api/games/:gameId/matches', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.run('DELETE FROM matches WHERE game_id = ?', [gameId], function(err: Error | null) {
        if (err) return res.status(500).json({ error: 'Failed to delete matches.' });
        io.emit('matchesUpdated');
        res.status(200).json({ message: 'Matches for the game deleted.' });
    });
});

const getUpdatedOverallStandingsAndEmit = (gameId: string) => {
    const query = `
        SELECT t.name, t.initial, t.logo,
               SUM(tp.team_points) as total_pts, SUM(tp.team_elms) as total_elms,
               (SUM(tp.team_points) + SUM(tp.team_elms)) as overall_total
        FROM teams t
        JOIN team_points tp ON t.id = tp.team_id
        WHERE t.match_id IN (SELECT id FROM matches WHERE game_id = ?)
        GROUP BY t.name, t.initial, t.logo
        ORDER BY overall_total DESC, total_pts DESC, total_elms DESC;
    `;
    db.all(query, [gameId], (err, rows) => {
        if (err) {
            console.error(`Error fetching overall standings for game ${gameId}:`, err.message);
            return;
        }
        // رویداد جدید را به "روم" مخصوص همان بازی ارسال می‌کنیم
        const roomName = `game_${gameId}`;
        io.to(roomName).emit('overallStandingsUpdated', rows);
    });
};

// ## Control Panel Routes (Optimized) ##
app.post('/api/teams/eliminate', (req: Request, res: Response) => {
    const { match_id, team_id } = req.body.data;
    const query = 'UPDATE team_points SET is_eliminated = 1 WHERE team_id = ? AND match_id = ?';
    db.run(query, [team_id, match_id], function(err: Error | null) {
        if (err) return res.status(500).json({ error: 'Failed to eliminate team.' });
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: `Team ${team_id} eliminated.` });
    });
});

app.post('/api/update_points/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id, team_points } = req.body.data;
    const query = 'UPDATE team_points SET team_points = team_points + ? WHERE team_id = ? AND match_id = ?';
    db.run(query, [team_points, team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: 'Points updated.' });
    });
});

app.post('/api/elms/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { points, team_id } = req.body.data;
    const query = 'UPDATE team_points SET team_elms = team_elms + ? WHERE team_id = ? AND match_id = ?';
    db.run(query, [points, team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: 'Elims updated.' });
    });
});

app.post('/api/reset_points/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    db.run('UPDATE team_points SET team_points = 0 WHERE team_id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: 'Points reset.' });
    });
});

app.post('/api/reset_elims/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    db.run('UPDATE team_points SET team_elms = 0 WHERE team_id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: 'Elims reset.' });
    });
});

// ## Admin Panel Routes (Optimized) ##
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
            const pointsQuery = 'INSERT INTO team_points (match_id, team_id) VALUES (?, ?)';
            db.run(pointsQuery, [match_id, newTeamId], (pointsErr) => {
                if (pointsErr) return res.status(500).send('Failed to initialize team points.');
                getUpdatedMatchDataAndEmit(match_id);
                res.status(200).send({ message: 'Team added successfully!' });
            });
        });
    });
});

app.post('/api/admin/delete-team/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id } = req.body.data;
    db.run('DELETE FROM teams WHERE id = ? AND match_id = ?', [team_id, match_id], function(err) {
        if (err) return res.status(500).send('Failed to delete team.');
        getUpdatedMatchDataAndEmit(match_id);
        res.status(200).send({ message: 'Team deleted successfully!' });
    });
});

app.post('/api/admin/update-name/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id, new_name } = req.body.data;
    db.run('UPDATE teams SET name = ? WHERE id = ? AND match_id = ?', [new_name, team_id, match_id], function(err) {
        if (err) return res.status(500).send('Failed to update team name.');
        getUpdatedMatchDataAndEmit(match_id);
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
        getUpdatedMatchDataAndEmit(match_id);
        res.status(200).send({ message: 'Logo updated successfully' });
    });
});

// ## Copy Teams Route (Optimized & TypeScript errors fixed) ##
app.post('/api/matches/copy-teams', async (req: Request, res: Response) => {
    const { sourceMatchId, destinationMatchId } = req.body;
    if (!sourceMatchId || !destinationMatchId) {
        return res.status(400).json({ error: 'Source and destination match IDs are required.' });
    }
    try {
        const teamsToCopy: any[] = await new Promise((resolve, reject) => {
            db.all('SELECT name, initial, logo FROM teams WHERE match_id = ?', [sourceMatchId], (err: Error | null, rows: any[]) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });
        if (teamsToCopy.length === 0) return res.status(404).json({ error: 'No teams found.' });

        await new Promise<void>((resolve, reject) => db.run('BEGIN TRANSACTION', (err: Error | null) => err ? reject(err) : resolve()));
        const teamStmt = db.prepare('INSERT INTO teams (match_id, name, initial, logo) VALUES (?, ?, ?, ?)');
        const pointsStmt = db.prepare('INSERT INTO team_points (match_id, team_id) VALUES (?, ?)');
        for (const team of teamsToCopy) {
            const newTeamId = await new Promise<number>((resolve, reject) => {
                teamStmt.run(destinationMatchId, team.name, team.initial, team.logo, function(this: sqlite3.RunResult, err: Error | null) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                });
            });
            await new Promise<void>((resolve, reject) => {
                pointsStmt.run(destinationMatchId, newTeamId, (err: Error | null) => err ? reject(err) : resolve());
            });
        }
        teamStmt.finalize();
        pointsStmt.finalize();
        await new Promise<void>((resolve, reject) => db.run('COMMIT', (err: Error | null) => err ? reject(err) : resolve()));

        getUpdatedMatchDataAndEmit(destinationMatchId);
        res.status(200).json({ message: `${teamsToCopy.length} teams copied.` });
    } catch (error: any) {
        db.run('ROLLBACK');
        res.status(500).json({ error: 'Failed to copy teams.' });
    }
});

// ## Other Original Routes ##
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
        SELECT t.name, t.initial, t.logo,
               SUM(tp.team_points) as total_pts, SUM(tp.team_elms) as total_elms,
               (SUM(tp.team_points) + SUM(tp.team_elms)) as overall_total
        FROM teams t
        JOIN team_points tp ON t.id = tp.team_id
        WHERE t.match_id IN (SELECT id FROM matches WHERE game_id = ?)
        GROUP BY t.name, t.initial, t.logo
        ORDER BY overall_total DESC, total_pts DESC;
    `;
    db.all(query, [gameId], (err: Error | null, rows: OverallStandingRow[]) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch overall standings.' });
        res.json(rows);
    });
});

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

// ----------------- START SERVER -----------------
server.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
