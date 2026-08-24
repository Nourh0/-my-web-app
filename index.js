const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const trackers = require('./trackers'); 
const cloudDB = require('./database'); // استدعاء نظام السحابة للحفظ

const app = express();

// تفعيل CORS لضمان عمل الإضافة على جميع المنصات (آيباد، متصفح، ستريمو)
app.use(cors());

// تشغيل الملفات الثابتة من مجلد public أو المجلد الرئيسي
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// --- [API] جلب الأفلام لواجهة الويب ---
app.get('/api/movies/movie', async (req, res) => {
    try {
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

// --- [الرئيسية] ذكاء البحث عن ملف index.html لحل مشكلة الـ 404 ---
app.get('/', (req, res) => {
    const locations = [
        path.join(__dirname, 'public', 'index.html'),
        path.join(__dirname, 'index.html'),
        '/usr/src/app/public/index.html',
        '/usr/src/app/index.html'
    ];
    
    for (let loc of locations) {
        if (fs.existsSync(loc)) {
            return res.sendFile(loc);
        }
    }
    res.status(404).send("Error: index.html not found. تأكد من وجود المجلد public وبداخله الملف.");
});

// --- 1. ملف التعريف (Manifest) لستريمو ---
app.get('/manifest.json', (req, res) => {
    res.json({
        id: "org.ipad.cinema.pro.v8",
        version: "8.1.0",
        name: "iPad Cinema Pro 🎬",
        description: "مكتبة أفلام وبث تورنت حقيقي - مدعوم بالسحابة الحقيقية",
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

// --- 2. معالج الكتالوج لستريمو ---
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type } = req.params;
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json({ metas: response.data.metas });
    } catch (e) {
        res.json({ metas: [] });
    }
});

// --- 3. معالج الروابط الذكي (يدعم السحابة الحقيقية) ---
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    
    // أولاً: جلب من السحابة
    const cached = cloudDB.getStreams(id);
    if (cached) {
        console.log(`⚡ جلب من السحابة: ${id}`);
        return res.json({ streams: cached });
    }

    try {
        // ثانياً: البحث الخارجي
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 5000 });
        
        if (response.data && response.data.streams) {
            const streams = response.data.streams.slice(0, 5).map((s) => ({
                name: "iPad Pro 🚀", 
                title: `${s.title}\n👤 Seeds: ${s.seeders || 'OK'}`,
                url: `${host}/video?magnet=${encodeURIComponent('magnet:?xt=urn:btih:'+s.infoHash)}`
            }));

            // ثالثاً: حفظ في السحابة
            cloudDB.saveStreams(id, streams);
            return res.json({ streams });
        }
    } catch (e) {
        console.error("⚠️ فشل جلب الروابط");
    }
    res.json({ streams: [] });
});

// --- 4. محرك الفيديو المتطور ---
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

// إعداد المنفذ لـ Render و Google Cloud
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =================================================
    🚀 iPad Cinema Cloud Pro - تم التشغيل بنجاح!
    📡 الرابط جاهز للعمل على المنفذ: ${PORT}
    💾 نظام السحابة الحقيقية: مُفعل ✅
    =================================================
    `);
});
