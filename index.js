const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
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

const db = mysql.createPool(dbConfig);

// ২. [নতুন] মিডলওয়্যার: কাস্টমারের এপিআই কী এবং মেয়াদ যাচাই করা
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: "API Key missing" });

    // চেক করা হচ্ছে কী-টি সচল এবং মেয়াদের মধ্যে আছে কি না
    const sql = "SELECT * FROM api_users WHERE api_key = ? AND status = 'active' AND expiry_date > NOW()";
    db.query(sql, [apiKey], (err, results) => {
        if (err || results.length === 0) {
            return res.status(403).json({ error: "Invalid, Cancelled or Expired API Key" });
        }
        req.client = results[0];
        next();
    });
};

// ৩. [নতুন] কাস্টমার এন্ডপয়েন্ট: পেমেন্ট ভেরিফাই করার জন্য (এটি তারা ব্যবহার করবে)
app.post('/api/v1/verify-payment', validateApiKey, (req, res) => {
    const { transaction_id } = req.body;
    if (!transaction_id) return res.status(400).json({ error: "Transaction ID is required" });

    const sql = "SELECT * FROM payments WHERE transaction_id = ?";
    db.query(sql, [transaction_id], (err, results) => {
        if (err) return res.status(500).json(err);
        if (results.length === 0) return res.status(404).json({ status: "not_found", message: "Payment not found in database" });

        res.json({
            status: "success",
            message: "Payment Verified",
            data: {
                method: results[0].payment_method,
                amount: results[0].amount,
                sender: results[0].sender_number,
                time: results[0].created_at
            }
        });
    });
});

// ৪. হার্টবিট এবং স্ট্যাটাস (ড্যাশবোর্ডের জন্য)
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

// ৫. এডমিন এন্ডপয়েন্ট: ক্লায়েন্ট লিস্ট এবং কী জেনারেশন
app.get('/api/admin/clients', (req, res) => {
    db.query('SELECT * FROM api_users ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/admin/generate-key', (req, res) => {
    const { client_name, duration_days } = req.body;
    const apiKey = crypto.randomBytes(16).toString('hex');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(duration_days));

    const sql = 'INSERT INTO api_users (client_name, api_key, expiry_date) VALUES (?, ?, ?)';
    db.query(sql, [client_name, apiKey, expiryDate], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Key Generated Successfully", api_key: apiKey, expiry: expiryDate });
    });
});

app.put('/api/admin/clients/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    db.query('UPDATE api_users SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Status Updated" });
    });
});

// ৬. পেমেন্ট রিসিভ (অ্যান্ড্রয়েড অ্যাপ থেকে ডাটা আসবে)
app.post('/api/receive-sms', (req, res) => {
    const { sender_number, amount, transaction_id, payment_method, body } = req.body;
    const sql = 'INSERT INTO payments (sender_number, amount, transaction_id, payment_method, body) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [sender_number, amount, transaction_id, payment_method, body], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Payment Saved' });
    });
});

// ৭. মেইন পেমেন্ট লিস্ট (ড্যাশবোর্ডের জন্য)
app.get('/api/payments', (req, res) => {
    db.query('SELECT * FROM payments ORDER BY created_at DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`PayWatchBD Pro Server running on ${PORT}`));