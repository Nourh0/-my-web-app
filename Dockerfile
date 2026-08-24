# 1. استخدام نسخة Node.js المستقرة
FROM node:18

# 2. تحديد مجلد العمل داخل السيرفر
WORKDIR /usr/src/app

# 3. نسخ ملفات التعريف (package.json) أولاً لتسريع البناء
COPY package*.json ./

# 4. تثبيت المكتبات البرمجية
RUN npm install

# 5. نسخ كافة ملفات المشروع (index.js, index.html, database.js, trackers.js)
# بما أن index.html أصبح في المجلد الرئيسي، سيتم نسخه هنا مباشرة
COPY . .

# 6. إعداد الصلاحيات (حاسم جداً لعمل البث والسحابة)
# - إنشاء مجلد /tmp للتورنت ومنحه صلاحيات كاملة
# - إنشاء ملف السحابة cloud_storage.json ومنحه صلاحيات الكتابة
# - التأكد من صلاحيات الوصول لملف index.html
RUN mkdir -p /tmp && chmod 777 /tmp && \
    touch cloud_storage.json && chmod 777 cloud_storage.json && \
    chmod 644 index.html

# 7. فتح المنفذ 10000 (الذي حددناه في Environment Variables)
EXPOSE 10000

# 8. أمر تشغيل السيرفر
CMD ["node", "index.js"]
