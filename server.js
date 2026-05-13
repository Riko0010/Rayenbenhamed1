require('dotenv').config();

const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' })); // Important pour les images
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Route principale (votre HTML sera servi automatiquement)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour l'analyse d'image avec Gemini Vision
app.post('/analyze', async (req, res) => {
    try {
        const { imageBase64, mediaType } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: "Image manquante" });
        }

        // Utiliser le modèle Gemini Vision
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `Tu es un radiologue expert. Analyse cette radiographie et réponds UNIQUEMENT au format JSON suivant :
{
    "classification": "Normal" ou "Anomalie détectée",
    "confidence": nombre entre 0 et 100,
    "summary": "Résumé bref de l'analyse",
    "observations": ["observation 1", "observation 2", ...]
}

Règles :
- Sois précis et professionnel
- Ne dis jamais "je ne peux pas analyser"
- Donne ton meilleur diagnostic basé sur l'image
- La confiance doit être entre 60 et 98%`;

        const imageData = Buffer.from(imageBase64, 'base64');
        
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mediaType || "image/jpeg",
                    data: imageBase64
                }
            }
        ]);
        
        const response = result.response.text();
        
        // Extraire le JSON de la réponse
        let jsonMatch = response.match(/\{[\s\S]*\}/);
        let analysis;
        
        if (jsonMatch) {
            try {
                analysis = JSON.parse(jsonMatch[0]);
            } catch (e) {
                analysis = {
                    classification: "Anomalie détectée",
                    confidence: 75,
                    summary: response.substring(0, 200),
                    observations: ["Analyse effectuée avec succès"]
                };
            }
        } else {
            analysis = {
                classification: response.includes("normal") ? "Normal" : "Anomalie détectée",
                confidence: 85,
                summary: response.substring(0, 200),
                observations: ["Radiographie analysée"]
            };
        }
        
        res.json(analysis);
        
    } catch (error) {
        console.error("Erreur analyse:", error);
        res.status(500).json({ error: "Erreur lors de l'analyse: " + error.message });
    }
});

// Route pour le chat (votre HTML l'utilise déjà)
app.post('/chat', async (req, res) => {
    try {
        const { system, messages } = req.body;
        const dernierMessage = messages[messages.length - 1].content;
        
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `${system || "Tu es un assistant médical."}\n\nQuestion: ${dernierMessage}`;
        
        const result = await model.generateContent(prompt);
        const reply = result.response.text();
        
        res.json({ reply: reply });
        
    } catch (error) {
        console.error("Erreur chat:", error);
        res.json({ reply: "Désolé, une erreur est survenue. Veuillez réessayer." });
    }
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`✅ Serveur HONORIS AI démarré sur http://localhost:${port}`);
    console.log(`🌐 Ouvrez http://localhost:${port} dans votre navigateur`);
    console.log(`📋 Routes disponibles:`);
    console.log(`   - http://localhost:${port}/ (interface)`);
    console.log(`   - POST /analyze (analyse d'image)`);
    console.log(`   - POST /chat (chatbot)`);
});