import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sqlite3 from 'sqlite3';

// [اصلاح کلیدی ۱]: ایمپورت استاتیک config.json حذف شد
// import teamData from './team_data/config.json';

import { teamPoints, teamPointsRow } from './interfaces';
import { Server } from 'socket.io';
import http from 'http';

const app = express();
const port = 3001;
const server = http.createServer(app);

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

// [اصلاح کلیدی ۲]: پراپرتی path حذف شد تا از مسیر پیش‌فرض socket.io استفاده شود
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});

const db = new sqlite3.Database('./database/database.db');

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const configPath = path.join(__dirname, 'team_data', 'config.json');

function readFileAsync(filePath: string): Promise<Buffer> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
    return fs.promises.readFile(absolutePath);
}

// [اصلاح کلیدی ۳]: این روت بازنویسی شد تا همیشه فایل تازه را از دیسک بخواند
app.get('/api/team_data', async (req, res) => {
    try {
        const fileContent = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(fileContent);

        const imagePromises = config.team_data.map(async (team: any, index: number) => {
            const logoPath = path.join(__dirname, team.logo);
            const imageData = await fs.promises.readFile(logoPath);
            return {
                id: index + 1,
                name: team.name,
                initial: team.initial,
                logo_data: imageData.toString('base64'),
                team_color: config.table_data.background_color,
                header_color: config.table_data.header_color
            };
        });
        const fullTeamData = await Promise.all(imagePromises);
        res.json(fullTeamData);
    } catch (error) {
        console.error("Error in /api/team_data:", error);
        res.status(500).json({ error: 'Error reading config or image data' });
    }
});


