require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

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

// Serve admin.html
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

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

// Admin endpoint to update user premium status
app.post('/admin/update-premium', (req, res) => {
    const { adminSecret, email, isPremium } = req.body;

    if (adminSecret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Forbidden: Invalid Admin Secret' });
    }

    if (!email || (isPremium !== 0 && isPremium !== 1)) {
        return res.status(400).json({ error: 'Email and valid isPremium status (0 or 1) are required' });
    }

    db.run('UPDATE users SET is_premium = ? WHERE email = ?', [isPremium, email], function(err) {
        if (err) {
            console.error('Error updating premium status:', err.message);
            return res.status(500).json({ error: 'Failed to update premium status' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: `User ${email} premium status updated to ${isPremium}` });
    });
});

// Get user info
app.get('/user-info', authenticateToken, (req, res) => {
    db.get('SELECT email, is_premium FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Error fetching user info:', err.message);
            return res.status(500).json({ error: 'Failed to fetch user info' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ email: user.email, is_premium: user.is_premium === 1 });
    });
});

// API endpoint to generate the script
app.post('/generate', authenticateToken, async (req, res) => {
    const { topic, tone, scriptLength, keyword, platform, numVariations } = req.body; // Define all parameters here

    if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    db.get('SELECT daily_generations, last_generation_date, is_premium FROM users WHERE id = ?', [req.user.id], async (err, user) => {
        if (err) {
            console.error('Error fetching user generation count:', err.message);
            return res.status(500).json({ error: 'Failed to check generation count' });
        }
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        let currentGenerations = user.daily_generations;
        let lastDate = user.last_generation_date;
        const isPremium = user.is_premium; // Get premium status

        // Reset count if it's a new day
        if (lastDate !== today) {
            currentGenerations = 0;
            lastDate = today;
        }

        const FREE_LIMIT = 5; // Free users can generate 5 scripts per day

        if (!isPremium && currentGenerations >= FREE_LIMIT) {
            return res.status(403).json({ error: `일일 생성 제한(${FREE_LIMIT}회)을 초과했습니다. 프리미엄으로 업그레이드하세요!` });
        }

        // Increment generation count only for free users
        if (!isPremium) {
            db.run('UPDATE users SET daily_generations = ?, last_generation_date = ? WHERE id = ?', [currentGenerations + 1, today, req.user.id], (err) => {
                if (err) {
                    console.error('Error updating generation count:', err.message);
                }
            });
        }

        // Call generateScriptAndRespond with all necessary parameters
        await generateScriptAndRespond(req, res, topic, tone, isPremium, scriptLength, keyword, platform, numVariations); 
    });
});

async function generateScriptAndRespond(req, res, topic, tone, isPremiumStatus, scriptLength, keyword, platform, numVariations) { 
    try {
        const parsedScriptLength = parseInt(scriptLength, 10); // Ensure scriptLength is an integer
        const parsedNumVariations = parseInt(numVariations, 10); // Ensure numVariations is an integer

        // Check if user is premium to use keyword feature
        if (keyword && isPremiumStatus !== 1) { 
            return res.status(403).json({ error: '키워드 포함 기능은 프리미엄 사용자만 이용할 수 있습니다.' });
        }

        // Check if user is premium to use longer script feature
        if (parsedScriptLength > 1 && isPremiumStatus !== 1) { 
            return res.status(403).json({ error: '긴 대본 생성 기능은 프리미엄 사용자만 이용할 수 있습니다.' });
        }

        // Check if user is premium to generate multiple variations
        if (parsedNumVariations > 1 && isPremiumStatus !== 1) {
            return res.status(403).json({ error: '여러 대본 변형 생성 기능은 프리미엄 사용자만 이용할 수 있습니다.' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let lengthInstruction = `Your goal is to write a script for a ${parsedScriptLength}-minute video about the topic: **"${topic}"**.`;
        if (parsedScriptLength > 1) {
            lengthInstruction += `
        **Crucial:** Ensure the script is detailed and expansive enough to genuinely fill ${parsedScriptLength} minutes. This means including more scenes, more detailed descriptions, and elaborating on points. Do NOT just write a 1-minute script and repeat it.`;
        }

        let platformInstruction = '';
        switch (platform) {
            case 'youtube_shorts':
                platformInstruction = `
        Optimize for YouTube Shorts: Focus on quick hooks, clear calls to action, and highly engaging visuals. Keep sentences concise.`;
                break;
            case 'tiktok':
                platformInstruction = `
        Optimize for TikTok: Emphasize trending sounds, rapid cuts, and a strong, attention-grabbing opening. Use short, punchy phrases.`;
                break;
            case 'instagram_reels':
                platformInstruction = `
        Optimize for Instagram Reels: Prioritize visually appealing scenes, trending music, and a clear, concise message. Encourage interaction through visuals.`;
                break;
        }

        const basePrompt = `
        You are a world-class scriptwriter for viral short-form video content. Your goal is to write a script.
        ${lengthInstruction}
        The script should have a **${tone}** tone.
        ${platformInstruction}

        ${keyword ? `
        **Important:** The script MUST include the following keyword(s): "${keyword}".
        Integrate it naturally and smoothly into the script.
        ` : ''}

        **Instructions:**
        1.  **Hook (First 3 seconds):** Start with a provocative question, a surprising statement, or a visually arresting scene description that immediately grabs the viewer's attention.
        2.  **Build-Up:** Introduce the core topic. Build tension or curiosity. Use simple language and quick cuts.
        3.  **Climax/Payoff:** Reveal the most interesting fact, the solution to the problem, or the main point of the video. This should be the "Aha!" moment.
        4.  **Outro:** End with a strong call to action (e.g., "Comment your thoughts below!", "Follow for more secrets like this!") and a memorable closing shot.

        **Output Format:**
        - Each script should be clearly structured with headings for Hook, Build-Up, Climax/Payoff, and Outro.
        - Use clear line breaks and bullet points where appropriate for readability.
        - For each scene, describe the **VISUAL** (what we see on screen, including text overlays) and the **AUDIO** (narration, sound effects, BGM suggestions).
        - The narration should be conversational and energetic.

        Now, write the script in **Korean**.
        ${parsedNumVariations > 1 ? `
        **Important:** If generating multiple variations, separate each complete script with the exact string: `---SCRIPT_SEPARATOR---`
        ` : ''}
        `;

        let finalScripts = [];
        for (let i = 0; i < parsedNumVariations; i++) {
            const result = await model.generateContent(basePrompt);
            const response = await result.response;
            finalScripts.push(response.text());
        }

        res.json({ script: parsedNumVariations > 1 ? finalScripts : finalScripts[0] });

    } catch (error) {
        console.error('Error generating script:', error);
        res.status(500).json({ error: 'Failed to generate script' });
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});