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
        You are an expert in creating viral YouTube Shorts scripts.
        Create a concise and engaging 1-minute script for the following topic:

        **Topic:** ${topic}

        The script should have three parts:
        1.  **Intro (Hook):** Grab the viewer's attention within the first 3 seconds.
        2.  **Body:** Provide 2-3 interesting and easy-to-understand facts or points.
        3.  **Outro (Call to Action):** Encourage viewers to like, comment, and subscribe.

        Format the output clearly with headings for each part (e.g., #Intro, #Body, #Outro) and include suggestions for visuals or on-screen text.
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
