const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes'); // استدعاء ملف الروابط (manifest, stream, video)

const app = express();

// 1. الإعدادات الأساسية
app.use(cors());

// 2. السماح بالوصول للملفات في المجلد الرئيسي مباشرة (بدون public)
app.use(express.static(__dirname));

// 3. [تحديث] توجيه الرابط الرئيسي لفتح index.html من المجلد الحالي مباشرة
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

// 4. ربط بقية الروابط (ستريمو و API) بملف routes.js
app.use('/', routes);

// 5. إعداد المنفذ لـ Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 السيرفر يعمل بنجاح بدون مجلد public`);
    console.log(`📡 المنفذ الحالي: ${PORT}`);
    console.log(`🏠 الواجهة الرئيسية: index.html (Root)`);
    console.log(`=========================================`);
});
