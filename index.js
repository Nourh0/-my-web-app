const express = require('express');
const torrentStream = require('torrent-stream');
const cors = require('cors');

const app = express();
app.use(cors()); // لضمان قبول الإضافة في تطبيق ستريمو

// 1. تعريف الإضافة (Manifest)
app.get('/manifest.json', (req, res) => {
    res.json({
        id: "com.stremio.ipad.streamer",
        version: "1.0.0",
        name: "iPad Streamer",
        description: "إضافة لبث التورنت مباشرة للآيباد",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
    });
});

// 2. توفير رابط البث (Stream Handler)
app.get('/stream/:type/:id.json', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`;
    
    // ملاحظة: هنا تضع رابط المغناطيس. (للتجربة وضعنا هذا الرابط)
    const magnetUri = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10";

    res.json({
        streams: [{
            title: "Play on iPad (Direct)",
            url: `${host}/video?magnet=${encodeURIComponent(magnetUri)}`
        }]
    });
});

// 3. معالج الفيديو (Video Engine)
app.get('/video', (req, res) => {
    const magnetUri = req.query.magnet;
    if (!magnetUri) return res.status(400).send("No Magnet");

    const engine = torrentStream(magnetUri);

    engine.on('ready', () => {
        const file = engine.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv'));
        if (!file) return res.status(404).send("File Not Found");

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
app.listen(PORT, () => console.log("Addon Ready!"));
