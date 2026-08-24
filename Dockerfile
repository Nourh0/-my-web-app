# 1. استخدام نسخة Node.js المستقرة
FROM node:18

# 2. تحديد مجلد العمل داخل السيرفر
WORKDIR /usr/src/app

# 3. [تسريع البناء] نسخ ملفات التعريف وتثبيت المكتبات أولاً
# هذا يجعل Render لا يحمل المكتبات في كل مرة إذا لم يتغير package.json
COPY package*.json ./
RUN npm install

# 4. نسخ كافة ملفات المشروع (index.js, index.html, إلخ)
COPY . .

# 5. [إعداد الصلاحيات الذكي] - حل مشكلة الانهيار (Exit Code 1)
# بدلاً من تسمية كل ملف، سنقوم بتهيئة البيئة بالكامل بضربة واحدة
RUN mkdir -p /tmp && chmod 777 /tmp && \
    chmod -R 777 /usr/src/app

# 6. فتح المنفذ الذي يستخدمه الكود
EXPOSE 10000

# 7. أمر التشغيل النهائي
CMD ["node", "index.js"]
