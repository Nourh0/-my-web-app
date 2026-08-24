const fs = require('fs');
const path = require('path');

// مسار ملف السحابة في المجلد الرئيسي بجانب index.js
const DB_PATH = path.join(process.cwd(), 'cloud_storage.json');

// دالة مساعدة لقراءة الملف بأمان (تمنع انهيار السيرفر)
const readDB = () => {
    try {
        if (!fs.existsSync(DB_PATH)) {
            const initialData = { movies: {}, streams: {} };
            fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data || '{"movies": {}, "streams": {}}');
    } catch (err) {
        console.error("⚠️ خطأ في قراءة السحابة، تم إعادة ضبطها.");
        return { movies: {}, streams: {} };
    }
};

// دالة مساعدة للكتابة بأمان
const writeDB = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("⚠️ فشل في حفظ البيانات في السحابة.");
    }
};

const cloudDB = {
    // حفظ بيانات الفيلم
    saveMovie: (id, data) => {
        const db = readDB();
        db.movies[id] = { ...data, timestamp: Date.now() };
        writeDB(db);
    },

    // جلب بيانات الفيلم
    getMovie: (id) => {
        const db = readDB();
        return db.movies[id] || null;
    },

    // حفظ الروابط لعدم تكرار البحث (تسريع البث)
    saveStreams: (id, streams) => {
        const db = readDB();
        db.streams[id] = { streams, timestamp: Date.now() };
        writeDB(db);
    },

    // جلب الروابط مع فحص الصلاحية (24 ساعة)
    getStreams: (id) => {
        const db = readDB();
        const data = db.streams[id];
        if (data && Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
            return data.streams;
        }
        return null;
    }
};

module.exports = cloudDB;
