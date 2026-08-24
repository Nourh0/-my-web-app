const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); // تأكد من وجود الملف بجانبه

const app = express();
app.use(cors());

// تشغيل واجهة الموقع من مجلد public (للمتصفح)
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. ملف التعريف المطور (Manifest) للشعار والكتالوج في ستريمو ---
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.cinema.pro.v7",
        version: "7.0.0",
        name: "iPad Cinema Pro 🎬",
        description: "مكتبة أفلام وبث تورنت حقيقي فائق السرعة للآيباد",
        // شعار الإضافة لكي لا تظهر كمكعب رمادي
        logo: "https://cdn-icons-png.flaticon.com/512/2503/2503508.png", 
        background: "https://wallpaperaccess.com/full/1512225.jpg",
        resources: ["stream", "catalog"],
        types: ["movie", "series"],
        idPrefixes: ["tt"],
        // لظهور البوسترات في واجهة ستريمو الرئيسية (Board)
        catalogs: [
            {
                type: "movie",
                id: "top_movies",
                name: "أفلام iPad Cinema"
            },
            {
                type: "series",
                id: "top_series",
                name: "أنمي ومسلسلات iPad"
            }
        ]
    });
});

// --- 2. معالج الكتالوج (لظهور الأفلام داخل تطبيق ستريمو) ---
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type } = req.params;
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json({ metas: response.data.metas });
    } catch (e) {
        res.json({ metas: [] });
    }
});

// --- 3. معالج API الموقع (لظهور البوسترات في صفحة الويب الخاصة بك) ---
app.get('/api/movies/:type', async (req, res) => {
    const type = req.params.type || 'movie';
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json(response.data.metas);
    } catch (e) {
        res.status(500).send("Error fetching catalog");
    }
});

// --- 4. معالج البحث عن الروابط الحقيقية (Torrentio API) ---
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    try {
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`);
        if (response.data.streams) {
            const streams = response.data.streams.filter(s => s.infoHash).map((s, i) => ({
                title: `🚀 سيرفر آيباد #${i + 1}\n${s.title}`,
                url: `${host}/video?magnet=${encodeURIComponent('magnet:?xt=urn:btih:' + s.infoHash)}`
            }));
            return res.json({ streams });
        }
    } catch (e) { console.log("Stream Error"); }
    res.json({ streams: [] });
});

// --- 5. محرك الفيديو (Video Engine V7 Optimized) ---
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet provided");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 25, // عدد متوازن لاستقرار الرام في Render
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi'));
        if (!file) {
            engine.destroy();
            return res.status(404).send("Not Found");
        }
        
        file.select(); // تحميل البداية فوراً
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
                'Content-Type': 'video/mp4'
            });
            file.createReadStream({ start, end }).pipe(res);
        }
    });

    res.on('close', () => {
        console.log("Destroying engine...");
        engine.destroy();
    });
});

app.get('/', (req, res) => {
    res.send('<h1>iPad Cinema V7 Pro Hybrid is Active! ✅</h1><p>Add /manifest.json to Stremio</p>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`V7 Pro Running on ${PORT}`));
