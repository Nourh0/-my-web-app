const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cloud_storage.json');

// التأكد من وجود ملف السحابة أو إنشاؤه
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ movies: {}, streams: {} }, null, 2));
}

const cloudDB = {
    // حفظ بيانات الفيلم
    saveMovie: (id, data) => {
        const db = JSON.parse(fs.readFileSync(DB_PATH));
        db.movies[id] = { ...data, timestamp: Date.now() };
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    },

    // جلب بيانات الفيلم من السحابة
    getMovie: (id) => {
        const db = JSON.parse(fs.readFileSync(DB_PATH));
        return db.movies[id] || null;
    },

    // حفظ الروابط (Streams) لعدم تكرار البحث
    saveStreams: (id, streams) => {
        const db = JSON.parse(fs.readFileSync(DB_PATH));
        db.streams[id] = { streams, timestamp: Date.now() };
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    },

    getStreams: (id) => {
        const db = JSON.parse(fs.readFileSync(DB_PATH));
        const data = db.streams[id];
        // صلاحية الرابط في السحابة 24 ساعة ثم يطلب تجديده
        if (data && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            return data.streams;
        }
        return null;
    }
};

module.exports = cloudDB;
