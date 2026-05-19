const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const BKASH_CONFIG = {
    baseURL: 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout',
    app_key: 'sandboxTokenizedUser02AppId',
    app_secret: 'sandboxTokenizedUser02AppSecret',
    username: 'sandboxTokenizedUser02',
    password: 'sandboxTokenizedUser02Pass'
};

async function getBkashToken() {
    const response = await fetch(`${BKASH_CONFIG.baseURL}/token/grant`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'password': BKASH_CONFIG.password,
            'username': BKASH_CONFIG.username
        },
        body: JSON.stringify({
            app_key: BKASH_CONFIG.app_key,
            app_secret: BKASH_CONFIG.app_secret
        })
    });
    const data = await response.json();
    return data.id_token;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Signup
app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please provide all fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
        
        db.run(sql, [name, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// 2. Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password' });
    }

    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return user info (without password)
        res.status(200).json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } });
    });
});

// 3. Checkout
app.post('/api/checkout', (req, res) => {
    const { userId, name, phone, address, total, paymentMethod, items } = req.body;

    if (!name || !phone || !address || !items) {
        return res.status(400).json({ error: 'Missing required delivery information' });
    }

    const sql = `INSERT INTO orders (user_id, name, phone, address, total, payment_method, items) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [userId || null, name, phone, address, total, paymentMethod, JSON.stringify(items)];

    db.run(sql, params, function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error while saving order' });
        }
        res.status(201).json({ message: 'Order placed successfully', orderId: this.lastID });
    });
});

// 3.5 bKash Payment Routes
app.post('/api/bkash/create', async (req, res) => {
    const { userId, name, phone, address, total, items } = req.body;

    if (!name || !phone || !address || !items) {
        return res.status(400).json({ error: 'Missing required delivery information' });
    }

    try {
        const token = await getBkashToken();
        const numericTotal = parseFloat(total.replace(/,/g, '').replace(' tk', ''));

        const createRes = await fetch(`${BKASH_CONFIG.baseURL}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token,
                'X-APP-Key': BKASH_CONFIG.app_key
            },
            body: JSON.stringify({
                mode: '0011',
                payerReference: phone,
                callbackURL: `http://localhost:${PORT}/api/bkash/callback`,
                amount: numericTotal.toFixed(2),
                currency: 'BDT',
                intent: 'sale',
                merchantInvoiceNumber: 'INV' + Date.now()
            })
        });
        const paymentData = await createRes.json();

        if (paymentData.statusCode !== '0000') {
            return res.status(500).json({ error: 'Failed to create bKash payment: ' + paymentData.statusMessage });
        }

        const sql = `INSERT INTO orders (user_id, name, phone, address, total, payment_method, items, payment_status, bkash_payment_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [userId || null, name, phone, address, total, 'bkash', JSON.stringify(items), 'pending', paymentData.paymentID];

        db.run(sql, params, function(err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Database error while saving order' });
            }
            res.status(200).json({ bkashURL: paymentData.bkashURL });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during bKash payment creation' });
    }
});

app.get('/api/bkash/callback', async (req, res) => {
    const { paymentID, status } = req.query;

    if (status === 'success') {
        try {
            const token = await getBkashToken();
            const executeRes = await fetch(`${BKASH_CONFIG.baseURL}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token,
                    'X-APP-Key': BKASH_CONFIG.app_key
                },
                body: JSON.stringify({ paymentID })
            });
            const execData = await executeRes.json();

            if (execData.statusCode === '0000' || execData.statusCode === '2062') {
                const sql = `UPDATE orders SET payment_status = 'completed' WHERE bkash_payment_id = ?`;
                db.run(sql, [paymentID], (err) => {
                    if (err) console.error('Error updating order status:', err);
                    res.redirect('/payment-result.html?status=success');
                });
            } else {
                res.redirect(`/payment-result.html?status=failure&msg=${encodeURIComponent(execData.statusMessage)}`);
            }
        } catch (err) {
            console.error(err);
            res.redirect('/payment-result.html?status=failure&msg=Execution_Error');
        }
    } else {
        const sql = `UPDATE orders SET payment_status = ? WHERE bkash_payment_id = ?`;
        db.run(sql, [status, paymentID], (err) => {
            if (err) console.error('Error updating order status:', err);
            res.redirect(`/payment-result.html?status=${status}`);
        });
    }
});

// 4. Quote Request
app.post('/api/quote', (req, res) => {
    const { name, material, areaSize } = req.body;
    
    if (!name || !material || !areaSize) {
        return res.status(400).json({ error: 'Please provide all fields' });
    }

    const sql = `INSERT INTO quotes (name, material, area_size) VALUES (?, ?, ?)`;
    db.run(sql, [name, material, areaSize], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error while saving quote' });
        }
        res.status(201).json({ message: 'Quote requested successfully', quoteId: this.lastID });
    });
});

// Catch-all route to serve the frontend for unknown paths
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
