const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); 

const app = express();

// تفعيل CORS لضمان قبول الإضافة في تطبيق ستريمو والآيباد والمتصفحات
app.use(cors());

// تشغيل واجهة الموقع من مجلد public
// هذا السطر يجعل السيرفر يقرأ ملف index.html الموجود داخل مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// --- [جديد] مسار جلب الأفلام لواجهة الويب (المكتبة) ---
app.get('/api/movies/movie', async (req, res) => {
    try {
        // جلب قائمة الأفلام الشهيرة من Cinemeta لعرضها في موقعك
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/movie/top.json`);
        const movies = response.data.metas.map(m => ({
            name: m.name,
            poster: m.poster,
            imdb_id: m.imdb_id
        }));
        res.json(movies);
    } catch (e) {
        res.json([]);
    }
});

// --- 1. ملف التعريف النهائي (Manifest) لستريمو ---
app.get('/manifest.json', (req, res) => {
    res.json({
        id: "org.ipad.cinema.pro.v8",
        version: "8.1.0",
        name: "iPad Cinema Pro 🎬",
        description: "مكتبة أفلام وبث تورنت حقيقي فائق السرعة",
        logo: "https://cdn-icons-png.flaticon.com/512/2503/2503508.png", 
        background: "https://wallpaperaccess.com/full/1512225.jpg",
        resources: ["stream", "catalog"],
        types: ["movie", "series"],
        idPrefixes: ["tt"],
        catalogs: [
            { type: "movie", id: "top_movies", name: "أفلام iPad Cinema" },
            { type: "series", id: "top_series", name: "أنمي ومسلسلات iPad" }
        ]
    });
});

// --- 2. معالج الكتالوج (Catalog) لستريمو ---
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type } = req.params;
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json({ metas: response.data.metas });
    } catch (e) {
        res.json({ metas: [] });
    }
});

// --- 3. معالج الروابط (Stream Handler) لستريمو والويب ---
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    
    try {
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 4000 });
        
        if (response.data && response.data.streams) {
            const streams = response.data.streams.slice(0, 5).map((s) => {
                const magnet = `magnet:?xt=urn:btih:${s.infoHash}`;
                return {
                    name: "iPad Cinema Pro 🚀", 
                    title: `${s.title}\n👤 Seeds: ${s.seeders || 'OK'}`,
                    url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
                };
            });
            return res.json({ streams });
        }
    } catch (e) {
        console.error("Error fetching streams");
    }

    res.json({ streams: [] });
});

// --- 4. محرك الفيديو (Video Engine) - المسؤول عن تشغيل التورنت ---
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No valid magnet");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 20,
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi'));
        if (!file) {
            engine.destroy();
            return res.status(404).send("Video file not found");
        }
        
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

    res.on('close', () => engine.destroy());
});

// المسار الرئيسي يفتح واجهة الويب مباشرة
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر شغال على البورت: ${PORT}`);
});