// تمام روت‌های دیگر شما بدون تغییر باقی مانده‌اند
app.post('/api/update_points', (req, res) => {
    const { data } = req.body;
    let points: teamPoints[] = [];
    try {
        db.serialize(function() {
            db.all('SELECT * FROM team_points', (err, rows: teamPointsRow[]) => {
                if (err) {
                    return res.status(500).json({ error: 'An error occurred while fetching points' });
                }
                points = rows;

                if (points[data.team_id-1].team_points === 0 && data.team_points > 0) {
                    const statement = db.prepare('UPDATE team_points SET team_points = ? WHERE team_id = ?');
                    statement.run(data.team_points + points[data.team_id-1].team_points, data.team_id);
                    statement.finalize();
                } else if (points[data.team_id-1].team_points === 0 && data.team_points < 0) {
                    return;
                } else {
                    const statement = db.prepare('UPDATE team_points SET team_points = ? WHERE team_id = ?');
                    statement.run(data.team_points + points[data.team_id-1].team_points, data.team_id);
                    statement.finalize();
                }

                io.emit('points-update', data);
                res.json({ success: 'Successfully sent data!' });
            });
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.post('/api/reset_points', (req, res) => {
    const { data } = req.body;
    try {
        db.serialize(function() {
            const statement = db.prepare('UPDATE team_points SET team_points = ? WHERE team_id = ?');
            statement.run(0, data.team_id);
            statement.finalize();
        });
        io.emit('points-update', data);
        res.json({ success: 'Successfully sent data!' });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.post('/api/reset_elims', (req, res) => {
    const { data } = req.body;
    try {
        io.emit('points-update', data);
        res.json({ success: 'Successfully sent data!' });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.get('/api/team_points', (req, res) => {
    db.all('SELECT * FROM team_points', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'An error occurred while fetching points' });
        }
        res.json({ data: rows });
    });
});

// [اصلاح کلیدی ۴]: این روت هم بازنویسی شد تا فایل تازه را بخواند
app.post('/api/team_eliminated', async (req, res) => {
    const data = req.body;
    try {
        const fileContent = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(fileContent);

        const imagePromises = config.team_data.map(async (team: any) => {
            if (team.name === data.data.team_name) {
                const imageData = await readFileAsync(team.logo);
                return {
                    team_name: team.name,
                    team_logo_data: imageData.toString('base64')
                }
            }
        });
        const imageData = await Promise.all(imagePromises);
        res.json(imageData.filter(item => item));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error reading image data' });
    }
});

app.post('/api/team_eliminated_sc', (req, res) => {
    const { data } = req.body;
    try {
        io.emit('team-eliminate', data);
        res.json({ success: 'Successfully sent data!' });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

app.post('/api/players_update', (req, res) => {
    const { data } = req.body;
    try {
        io.emit('players_update', data)
        res.json({ success: 'Successfully sent player data!' });
    } catch {
        console.error('Error sending player data!');
        res.status(500).json({ error: 'Error sending player data!' });
    }
});

app.get('/api/team_elims', (req, res) => {
    db.all('SELECT team_id, team_elms FROM team_points', [], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'An error occurred while fetching elims' });
        }
        res.json({ data: rows });
    });
});

app.post("/api/elms", (req,res) => {
    const { data } = req.body as {data: {points: number, team_id: number}};
    let points: teamPoints[] = [];
    try {
        db.serialize(function() {
            db.all('SELECT * FROM team_points', (err, rows: teamPointsRow[]) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                points = rows;

                // پیدا کردن تیم براساس team_id
                const teamIndex = points.findIndex(p => p.team_id === data.team_id);

                if (teamIndex === -1) {
                    return res.status(404).json({ error: 'Team not found' });
                }

                const statement = db.prepare('UPDATE team_points SET team_elms = ? WHERE team_id = ?');
                const pre = points[teamIndex].team_elms || 0; // ✅ درست شد
                const n = pre + data.points;
                statement.run(n, data.team_id); // ✅ درست شد - +1 حذف شد
                statement.finalize();

                let c = [...points];
                c[teamIndex] = { ...c[teamIndex], team_elms: n }; // ✅ درست شد
                const o = Object.fromEntries(c.map(o => ([o.team_id - 1, o])));
                io.emit("dajjal", o)
            });
        });
        res.json({ success: 'Successfully sent data!' });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'team_data/team_logos/'));
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

app.post('/api/admin/update-name', async (req, res) => {
  const { team_id, new_name } = req.body.data;
  try {
    const fileContent = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(fileContent);
    const teamIndex = team_id - 1;

    if (teamIndex < 0 || teamIndex >= config.team_data.length) {
      return res.status(404).send('Team not found in config.');
    }
    config.team_data[teamIndex].name = new_name;

    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

    io.sockets.emit('teamDataUpdated');
    console.log(`Sent "teamDataUpdated" event after name update for team ID: ${team_id}`);
    res.status(200).send({ message: 'Team name updated successfully' });
  } catch (error) {
    console.error("Error in update-name:", error);
    res.status(500).send('Failed to update team name.');
  }
});

app.post('/api/admin/update-logo', upload.single('logo_file'), async (req, res) => {
    const team_id = parseInt(req.body.team_id, 10);
    const new_logo_filename = req.file?.filename;

    if (!team_id || !new_logo_filename) {
        return res.status(400).send('Team ID and logo file are required.');
    }

    try {
        const fileContent = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(fileContent);
        const teamIndex = team_id - 1;

        if (teamIndex < 0 || teamIndex >= config.team_data.length) {
          return res.status(404).send('Team not found in config.');
        }

        config.team_data[teamIndex].logo = `team_data/team_logos/${new_logo_filename}`;

        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

        io.sockets.emit('teamDataUpdated');
        console.log(`Sent "teamDataUpdated" event after logo update for team ID: ${team_id}`);
        res.status(200).send({ message: 'Logo updated successfully' });
    } catch (error) {
        console.error("Error in update-logo:", error);
        res.status(500).send('Failed to update team logo.');
    }
});


app.post('/api/admin/add-team', upload.single('logo_file'), async (req, res) => {
    const { team_name, team_initial } = req.body;
    const logoFile = req.file;

    if (!team_name || !team_initial || !logoFile) {
        return res.status(400).send('Team name, initial, and logo are required.');
    }

    try {
        // مرحله ۱: پیدا کردن بزرگترین ID موجود در دیتابیس
        db.get('SELECT MAX(team_id) as maxId FROM team_points', async (err, row: { maxId: number | null }) => {
            if (err) {
                console.error("Error finding max team_id:", err);
                return res.status(500).send('Failed to determine new team ID.');
            }

            // ID جدید یکی بیشتر از بزرگترین ID قبلی خواهد بود
            const newTeamId = (row && row.maxId) ? row.maxId + 1 : 1;

            const fileContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(fileContent);

            const newTeam = {
                id: newTeamId, // <<<< از ID جدید استفاده می‌کنیم
                name: team_name,
                initial: team_initial,
                logo: `team_data/team_logos/${logoFile.filename}`
            };

            config.team_data.push(newTeam);

            await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

            // مرحله ۲: اضافه کردن ردیف جدید به دیتابیس با ID صحیح
            db.run('INSERT INTO team_points (team_id, team_points, team_elms) VALUES (?, ?, ?)',
                [newTeamId, 0, 0],
                (insertErr) => {
                    if (insertErr) {
                        console.error("Error inserting new team into database:", insertErr);
                        return res.status(500).send('Failed to add team to database.');
                    }

                    io.sockets.emit('teamDataUpdated');
                    console.log(`Team "${team_name}" added with ID ${newTeamId}.`);
                    res.status(200).send({ message: 'Team added successfully!' });
                });
        });
    } catch (error) {
        console.error("Error in add-team:", error);
        res.status(500).send('Failed to add team.');
    }
});


app.post('/api/admin/delete-team', async (req, res) => {
    const { team_id } = req.body.data;

    if (!team_id) {
        return res.status(400).send('Team ID is required.');
    }

    try {
        const fileContent = await fs.promises.readFile(configPath, 'utf8');
        const config = JSON.parse(fileContent);

        const teamIndex = team_id - 1;

        if (teamIndex < 0 || teamIndex >= config.team_data.length) {
            return res.status(404).send('Team not found.');
        }

        // حذف تیم از آرایه در فایل کانفیگ
        config.team_data.splice(teamIndex, 1);

        // ذخیره کردن فایل کانفیگ جدید
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

        // استفاده از serialize برای اجرای دستورات به ترتیب
        db.serialize(() => {
            // مرحله ۱: ردیف تیم مورد نظر را از دیتابیس حذف کن
            db.run('DELETE FROM team_points WHERE team_id = ?', [team_id], function(err) {
                if (err) {
                    console.error(`Error deleting team ID ${team_id} from database:`, err);
                    // در یک سناریوی واقعی، باید تغییر در config.json را هم برگردانیم (rollback)
                    return res.status(500).send('Failed to delete team from database.');
                }

                // مرحله ۲ (بخش کلیدی و جدید): آی‌دی تمام تیم‌های بعدی را یک واحد کم کن
                const updateQuery = 'UPDATE team_points SET team_id = team_id - 1 WHERE team_id > ?';
                db.run(updateQuery, [team_id], function(updateErr) {
                    if (updateErr) {
                        console.error(`Error updating subsequent team IDs:`, updateErr);
                        return res.status(500).send('Failed to update subsequent team IDs.');
                    }

                    // حالا که همه چیز هماهنگ شد، به همه اطلاع‌رسانی کن
                    io.sockets.emit('teamDataUpdated');
                    console.log(`Team with ID ${team_id} has been deleted and subsequent IDs have been updated.`);
                    res.status(200).send({ message: 'Team deleted successfully!' });
                });
            });
        });

    } catch (error) {
        console.error("Error in delete-team:", error);
        res.status(500).send('Failed to delete team.');
    }
});


io.on('connection', (socket) => {
    console.log('✅ A user connected via Socket.IO. Socket ID:', socket.id);
    socket.on('disconnect', () => {
        console.log('❌ User disconnected. Socket ID:', socket.id);
    });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

