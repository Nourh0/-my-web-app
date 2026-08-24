const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const trackers = require('./trackers'); // تأكد من وجود ملف trackers.js

const app = express();
app.use(cors());

// 1. الصفحة الرئيسية (واجهة احترافية لمساعدتك في نسخ الرابط)
app.get('/', (req, res) => {
    res.send(`
        <div style="text-align:center; margin-top:50px; font-family:sans-serif; background-color:#f4f4f9; padding:20px; border-radius:10px;">
            <h1 style="color:#2c3e50;">iPad Turbo Streamer V5 🚀</h1>
            <p style="color:#7f8c8d;">الإضافة تعمل بنجاح! انسخ الرابط أدناه وأضفه إلى ستريمو:</p>
            <div style="background:#fff; border:1px solid #ddd; padding:15px; display:inline-block; border-radius:5px; margin-top:10px;">
                <code style="color:#e74c3c; font-weight:bold;">${req.protocol}://${req.get('host')}/manifest.json</code>
            </div>
            <p style="margin-top:20px; color:#95a5a6; font-size:12px;">نظام المعالجة السريعة مفعل ✅ | حماية الذاكرة مفعلة ✅</p>
        </div>
    `);
});

// 2. ملف التعريف (Manifest V5)
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.turbo.final.v5",
        version: "5.0.0",
        name: "iPad Turbo Streamer 🚀",
        description: "أسرع نسخة لبث التورنت على الآيباد مع حماية من التعليق",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

// 3. معالج البث (Stream)
app.get('/stream/:type/:id.json', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    // فيلم Big Buck Bunny (رابط سريع جداً للاختبار)
    const magnet = "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c";
    
    res.json({
        streams: [{
            title: "🚀 تشغيل فوري (V5 Fast Buffer)",
            url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
        }]
    });
});

// 4. معالج الفيديو (Video Engine - النسخة المطورة)
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet provided");

    // إعدادات خاصة لـ Render لضمان عدم استهلاك الرام وسرعة الاستجابة
    const engine = torrentStream(magnetUri, {
        trackers: trackers,
        connections: 20, // عدد متوازن لمنع انهيار السيرفر
        uploads: 0,
        tmp: '/tmp',
        path: '/tmp'
    });

    // نظام الحماية: إذا لم يبدأ التحميل خلال 25 ثانية، يتم إعادة ضبط المحرك
    const timeout = setTimeout(() => {
        if (engine && !engine.ready) {
            console.log("Timeout: Seeds are too slow.");
            engine.destroy();
            if (!res.headersSent) {
                res.status(408).send("جاري البحث عن موزعين، يرجى إعادة المحاولة...");
            }
        }
    }, 25000);

    engine.on('ready', () => {
        clearTimeout(timeout); // إلغاء التايم آوت عند النجاح
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
        
        if (!file) {
            engine.destroy();
            return res.status(404).send("Video Not Found");
        }

        // تفعيل ميزة الاختيار المتسلسل (تحميل بداية الفيديو أولاً)
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
                'Cache-Control': 'no-cache' // منع الآيباد من تخزين بيانات قديمة
            });

            file.createReadStream({ start, end }).pipe(res);
        }
    });

    // تنظيف السيرفر وإغلاق المحرك فوراً عند الخروج لتوفير الرام
    res.on('close', () => engine.destroy());
    engine.on('error', () => engine.destroy());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Turbo V5 is running on port ${PORT}`);
});
