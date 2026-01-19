const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ১. ডাটাবেস কানেকশন (Aiven MySQL)
const dbConfig = {
    host: 'mysql-a21af6d-kainalamin04-f79b.i.aivencloud.com',
    port: 13227,
    user: 'avnadmin',
    password: 'AVNS_u5lzpWs1UosOdF3GHEc',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    connectTimeout: 30000
};

let db;
let lastHeartbeat = null;

function handleDisconnect() {
    db = mysql.createConnection(dbConfig);
    db.connect((err) => {
        if (err) {
            console.error('DB Connection Error:', err.message);
            setTimeout(handleDisconnect, 5000);
        } else {
            console.log('Connected to Database successfully!');
        }
    });
    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') handleDisconnect();
        else console.error('DB Error:', err.message);
    });
}
handleDisconnect();

// ২. হার্টবিট এন্ডপয়েন্ট (অ্যাপ চালু মাত্রই সবুজ করবে)
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.json({ status: "success", timestamp: lastHeartbeat });
});

// ৩. স্ট্যাটাস এন্ডপয়েন্ট (ড্যাশবোর্ড বাতি নিয়ন্ত্রণ)
app.get('/api/status', (req, res) => {
    const isAppOnline = lastHeartbeat && (Date.now() - lastHeartbeat < 90000); // ৯০ সেকেন্ড বাফার
    res.json({
        api: "Online",
        database: db.state === 'authenticated' ? "Online" : "Offline",
        android_app: isAppOnline ? "Online" : "Offline"
    });
});

// ৪. এসএমএস রিসিভ (বিকাশ, নগদ, রকেট)
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const sql = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [sender_number, amount, transaction_id, payment_method, body], (err) => {
        if (err) return res.status(500).json({ error: "Failed" });
        res.json({ message: 'Success' });
    });
});

// ৫. পেমেন্ট লিস্ট
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        res.json(results);
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));