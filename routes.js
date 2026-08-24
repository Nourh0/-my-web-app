const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes'); // استدعاء ملف الروابط الجديد

const app = express();

// الإعدادات الأساسية
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ربط جميع الروابط بملف routes.js
app.use('/', routes);

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل بكفاءة عبر ملف الروابط الذكي على المنفذ: ${PORT}`);
});
