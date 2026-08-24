const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const trackers = require('./trackers'); 
const cloudDB = require('./database'); 

const app = express();

// 1. تفعيل CORS المطور لضمان التوافق مع مشغلات الايباد وستريمو
app.use(cors({
    origin: '*',
    methods: ['GET', 'HEAD', 'OPTIONS'],
    allowedHeaders: ['Range', 'Content-Type', 'Accept-Encoding', 'Accept-Ranges']
}));

// تشغيل الملفات الثابتة من مجلد public أو المجلد الرئيسي
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// --- [الرئيسية] كود البحث الذكي والمطور عن ملف الواجهة (تم التحديث هنا) ---
app.get('/', (req, res) => {
    // 1. قائمة بجميع المسارات الممكنة (حسب ترتيبك للمجلدات)
    const possiblePaths = [
        path.join(__dirname, 'public', 'index.html'),
        path.join(process.cwd(), 'public', 'index.html'),
        path.join(__dirname, 'index.html'),
        './public/index.html'
    ];

    // 2. البحث عن الملف في القائمة
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`✅ تم العثور على الملف في المسار: ${p}`);
            return res.sendFile(p);
        }
    }

    // 3. إذا لم يجده (جزء التشخيص الذكي المضاف)
    console.log("❌ لم يتم العثور على الملف. جاري فحص المجلدات...");
    const rootFiles = fs.readdirSync(__dirname);
    let publicContent = "المجلد غير موجود";
    
    if (fs.existsSync(path.join(__dirname, 'public'))) {
        publicContent = fs.readdirSync(path.join(__dirname, 'public')).join(', ');
    }

    res.status(404).send(`
        <div dir="rtl" style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 2px solid red; background: #fff5f5;">
            <h2 style="color: red;">⚠️ خطأ في العثور على ملف الواجهة</h2>
            <p>السيرفر يعمل، لكنه لا يرى ملف <b>index.html</b> بالداخل.</p>
            <hr>
            <p><b>محتويات المجلد الرئيسي:</b> [${rootFiles.join(', ')}]</p>
            <p><b>محتويات مجلد public:</b> [${publicContent}]</p>
            <hr>
            <p>💡 <b>نصيحة للإصلاح:</b> تأكد أن اسم المجلد في GitHub هو <b>public</b> بحروف صغيرة تماماً وليس <b>Public</b>.</p>
        </div>
    `);
});

// --- 1. ملف التعريف (Manifest) الكامل لستريمو V8.1 ---
app.get('/manifest.json', (req, res) => {
    res.json({
        id: "org.ipad.cinema.pro.v8",
        version: "8.1.0",
        name: "iPad Cinema Pro 🎬",
        description: "مكتبة أفلام وبث تورنت حقيقي - نظام بروكسي سحابي متطور",
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

// --- 3. معالج الروابط (Stream) بنظام البروكسي لحل مشكلة الـ IP ---
app.get('/stream/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const fullHost = `${protocol}://${host}`;
    
    const cached = cloudDB.getStreams(id);
    if (cached) return res.json({ streams: cached });

    try {
        const response = await axios.get(`https://torrentio.strem.fun/stream/${type}/${id}.json`, { timeout: 5000 });
        
        if (response.data && response.data.streams) {
            const streams = response.data.streams.slice(0, 5).map((s) => ({
                name: "iPad Pro 🚀", 
                title: `${s.title}\n👤 Seeds: ${s.seeders || 'OK'}`,
                url: `${fullHost}/video?magnet=${encodeURIComponent('magnet:?xt=urn:btih:'+s.infoHash)}`
            }));

            cloudDB.saveStreams(id, streams);
            return res.json({ streams });
        }
    } catch (e) {
        console.error("⚠️ فشل جلب الروابط");
    }
    res.json({ streams: [] });
});

// --- 4. محرك الفيديو (البروكسي الشامل) لمنع تعليق الايباد ---
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No valid magnet");

    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 30,
        tmp: '/tmp'
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => 
            f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi')
        );

        if (!file) {
            engine.destroy();
            return res.status(404).send("Video not found");
        }
        
        const range = req.headers.range;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (!range) {
            res.setHeader('Content-Length', file.length);
            file.createReadStream().pipe(res);
        } else {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
            
            res.status(206).set({
                'Content-Range': `bytes ${start}-${end}/${file.length}`,
                'Content-Length': (end - start) + 1,
            });
            file.createReadStream({ start, end }).pipe(res);
        }
    });

    res.on('close', () => engine.destroy());
    engine.on('error', () => engine.destroy());
});

// --- [API] جلب الأفلام لواجهة الويب ---
app.get('/api/movies/movie', async (req, res) => {
    try {
        const response = await axios.get(`https://v3-cinemeta.strem.io/catalog/movie/top.json`);
        const movies = response.data.metas.map(m => ({
            name: m.name, poster: m.poster, imdb_id: m.imdb_id
        }));
        res.json(movies);
    } catch (e) { res.json([]); }
});

// تشغيل السيرفر على IPv4 لضمان التوافق العالمي
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =================================================
    🚀 iPad Cinema Cloud Pro - النسخة النهائية الموحدة
    📡 المنفذ: ${PORT}
    🛠️ نظام البروكسي: مُفعل ✅
    💾 السحابة الحقيقية: مُفعلة ✅
    =================================================
    `);
});
