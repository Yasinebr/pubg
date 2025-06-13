import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';

import sqlite3 from 'sqlite3';

import teamData from './team_data/config.json';
import { teamPoints, teamPointsRow } from './interfaces';

import { Server } from 'socket.io';
import http from 'http';

const app = express();
const port = 3001;
const server = http.createServer(app);

// متغیر اصلی که آدرس مجاز را نگه می‌دارد
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

// استفاده در تنظیمات CORS برای Socket.IO (این بخش درست بود)
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  },
  path: '/'
});

const db = new sqlite3.Database('./database/database.db');

// استفاده در تنظیمات CORS برای Express API (این همان خطی است که باید تغییر دهید)
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());


app.use('/team_logos', express.static(path.join(__dirname, 'team_data/team_logos')));


app.get('/api/team_data', (req, res) => {
    const imagePromises = teamData.team_data.map(async (team, index) => {
        const imageData = await readFileAsync(team.logo);

        return {
            id: index + 1,
            name: team.name,
            initial: team.initial,
            logo_data: imageData.toString('base64'),
            team_color: teamData.table_data.background_color,
            header_color: teamData.table_data.header_color
        };
    });

    Promise.all(imagePromises)
        .then((imageData) => {
            res.json(imageData);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Error reading image data' });
    });
});


app.post('/api/update_points', (req, res) => {
    const { data } = req.body;
    const points: teamPoints[] = [];

    try {
        db.serialize(function() {
            db.each('SELECT * FROM team_points', (err, row: teamPointsRow) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).json({ error: 'An error occurred while fetching images' });
                } else {
                    points.push(row);
                }
            }, function() {
                if (points[data.team_id-1].team_points === 0 && data.team_points > 0) {
                    const statement = db.prepare('UPDATE team_points SET team_points = ? WHERE team_id = ?');
                    statement.run(data.team_points + points[data.team_id-1].team_points, data.team_id);
                    statement.finalize();
                } else if (points[data.team_id-1].team_points === 0 && data.team_points < 0) {
                    return
                } else {
                    const statement = db.prepare('UPDATE team_points SET team_points = ? WHERE team_id = ?');
                    statement.run(data.team_points + points[data.team_id-1].team_points, data.team_id);
                    statement.finalize();
                }
            });
        });

        io.emit('points-update', data);

        res.json({ success: 'Successfully sent data!' });
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
    const data: teamPoints[] = []

    db.serialize(() => {
        db.each('SELECT * FROM team_points', (err, row: teamPointsRow) => {
            if (err) {
                console.error(err.message);
                res.status(500).json({ error: 'An error occurred while fetching images' });
            } else {
                data.push({
                    team_id: row.team_id,
                    team_points: row.team_points,
                    team_elms: row.team_elms
                });
            }
        }, function() {
            res.json({ data: data });
        });
    });
});

app.post('/api/team_eliminated', (req, res) => {
    const data = req.body;

    const imagePromises = teamData.team_data.map(async (team, index) => {
        if (team.name === data.data.team_name) {
            const imageData = await readFileAsync(team.logo);

            return {
                team_name: team.name,
                team_logo_data: imageData.toString('base64')
            }
        }
    });
    Promise.all(imagePromises)
        .then((imageData) => {
            res.json(imageData);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).json({ error: 'Error reading image data' });
    });
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

app.post("/api/elms", (req,res) => {
    const { data } = req.body as {data: {points: number, team_id: number}};
    let points: teamPoints[] = [];

    try {
        db.serialize(function() {
            db.each('SELECT * FROM team_points', (err, row: teamPointsRow) => {
                if (err) {
                    console.error(err.message);
                    res.status(500).json({ error: 'An error occurred while fetching images' });
                } else {
                    points.push(row);
                }
            }, function() {
                 const statement = db.prepare('UPDATE team_points SET team_elms = ? WHERE team_id = ?');
                 const pre = points[data.team_id].team_elms || 0;
                 const n = pre + data.points;
                statement.run(n, data.team_id+1);
                statement.finalize();
                let c = [...points];
                c[data.team_id] = {
                    ...c[data.team_id],
                    team_elms: n
                }
                const o = Object.fromEntries(
                    c.map(o => ([
                        o.team_id - 1,
                        o
                    ]))
                );
                console.log(o);
                io.emit("dajjal", o)
            });
        });


        // io.emit('dajjal', data);

        res.json({ success: 'Successfully sent data!' });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Error fetching data' });
    }

    res.end();
})

io.on('connection', (socket) => {
    console.log('A client connected');

    socket.on('disconnect', function() {
        console.log('A client disconnected');
    });
});


function readFileAsync(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};


server.listen(3003);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
