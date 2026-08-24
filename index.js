const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); // تأكد من وجود الملف بجانبه

const app = express();
app.use(cors());

// تشغيل واجهة الموقع من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. قسم جلب بيانات الكتالوج للموقع (Cinemeta) ---
app.get('/api/movies/:type', async (req, res) => {
    const type = req.params.type || 'movie';
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json(response.data.metas);
    } catch (e) {
        res.status(500).send("Error fetching catalog");
    }
});

// --- 2. قسم إضافة ستريمو (Manifest V6.5) ---
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.hybrid.v6",
        version: "6.5.0",
        name: "iPad Cinema Hybrid 🚀",
        description: "بث الأفلام والمسلسلات الحقيقية مباشرة للآيباد",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

// --- 3. معالج البحث الذكي عن الروابط الحقيقية (Torrentio Integration) ---
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    
    try {
        // جلب أفضل رابط تورنت حقيقي من Torrentio بناءً على الفيلم المختار
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`);
        
        if (response.data.streams && response.data.streams.length > 0) {
            // تصفية الروابط وجلب أول رابط يحتوي على infoHash
            const realStreams = response.data.streams.filter(s => s.infoHash).map((stream, index) => {
                const magnet = `magnet:?xt=urn:btih:${stream.infoHash}`;
                return {
                    title: `🚀 سيرفر آيباد #${index + 1}\n${stream.title}`,
                    url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
                };
            });

            return res.json({ streams: realStreams });
        }
    } catch (e) {
        console.log("Error fetching real stream from Torrentio");
    }

    // إذا لم يجد روابط، يعيد مصفوفة فارغة بدلاً من رابط تجريبي
    res.json({ streams: [] });
});

// --- 4. محرك الفيديو (Video Engine - V6.5 Optimized) ---
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet provided");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 20, // عدد متوازن لمنع انهيار الرام في Render
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi'));
        
        if (!file) {
            engine.destroy();
            return res.status(404).send("Video Not Found");
        }

        // تحميل بداية الملف فوراً لسرعة التشغيل
        file.select();

        const range = req.headers.range;
        if (!range) {
            res.writeHead(200, { 
                'Content-Length': file.length, 
                'Content-Type': 'video/mp4' 
            });
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

    // إغلاق المحرك فوراً عند إيقاف الفيلم لتوفير موارد السيرفر
    res.on('close', () => {
        console.log("Destroying engine...");
        engine.destroy();
    });
});

app.get('/', (req, res) => {
    res.send('<h1>iPad Cinema V6.5 Hybrid is Active! ✅</h1>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Hybrid V6.5 Running on ${PORT}`));
