const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); // تأكد من وجود الملف

const app = express();
app.use(cors());
app.use(express.static('public')); // لتشغيل واجهة الموقع

// --- قسم 1: جلب البيانات (Cinemeta & Torrentio) ---

// جلب قائمة الأفلام للموقع
app.get('/api/movies/:type', async (req, res) => {
    const type = req.params.type || 'movie';
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json(response.data.metas);
    } catch (e) { res.status(500).send("Error fetching catalog"); }
});

// جلب رابط التورنت الحقيقي بناءً على ID الفيلم
async function getRealStream(type, id) {
    try {
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`);
        if (response.data.streams && response.data.streams.length > 0) {
            const stream = response.data.streams[0];
            return stream.infoHash ? `magnet:?xt=urn:btih:${stream.infoHash}` : stream.url;
        }
    } catch (e) { console.log("Torrentio error"); }
    return "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c"; // احتياطي
}

// --- قسم 2: إضافة ستريمو (Manifest & Streams) ---

app.get('/manifest.json', (req, res) => {
    res.json({
        id: "org.ipad.hybrid.v6",
        version: "6.0.0",
        name: "iPad Cinema Hybrid 🚀",
        description: "تطبيق ويب + إضافة ستريمو لبث الأفلام الحقيقية",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    const magnet = await getRealStream(type, id);
    res.json({
        streams: [{
            title: "🚀 تشغيل عبر سيرفر V6 (Turbo)",
            url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
        }]
    });
});

// --- قسم 3: محرك الفيديو (Streaming Engine) ---

app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 20,
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi'));
        if (!file) { engine.destroy(); return res.status(404).send("No video file"); }

        file.select();
        const range = req.headers.range;
        if (!range) {
            res.writeHead(200, { 'Content-Length': file.length, 'Content-Type': 'video/mp4' });
            file.createReadStream().pipe(res);
        } else {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${file.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': (end - start) + 1,
                'Content-Type': 'video/mp4',
            });
            file.createReadStream({ start, end }).pipe(res);
        }
    });

    res.on('close', () => engine.destroy());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hybrid App Live on ${PORT}`));
