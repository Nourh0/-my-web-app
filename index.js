const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const trackers = require('./trackers'); // تأكد من وجود ملف trackers.js بجانبه

const app = express();

// تفعيل CORS لضمان قبول الإضافة في تطبيق ستريمو والآيباد
app.use(cors());

// تشغيل واجهة الموقع من مجلد public (للمتصفح والآيباد)
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. ملف التعريف النهائي (Manifest V8.1) ---
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.cinema.pro.v8",
        version: "8.1.0",
        name: "iPad Cinema Pro 🎬",
        description: "مكتبة أفلام وبث تورنت حقيقي فائق السرعة - نسخة مصلحة كلياً",
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

// --- 2. معالج الكتالوج (Catalog) ---
app.get('/catalog/:type/:id.json', async (req, res) => {
    const { type } = req.params;
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/${type}/top.json`);
        res.json({ metas: response.data.metas });
    } catch (e) {
        res.json({ metas: [] });
    }
});

// --- 3. معالج البحث الذكي عن الروابط (Stream Handler V8) ---
// تم دمج تحسينات التقرير لحل مشكلة المصفوفة الفارغة []
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const host = `${req.protocol}://${req.get('host')}`;
    
    console.log(`🔎 جاري البحث عن روابط للمعرف: ${id}`);

    try {
        // طلب الروابط من Torrentio مع مهلة زمنية 4 ثوانٍ
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 4000 });
        
        if (response.data && response.data.streams && response.data.streams.length > 0) {
            const streams = response.data.streams.slice(0, 5).map((s) => {
                const magnet = `magnet:?xt=urn:btih:${s.infoHash}`;
                return {
                    name: "iPad Cinema Pro 🚀", 
                    title: `${s.title}\n👤 Seeds: ${s.seeders || 'OK'}`,
                    url: `${host}/video?magnet=${encodeURIComponent(magnet)}`,
                    behaviorHints: {
                        notWebReady: false,
                        bingeGroup: `ipad-pro-${id}`
                    }
                };
            });
            return res.json({ streams });
        }
    } catch (e) {
        console.error("⚠️ خطأ في السكرابر أو انتهت المهلة");
    }

    // إذا لم يجد روابط، يرسل رسالة تنبيه بدلاً من مصفوفة فارغة ليعرف المستخدم أن السيرفر يعمل
    res.json({ 
        streams: [{
            name: "⚠️ تنبيه",
            title: "جاري البحث عن مصادر.. يرجى العودة للخلف والمحاولة مرة أخرى",
            url: `${host}/video?magnet=0` 
        }] 
    });
});

// --- 4. محرك الفيديو المتطور (Video Engine V8) ---
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri || magnetUri === '0') return res.status(400).send("No valid magnet");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 20, // عدد متوازن لمنع انهيار الخادم في Render
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi'));
        if (!file) {
            engine.destroy();
            return res.status(404).send("Video file not found");
        }
        
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
                'Content-Type': 'video/mp4'
            });
            file.createReadStream({ start, end }).pipe(res);
        }
    });

    res.on('close', () => {
        console.log("Cleanup: Destroying torrent engine");
        engine.destroy();
    });
});

app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; padding:50px; font-family:sans-serif;">
            <h1 style="color:#2c3e50;">iPad Cinema Pro V8.1 Hybrid ✅</h1>
            <p>السيرفر يعمل بكامل طاقته على المنفذ المخصص.</p>
            <code style="background:#eee; padding:10px;">/manifest.json</code>
        </div>
    `);
});

// --- إعداد المنفذ لـ Render ---
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =================================================
    🚀 iPad Cinema V8.1 Pro - تم التشغيل بنجاح!
    📡 المنفذ: ${PORT}
    🛠️ تم دمج تحسينات V7 و V8
    ✅ جاهز للبث الحقيقي
    =================================================
    `);
});
