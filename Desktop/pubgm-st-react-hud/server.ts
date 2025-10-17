import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express'; // از type import استفاده کنید
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

        // =======================================================
        // [کد جدید]: این بخش اضافه شده است
        // =======================================================
        const createLibraryTableQuery = `
        CREATE TABLE IF NOT EXISTS team_library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            initial TEXT NOT NULL,
            logo_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        `;

        db.run(createLibraryTableQuery, (err) => {
            if (err) {
                return console.error("Error creating team_library table:", err.message);
            }
            console.log("Table 'team_library' is ready.");
        });
        // =======================================================

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

        // [تغییر کلیدی]: این بخش را اضافه یا جایگزین کنید
        // همیشه بعد از هر آپدیت مچ، رده‌بندی کلی را هم آپدیت می‌کنیم
        db.get('SELECT game_id FROM matches WHERE id = ?', [matchId], (err, matchRow: { game_id: string }) => {
            if (err) {
                console.error(`Error fetching game_id for match ${matchId}:`, err.message);
                return;
            }
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

// server.ts
app.delete('/api/matches/:matchId', async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (!Number.isFinite(matchId)) return res.status(400).json({ message: 'Invalid match id' });

  try {
    // اگر FKهای وابسته داری و CASCADE نداری، اینجا جدول‌های مرتبط را هم دستی پاک کن.
    // await db.run('DELETE FROM match_results WHERE match_id = ?', matchId);
    // await db.run('DELETE FROM match_kills   WHERE match_id = ?', matchId);

    await db.run('DELETE FROM matches WHERE id = ?', matchId); // فقط همین مچ
    io.emit('matchesUpdated'); // مثل کدت برای همگام‌سازی کلاینت‌ها
    return res.status(204).send(); // بدون بدنه
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to delete match' });
  }
});


const getUpdatedOverallStandingsAndEmit = (gameId: string) => {
    const query = `
        SELECT
            t.name,
            t.initial,
            t.logo,
            SUM(tp.team_points) as total_pts,
            SUM(tp.team_elms) as total_elms,
            (SUM(tp.team_points) + SUM(tp.team_elms)) as overall_total,
            MAX(tp.is_eliminated) as is_eliminated
        FROM teams t
        JOIN team_points tp ON t.id = tp.team_id
        WHERE t.match_id IN (SELECT id FROM matches WHERE game_id = ?)
        GROUP BY t.name, t.initial, t.logo -- گروه‌بندی فقط بر اساس نام
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

// این مسیر جدید را به server.ts اضافه کنید
app.post('/api/teams/revive', (req: Request, res: Response) => {
    const { match_id, team_id } = req.body.data;
    const query = 'UPDATE team_points SET is_eliminated = 0 WHERE team_id = ? AND match_id = ?';
    db.run(query, [team_id, match_id], function(err: Error | null) {
        if (err) return res.status(500).json({ error: 'Failed to revive team.' });
        // بعد از آپدیت، داده‌های جدید را برای همه ارسال می‌کنیم
        getUpdatedMatchDataAndEmit(match_id);
        res.json({ message: `Team ${team_id} revived.` });
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

app.post('/api/admin/update-initial/:match_id', (req, res) => {
    const { match_id } = req.params;
    const { team_id, new_initial } = req.body.data;

    if (!new_initial) {
        return res.status(400).json({ error: 'New initial is required.' });
    }

    const query = 'UPDATE teams SET initial = ? WHERE id = ? AND match_id = ?';
    db.run(query, [new_initial, team_id, match_id], function(err) {
        if (err) {
            return res.status(500).send('Failed to update team initial.');
        }
        // داده‌های آپدیت‌شده را برای همه ارسال می‌کنیم
        getUpdatedMatchDataAndEmit(match_id);
        res.status(200).send({ message: 'Team initial updated successfully' });
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

app.get('/games/:gameId/overall', (req: Request, res: Response) => {
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

app.get('/api/games/:gameId', (req: Request, res: Response) => {
    const { gameId } = req.params;
    db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch game details.' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Game not found.' });
        }
        res.json(row);
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

app.post('/api/admin/add-team-from-library/:match_id', (req: Request, res: Response) => {
    const { match_id } = req.params;
    const { library_team_id } = req.body;

    if (!library_team_id) {
        return res.status(400).json({ error: 'Library team ID is required.' });
    }

    // ۱. ابتدا اطلاعات تیم را از بانک می‌خوانیم
    const getTeamQuery = 'SELECT name, initial, logo_path FROM team_library WHERE id = ?';
    db.get(getTeamQuery, [library_team_id], (err, teamData: any) => {
        if (err) return res.status(500).json({ error: 'Failed to find team in library.' });
        if (!teamData) return res.status(404).json({ error: 'Team not found in library.' });

        // ۲. تیم را به جدول `teams` برای مچ فعلی اضافه می‌کنیم
        const teamQuery = 'INSERT INTO teams (match_id, name, initial, logo) VALUES (?, ?, ?, ?)';
        db.run(teamQuery, [match_id, teamData.name, teamData.initial, teamData.logo_path], function(err) {
            if (err) return res.status(500).send('Failed to add team to match.');

            const newTeamId = this.lastID;

            // ۳. امتیازات اولیه تیم را در جدول `team_points` ثبت می‌کنیم
            const pointsQuery = 'INSERT INTO team_points (match_id, team_id) VALUES (?, ?)';
            db.run(pointsQuery, [match_id, newTeamId], (pointsErr) => {
                if (pointsErr) return res.status(500).send('Failed to initialize team points.');

                // ۴. داده‌های آپدیت‌شده را برای همه کلاینت‌ها ارسال می‌کنیم
                getUpdatedMatchDataAndEmit(match_id);
                res.status(200).send({ message: 'Team added from library successfully!' });
            });
        });
    });
});

app.post('/api/library/teams/:teamId/update-details', (req: Request, res: Response) => {
    const { teamId } = req.params;
    const { team_name, team_initial } = req.body;

    if (!team_name || !team_initial) {
        return res.status(400).json({ error: 'New name and initial are required.' });
    }

    const query = 'UPDATE team_library SET name = ?, initial = ? WHERE id = ?';
    db.run(query, [team_name, team_initial, teamId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update team details.' });
        res.status(200).json({ message: 'Team details updated successfully.' });
    });
});

// [جدید]: مسیری برای آپدیت کردن لوگوی تیم در بانک
app.post('/api/library/teams/:teamId/update-logo', upload.single('logo_file'), (req: Request, res: Response) => {
    const { teamId } = req.params;
    const logoFile = req.file;

    if (!logoFile) {
        return res.status(400).json({ error: 'Logo file is required.' });
    }

    // [اصلاح ۲]: مسیر ذخیره لوگو را به پوشه مشترک تغییر می‌دهیم
    const logoPath = `team_data/team_logos/${logoFile.filename}`;
    const query = 'UPDATE team_library SET logo_path = ? WHERE id = ?';

    db.run(query, [logoPath, teamId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to update team logo.' });
        res.status(200).json({ message: 'Team logo updated successfully.' });
    });
});

// [جدید]: مسیری برای حذف یک تیم از بانک
app.delete('/api/library/teams/:teamId', (req: Request, res: Response) => {
    const { teamId } = req.params;

    const query = 'DELETE FROM team_library WHERE id = ?';
    db.run(query, [teamId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to delete team from library.' });
        res.status(200).json({ message: 'Team deleted successfully from library.' });
    });
});

app.get('/api/team_elims/:match_id', (req, res) => {
    const { match_id } = req.params;
    db.all('SELECT team_id, team_elms FROM team_points WHERE match_id = ?', [match_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

app.get('/api/library/teams', (req: Request, res: Response) => {
    const searchTerm = req.query.search || '';

    // [تغییر کلیدی]: کوئری را طوری تغییر می‌دهیم که هم نام و هم تگ را جستجو کند
    const query = `
        SELECT * FROM team_library 
        WHERE name LIKE ? OR initial LIKE ? 
        ORDER BY name ASC
    `;
    // هر دو پارامتر را با عبارت جستجو پر می‌کنیم
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch teams from library.' });
        }
        res.json(rows);
    });
});

app.post('/api/library/teams', upload.single('logo_file'), (req: Request, res: Response) => {
    const { team_name, team_initial } = req.body;
    const logoFile = req.file;

    if (!team_name || !team_initial || !logoFile) {
        return res.status(400).json({ error: 'Team name, initial, and logo are required.' });
    }

    // [تغییر کلیدی]: استفاده از مسیر صحیح و مشترک
    const logoPath = `team_data/team_logos/${logoFile.filename}`;
    const query = 'INSERT INTO team_library (name, initial, logo_path) VALUES (?, ?, ?)';

    db.run(query, [team_name, team_initial, logoPath], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'A team with this name already exists in the library.' });
            }
            return res.status(500).json({ error: 'Failed to add team to library.' });
        }
        res.status(201).json({
            id: this.lastID,
            name: team_name,
            initial: team_initial,
            logo_path: logoPath
        });
    });
});

// ----------------- START SERVER -----------------
server.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
