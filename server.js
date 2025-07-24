require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory (or root for simplicity)
app.use(express.static('.'));

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// API endpoint to generate the script
app.post('/generate', async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({ error: 'Topic is required' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
        You are a world-class scriptwriter for viral YouTube Shorts, known for creating addictive and highly engaging content.
        Your goal is to write a script for a 1-minute video about the topic: **"${topic}"**.

        **Instructions:**
        1.  **Hook (First 3 seconds):** Start with a provocative question, a surprising statement, or a visually arresting scene description that immediately grabs the viewer's attention.
        2.  **Build-Up (Next 20 seconds):** Introduce the core topic. Build tension or curiosity. Use simple language and quick cuts.
        3.  **Climax/Payoff (Next 20 seconds):** Reveal the most interesting fact, the solution to the problem, or the main point of the video. This should be the "Aha!" moment.
        4.  **Outro (Last 7 seconds):** End with a strong call to action (e.g., "Comment your thoughts below!", "Follow for more secrets like this!") and a memorable closing shot.

        **Output Format:**
        - Divide the script into scenes: `[SCENE 1]`, `[SCENE 2]`, etc.
        - For each scene, describe the **VISUAL** (what we see on screen, including text overlays) and the **AUDIO** (narration, sound effects, BGM suggestions).
        - The narration should be conversational and energetic.

        Now, write the script.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const script = await response.text();

        res.json({ script });

    } catch (error) {
        console.error('Error generating script:', error);
        res.status(500).json({ error: 'Failed to generate script' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
