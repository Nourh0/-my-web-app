# 1. استخدام نسخة Node.js المستقرة
FROM node:18

# 2. تحديد مجلد العمل داخل السيرفر
WORKDIR /usr/src/app

# 3. نسخ ملفات التعريف لتثبيت المكتبات
COPY package*.json ./

# 4. تثبيت المكتبات البرمجية
RUN npm install

# 5. نسخ كافة ملفات المشروع (index.js, database.js, إلخ)
COPY . .

# 6. إعداد الصلاحيات (مهم جداً للسحابة وتشغيل الفيديو):
# - إنشاء مجلد tmp للتورنت ومنحه كامل الصلاحيات
# - إنشاء ملف السحابة ومنحه صلاحية الكتابة
RUN mkdir -p /tmp && chmod 777 /tmp && \
    touch cloud_storage.json && chmod 777 cloud_storage.json

# 7. فتح المنفذ الذي يستخدمه الكود
EXPOSE 10000

# 8. أمر تشغيل السيرفر
CMD ["node", "index.js"]
