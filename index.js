const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ১. ডাটাবেস কনফিগারেশন (আপনার দেওয়া নতুন তথ্য অনুযায়ী)
const dbConfig = {
    host: 'mysql-a21af6d-kainalamin04-f79b.i.aivencloud.com', // এখানে .i. যোগ করা হয়েছে
    port: 13227,
    user: 'avnadmin',
    password: 'AVNS_u5lzpWs1UosOdF3GHEc',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false },
    connectTimeout: 30000 
};

let db;
let lastHeartbeat = null;

// কানেকশন হ্যান্ডলার (সার্ভার ক্রাশ হওয়া ঠেকাবে)
function handleDisconnect() {
    db = mysql.createConnection(dbConfig);
    db.connect((err) => {
        if (err) {
            console.error('Error connecting to DB:', err.message);
            setTimeout(handleDisconnect, 5000); // ৫ সেকেন্ড পর আবার চেষ্টা করবে
        } else {
            console.log('Connected to Aiven MySQL successfully!');
        }
    });

    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
            handleDisconnect();
        } else {
            console.error('DB Error:', err.message);
        }
    });
}

handleDisconnect();

// ২. হার্টবিট এন্ডপয়েন্ট (অ্যান্ড্রয়েড অ্যাপের জন্য)
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.json({ status: "success" });
});

// ৩. সিস্টেম স্ট্যাটাস এন্ডপয়েন্ট (সবুজ বাতি চেক)
app.get('/api/status', (req, res) => {
    const isAppOnline = lastHeartbeat && (Date.now() - lastHeartbeat < 90000);
    res.json({
        api: "Online",
        database: db.state === 'authenticated' ? "Online" : "Offline",
        android_app: isAppOnline ? "Online" : "Offline"
    });
});

// ৪. এসএমএস ডাটা রিসিভ এন্ডপয়েন্ট
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const sql = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [sender_number, amount, transaction_id, payment_method, body], (err) => {
        if (err) return res.status(500).json({ error: "Failed to save" });
        res.json({ message: 'Success' });
    });
});

// ৫. ট্রানজেকশন ডাটা রিড এন্ডপয়েন্ট
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: "Database offline" });
        res.json(results);
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port ${PORT}`));