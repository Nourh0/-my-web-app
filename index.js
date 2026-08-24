const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const trackers = require('./trackers'); // تأكد من وجود ملف trackers.js في نفس المجلد

const app = express();
app.use(cors());

// 1. الصفحة الرئيسية للاختبار
app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:50px; font-family:sans-serif;">
            <h1>iPad Turbo Streamer Online! ✅</h1>
            <p>انسخ الرابط التالي وضعه في ستريمو:</p>
            <code style="background:#eee; padding:10px;">${req.protocol}://${req.get('host')}/manifest.json</code>
        </div>
    `);
});

// 2. ملف التعريف - Manifest
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.turbo.final.v4",
        version: "4.0.0",
        name: "iPad Turbo Streamer ✅",
        description: "بث تورنت فائق السرعة يدعم التقديم والتأخير للآيباد",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

// 3. معالج البث - Stream
app.get('/stream/:type/:id.json', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    // فيلم تجريبي (Big Buck Bunny) سريع جداً ومثالي لاختبار السرعة
    const magnet = "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c";
    
    res.json({
        streams: [{
            title: "🚀 تشغيل صاروخي (Turbo Speed)",
            url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
        }]
    });
});

// 4. معالج الفيديو - Video Engine
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet provided");

    // إعدادات المحرك لضمان السرعة وعدم انهيار السيرفر (Render Friendly)
    const engine = torrentStream(magnetUri, {
        trackers: trackers,    // استخدام قائمة المسرعات
        connections: 35,       // عدد متصلين متوازن لاستقرار الذاكرة
        uploads: 0,            // إيقاف الرفع لتوفير سرعة التحميل
        tmp: '/tmp',           // استخدام مجلد النظام المؤقت
    });

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
        
        if (!file) {
            engine.destroy();
            return res.status(404).send("No video file found");
        }

        // إعطاء أولوية لتحميل البداية فوراً
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
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${file.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4'
            });

            file.createReadStream({ start, end }).pipe(res);
        }
    });

    // تنظيف الذاكرة وإغلاق المحرك عند إغلاق المشغل أو حدوث خطأ
    res.on('close', () => {
        console.log('Client closed connection. Destroying engine...');
        engine.destroy();
    });

    engine.on('error', (err) => {
        console.error('Engine error:', err);
        engine.destroy();
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
