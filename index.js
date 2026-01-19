const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto'); // এপিআই কী তৈরির জন্য
const app = express();

app.use(cors());
app.use(express.json());

// ১. ডাটাবেস কনফিগারেশন
const dbConfig = {
    host: 'mysql-a21af6d-kainalamin04-f79b.i.aivencloud.com',
    port: 13227,
    user: 'avnadmin',
    password: 'AVNS_u5lzpWs1UosOdF3GHEc',
    database: 'defaultdb',
    ssl: { rejectUnauthorized: false }
};

const db = mysql.createPool(dbConfig); // কানেকশন পুল ব্যবহার করা ভালো

// ২. হার্টবিট এবং স্ট্যাটাস (আগের মতোই থাকবে)
let lastHeartbeat = null;
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.json({ status: "success" });
});

app.get('/api/status', (req, res) => {
    const isAppOnline = lastHeartbeat && (Date.now() - lastHeartbeat < 90000);
    res.json({
        api: "Online",
        database: "Online",
        android_app: isAppOnline ? "Online" : "Offline"
    });
});

// ৩. [নতুন] এডমিন এন্ডপয়েন্ট: ক্লায়েন্ট লিস্ট দেখা
app.get('/api/admin/clients', (req, res) => {
    db.query('SELECT * FROM api_users ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ৪. [নতুন] এডমিন এন্ডপয়েন্ট: নতুন API Key তৈরি করা
app.post('/api/admin/generate-key', (req, res) => {
    const { client_name, duration_days } = req.body;
    const apiKey = crypto.randomBytes(16).toString('hex'); // ইউনিক কী জেনারেশন
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(duration_days));

    const sql = 'INSERT INTO api_users (client_name, api_key, expiry_date) VALUES (?, ?, ?)';
    db.query(sql, [client_name, apiKey, expiryDate], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Key Generated", api_key: apiKey });
    });
});

// ৫. [নতুন] এডমিন এন্ডপয়েন্ট: ক্লায়েন্ট স্ট্যাটাস আপডেট (Cancel/Active)
app.put('/api/admin/clients/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.query('UPDATE api_users SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Status Updated" });
    });
});

// ৬. পেমেন্ট রিসিভ এন্ডপয়েন্ট (বিকাশ, নগদ, রকেট)
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const sql = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [sender_number, amount, transaction_id, payment_method, body], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Payment Saved' });
    });
});

// ৭. পেমেন্ট লিস্ট দেখা
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Reseller Server running on ${PORT}`));