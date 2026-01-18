const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ১. ডাটাবেস কানেকশন (Aiven MySQL)
const db = mysql.createConnection({
    host: 'mysql-a21af6d-kainalamin04-f79b.aivencloud.com',
    port: 13227,
    user: 'avnadmin',
    password: 'AVNS_u5lzpWs1UosOdF3GHEc',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false }
});

let lastHeartbeat = null;

// ২. হার্টবিট এন্ডপয়েন্ট (অ্যাপ অনলাইন দেখানোর জন্য)
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.json({ status: "success" });
});

// ৩. স্ট্যাটাস এন্ডপয়েন্ট (সবুজ বাতি জ্বালানোর জন্য)
app.get('/api/status', (req, res) => {
    const isAppOnline = lastHeartbeat && (Date.now() - lastHeartbeat < 90000);
    db.query('SELECT 1', (err) => {
        res.json({
            api: "Online",
            database: err ? "Offline" : "Online",
            android_app: isAppOnline ? "Online" : "Offline"
        });
    });
});

// ৪. এসএমএস রিসিভ এন্ডপয়েন্ট (বিকাশ, নগদ, রকেট)
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const sql = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [sender_number, amount, transaction_id, payment_method, body], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Success' });
    });
});

// ৫. ডাটা ড্যাশবোর্ডে দেখানোর এন্ডপয়েন্ট
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));