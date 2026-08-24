const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const app = express();

app.use(cors());

// صفحة اختبار بسيطة (افتحها في المتصفح)
app.get('/', (req, res) => {
    res.send('<h1>Addon is Online! ✅</h1><p>Open <a href="/manifest.json">/manifest.json</a> to check the addon.</p>');
});

// ملف التعريف - Manifest
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        id: "org.ipad.stremio." + Math.floor(Math.random() * 1000), // ID متغير لتجنب الكاش
        version: "1.0.0",
        name: "iPad Torrent Streamer",
        description: "بث تورنت مباشر للآيباد",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

// معالج البث
app.get('/stream/:type/:id.json', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    // رابط تورنت لفيلم مفتوح المصدر (Sintel) للتأكد من أن المشكلة ليست في رابط المغناطيس
    const magnet = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10";
    
    res.json({
        streams: [{
            title: "Play on iPad (Fast Stream)",
            url: `${host}/video?magnet=${encodeURIComponent(magnet)}`
        }]
    });
});

// معالج الفيديو
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No magnet");

    const engine = torrentStream(magnetUri);
    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
        if (!file) return res.status(404).send("No video file");

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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
