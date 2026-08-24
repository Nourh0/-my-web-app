const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); 
const cloudDB = require('./database'); // استدعاء نظام السحابة للحفظ

const app = express();

// تفعيل CORS لضمان عمل الإضافة على جميع المنصات
app.use(cors());

// تشغيل واجهة الموقع من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// --- [API] جلب الأفلام لصفحة الويب ---
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
    
    // أولاً: محاولة جلب الروابط من السحابة (توفير وقت وبحث)
    const cachedStreams = cloudDB.getStreams(id);
    if (cachedStreams) {
        console.log(`⚡ تم الجلب من السحابة الحقيقية لـ: ${id}`);
        return res.json({ streams: cachedStreams });
    }

    try {
        // ثانياً: إذا لم يوجد، نبحث في المحرك الخارجي
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

            // ثالثاً: حفظ الروابط في السحابة لتسريع الطلبات القادمة
            cloudDB.saveStreams(id, streams);
            
            return res.json({ streams });
        }
    } catch (e) {
        console.error("⚠️ فشل جلب الروابط من المصدر الخارجي");
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

// فتح واجهة الويب مباشرة عند الدخول للرابط الرئيسي
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =================================================
    🚀 iPad Cinema Cloud Pro - تم التشغيل!
    📡 المنفذ: ${PORT}
    💾 نظام السحابة الحقيقية: مُفعل ✅
    =================================================
    `);
});
