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

// ## Match Management ##
app.get('/api/matches', (req, res) => {
    db.all('SELECT * FROM matches ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/matches', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Match name is required' });
    db.run('INSERT INTO matches (name) VALUES (?)', [name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
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


app.get('/api/overall-standings', (req: Request, res: Response) => {
    const query = `
        SELECT
            t.name,
            t.initial, -- [اصلاح]: این خط برای گرفتن نام مخفف اضافه شد
            t.logo,
            SUM(tp.team_points) as total_pts,
            SUM(tp.team_elms) as total_elms,
            (SUM(tp.team_points) + SUM(tp.team_elms)) as overall_total
        FROM
            teams t
        JOIN
            team_points tp ON t.id = tp.team_id
        GROUP BY
            t.name, t.initial, t.logo -- [اصلاح]: نام مخفف و لوگو به گروه بندی اضافه شدند
        ORDER BY
            overall_total DESC, total_pts DESC;
    `;

    db.all(query, [], (err: Error | null, rows: OverallStandingRow[]) => {
        if (err) {
            console.error("Error fetching overall standings:", err.message);
            return res.status(500).json({ error: 'Failed to fetch overall standings.' });
        }
        res.json(rows);
    });
});

app.post('/api/matches/delete-all', (req, res) => {
    // از آنجایی که در دیتابیس ON DELETE CASCADE را تنظیم کرده‌ایم،
    // با حذف از جدول matches، تمام تیم‌ها و امتیازات مرتبط هم حذف می‌شوند.
    db.run('DELETE FROM matches', function(err) {
        if (err) {
            console.error("Error deleting all matches:", err.message);
            return res.status(500).json({ error: 'Failed to delete all matches.' });
        }
        console.log(`All matches deleted, ${this.changes} rows affected.`);
        // به تمام کلاینت‌های متصل خبر می‌دهیم که لیست مچ‌ها تغییر کرده
        io.emit('matchesUpdated');
        res.status(200).json({ message: 'All matches deleted successfully!' });
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