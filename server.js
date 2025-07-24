require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const paypal = require('paypal-rest-sdk');

const app = express();
const port = 3000;

// Configure PayPal SDK
paypal.configure({
    'mode': 'sandbox', // 'sandbox' or 'live'
    'client_id': process.env.PAYPAL_CLIENT_ID,
    'client_secret': process.env.PAYPAL_CLIENT_SECRET
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token
        req.user = user;
        next();
    });
};

// Initialize SQLite database
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            daily_generations INTEGER DEFAULT 0,
            last_generation_date TEXT,
            is_premium INTEGER DEFAULT 0
        )`);
        console.log('Users table checked/created.');
    }
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory (or root for simplicity)
app.use(express.static('.'));

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// User registration
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already registered' });
                }
                console.error('Error during registration:', err.message);
                return res.status(500).json({ error: 'Registration failed' });
            }
            res.status(201).json({ message: 'User registered successfully' });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Error during login:', err.message);
            return res.status(500).json({ error: 'Login failed' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Logged in successfully', token });
    });
});

// Create PayPal payment
app.post('/pay', authenticateToken, (req, res) => {
    const create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:3000/success", // Will be updated for deployment
            "cancel_url": "http://localhost:3000/cancel"   // Will be updated for deployment
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": "Premium Subscription",
                    "sku": "001",
                    "price": "9.99",
                    "currency": "USD",
                    "quantity": "1"
                }]
            },
            "amount": {
                "currency": "USD",
                "total": "9.99"
            },
            "description": "Premium subscription for AI Shorts Script Generator"
        }]
    };

    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
            console.error('PayPal payment creation error:', error.response);
            res.status(500).json({ error: 'Failed to create PayPal payment' });
        } else {
            for(let i = 0; i < payment.links.length; i++){
                if(payment.links[i].rel === 'approval_url'){
                    res.json({ approval_url: payment.links[i].href });
                }
            }
        }
    });
});

// Execute PayPal payment
app.get('/execute-payment', authenticateToken, (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
            "amount": {
                "currency": "USD",
                "total": "9.99"
            }
        }]
    };

    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.error('PayPal payment execution error:', error.response);
            res.status(500).json({ error: 'Failed to execute PayPal payment' });
        } else {
            if (payment.state === 'approved') {
                // Update user to premium
                db.run('UPDATE users SET is_premium = 1 WHERE id = ?', [req.user.id], (err) => {
                    if (err) {
                        console.error('Error updating premium status:', err.message);
                        return res.redirect('/cancel?message=Premium_update_failed');
                    }
                    res.redirect('/success');
                });
            } else {
                res.redirect('/cancel?message=Payment_not_approved');
            }
        }
    });
});

// API endpoint to generate the script
app.post('/generate', authenticateToken, async (req, res) => {
    const { topic, tone } = req.body; // Define topic and tone here
    if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    db.get('SELECT daily_generations, last_generation_date FROM users WHERE id = ?', [req.user.id], async (err, user) => { // Added async here
        if (err) {
            console.error('Error fetching user generation count:', err.message);
            return res.status(500).json({ error: 'Failed to check generation count' });
        }
        if (!user) { // Add this check
            return res.status(404).json({ error: 'User not found.' });
        }

        let currentGenerations = user.daily_generations;
        let lastDate = user.last_generation_date;
        const isPremium = user.is_premium; // Get premium status

        // If user is premium, skip limit check
        if (isPremium) {
            await generateScriptAndRespond(req, res, topic, tone);
            return;
        }

        // Reset count if it's a new day
        if (lastDate !== today) {
            currentGenerations = 0;
            lastDate = today;
        }

        const FREE_LIMIT = 5; // Free users can generate 5 scripts per day

        if (currentGenerations >= FREE_LIMIT) {
            return res.status(403).json({ error: `일일 생성 제한(${FREE_LIMIT}회)을 초과했습니다. 프리미엄으로 업그레이드하세요!` });
        }

        // Increment generation count
        db.run('UPDATE users SET daily_generations = ?, last_generation_date = ? WHERE id = ?', [currentGenerations + 1, today, req.user.id], async (err) => { // Added async here
            if (err) {
                console.error('Error updating generation count:', err.message);
            }
            // Move AI generation logic here
            await generateScriptAndRespond(req, res, topic, tone);
        });
    });
});

async function generateScriptAndRespond(req, res, topic, tone) {
    try {
        // No need to check topic here again as it's checked above
        // if (!topic) {
        //     return res.status(400).json({ error: 'Topic is required' });
        // }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
        You are a world-class scriptwriter for viral YouTube Shorts, known for creating addictive and highly engaging content.
        Your goal is to write a script for a 1-minute video about the topic: **"${topic}"**.
        The script should have a **${tone}** tone.

        **Instructions:**
        1.  **Hook (First 3 seconds):** Start with a provocative question, a surprising statement, or a visually arresting scene description that immediately grabs the viewer's attention.
        2.  **Build-Up (Next 20 seconds):** Introduce the core topic. Build tension or curiosity. Use simple language and quick cuts.
        3.  **Climax/Payoff (Next 20 seconds):** Reveal the most interesting fact, the solution to the problem, or the main point of the video. This should be the "Aha!" moment.
        4.  **Outro (Last 7 seconds):** End with a strong call to action (e.g., "Comment your thoughts below!", "Follow for more secrets like this!") and a memorable closing shot.

        **Output Format:**
        - Divide the script into scenes: '[SCENE 1]', '[SCENE 2]', etc.
        - For each scene, describe the **VISUAL** (what we see on screen, including text overlays) and the **AUDIO** (narration, sound effects, BGM suggestions).
        - The narration should be conversational and energetic.

        Now, write the script in **Korean**.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const script = await response.text();

        res.json({ script });

    } catch (error) {
        console.error('Error generating script:', error);
        res.status(500).json({ error: 'Failed to generate script' });
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
