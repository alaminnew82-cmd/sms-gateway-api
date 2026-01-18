const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); 

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// --- লাইভ ডাটাবেস কানেকশন (Aiven) ---
const dbPool = mysql.createPool({
  host: 'mysql-a21af6d-kainalamin04-f79b.i.aivencloud.com', 
  port: 13227, 
  user: 'avnadmin', 
  password: 'AVNS_u5lzpWs1UosOdF3GHEc', 
  database: 'defaultdb', 
  ssl: { rejectUnauthorized: false }, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ডাটাবেস টেবিল প্রস্তুত করার ফাংশন
async function initializeDB() {
  try {
    const connection = await dbPool.getConnection();
    console.log("লাইভ ডাটাবেসে সফলভাবে কানেক্ট হয়েছে!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_number VARCHAR(20) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        transaction_id VARCHAR(50) NOT NULL UNIQUE,
        status ENUM('Verified', 'Pending', 'Failed') NOT NULL DEFAULT 'Pending',
        payment_method ENUM('bKash', 'Nagad', 'Rocket') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    connection.release();
    console.log("পেমেন্ট টেবিল প্রস্তুত আছে।");
  } catch (err) {
    console.error("ডাটাবেস কানেকশনে সমস্যা:", err.message);
  }
}

// --- নতুন এন্ডপয়েন্ট: অ্যাপের স্ট্যাটাস চেক করার জন্য ---
app.get('/api/status', (req, res) => {
  console.log("অ্যাপ থেকে হেলথ চেক রিকোয়েস্ট এসেছে!");
  res.status(200).json({ status: "online" });
});

// পেমেন্ট ডাটা দেখার এন্ডপয়েন্ট
app.get('/api/payments', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database query error' });
  }
});

// এসএমএস থেকে আসা পেমেন্ট রিসিভ করার এন্ডপয়েন্ট
app.post('/api/receive-sms', async (req, res) => {
  const { sender_number, amount, transaction_id, payment_method } = req.body;
  console.log(`নতুন পেমেন্ট রিসিভ: ${payment_method} - ${amount} Tk from ${sender_number}`);
  
  try {
    const query = `INSERT INTO payments (sender_number, amount, transaction_id, payment_method, status) VALUES (?, ?, ?, ?, 'Pending')`;
    await dbPool.execute(query, [sender_number, amount, transaction_id, payment_method]);
    res.status(201).json({ message: 'পেমেন্ট রেকর্ড করা হয়েছে' });
  } catch (error) {
    console.error("পেমেন্ট সেভ করতে সমস্যা:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// সার্ভার চালু করা
app.listen(port, "0.0.0.0", async () => {
  console.log(`সার্ভার চলছে পোর্টে: ${port}`);
  console.log(`আপনার লোকাল আইপি: 192.168.43.140`);
  await initializeDB();
});