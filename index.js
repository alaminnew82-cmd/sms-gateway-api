const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ডাটাবেস কানেকশন
const db = mysql.createConnection({
    host: 'mysql-a21af6d-kainalamin04-f79b.aivencloud.com',
    port: 13227,
    user: 'avnadmin',
    password: 'AVNS_u5lzpWs1UosOdF3GHEc',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false }
});

let lastHeartbeat = null;

// ১. অ্যাপ থেকে হার্টবিট গ্রহণ করার এন্ডপয়েন্ট
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    console.log("Heartbeat received at: " + new Date(lastHeartbeat).toLocaleString());
    res.json({ status: "success", message: "Receiver Online" });
});

// ২. ড্যাশবোর্ডের জন্য স্ট্যাটাস চেক এন্ডপয়েন্ট
app.get('/api/status', (req, res) => {
    // যদি গত ৭০ সেকেন্ডের মধ্যে অ্যাপ থেকে ডাটা আসে, তবেই Online দেখাবে
    const isAppOnline = lastHeartbeat && (Date.now() - lastHeartbeat < 70000);
    
    db.query('SELECT 1', (err) => {
        const isDbOnline = !err;
        res.json({
            api: "Online",
            database: isDbOnline ? "Online" : "Offline",
            android_app: isAppOnline ? "Online" : "Offline"
        });
    });
});

// ৩. এসএমএস রিসিভ করার এন্ডপয়েন্ট (বিকাশ, নগদ, রকেট)
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const query = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    
    db.query(query, [sender_number, amount, transaction_id, payment_method, body], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Payment recorded successfully' });
    });
});

// ৪. ড্যাশবোর্ডে ট্রানজেকশন দেখানোর এন্ডপয়েন্ট
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});