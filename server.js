require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiService = require('./ai-service');
const axios = require('axios');

const whatsappTimers = {};

const app = express();
app.use(express.json());
app.use(cors()); // Allow frontend widget to access API

const PORT = process.env.PORT || 3000;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'arthas_token_123';

// ---------------------------
// 1. Web Widget Integration
// ---------------------------
app.post('/api/chat/web', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });
        
        const responseText = await aiService.generateResponse(message, sessionId || 'default-web');
        console.log(`[WEB WIDGET RESPONSE]: ${responseText}`);
        res.json({ reply: responseText });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ---------------------------
// 2. WhatsApp Business Graph API
// ---------------------------
// Verification Endpoint (Meta)
app.get('/webhook/whatsapp', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Receiving Messages from WhatsApp
app.post('/webhook/whatsapp', async (req, res) => {
    let body = req.body;

    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            let phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
            let from = body.entry[0].changes[0].value.messages[0].from; // sender number
            let msg_body = body.entry[0].changes[0].value.messages[0].text.body; // text message

            console.log(`Received message from ${from}: ${msg_body}`);

            // Clear existing idle timer for this user
            if (whatsappTimers[from]) clearTimeout(whatsappTimers[from]);

            // Pass to BOB Engine
            const replyText = await aiService.generateResponse(msg_body, from);

            // Disparo oficial da mensagem de volta pro WhatsApp pela Graph API da Meta
            const whatsappToken = process.env.WHATSAPP_API_TOKEN;
            if (whatsappToken) {
                try {
                    await axios({
                        method: 'POST',
                        url: `https://graph.facebook.com/v18.0/${phone_number_id}/messages`,
                        headers: {
                            'Authorization': `Bearer ${whatsappToken}`,
                            'Content-Type': 'application/json'
                        },
                        data: {
                            messaging_product: "whatsapp",
                            to: from,
                            text: { body: replyText }
                        }
                    });
                    console.log(`[WHATSAPP] Mensagem entregue com sucesso para ${from}!`);
                } catch (err) {
                    console.error("[ERRO WHATSAPP API]:", err.response ? JSON.stringify(err.response.data) : err.message);
                }
            } else {
                console.log(`[WHATSAPP SIMULADO para ${from}]: ${replyText}`);
                console.log(`⚠️ Aviso: Para disparar a mensagem na vida real, adicione a variável WHATSAPP_API_TOKEN no arquivo .env`);
            }

            // Set 2 min idle timer for WhatsApp
            whatsappTimers[from] = setTimeout(async () => {
                try {
                    const idleMsg = await aiService.generateResponse("INSTRUÇÃO OCULTA DO SISTEMA: O usuário sumiu por 2 minutos. Envie uma mensagem no seu tom padrão perguntando se ele ainda está aí. Provoque-o carismaticamente a não deixar o projeto morrer e convide a já falar com o Lucas para agilizar.", from);
                    if (whatsappToken) {
                        await axios({
                            method: 'POST',
                            url: `https://graph.facebook.com/v18.0/${phone_number_id}/messages`,
                            headers: { 'Authorization': `Bearer ${whatsappToken}`, 'Content-Type': 'application/json' },
                            data: { messaging_product: "whatsapp", to: from, text: { body: idleMsg } }
                        });
                        console.log(`[WHATSAPP TIMEOUT PING] Enviado para ${from}`);
                    } else {
                        console.log(`[WHATSAPP TIMEOUT PING SIMULADO para ${from}]: ${idleMsg}`);
                    }
                } catch (e) {
                    console.error("[WHATSAPP IDLE TIMER ERROR]", e);
                }
            }, 120000);
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Knowledge Base Data Endpoints (For Dashboard centralizing)
app.get('/api/kb', (req, res) => {
    const fs = require('fs');
    try {
        const data = fs.readFileSync('./db.json', 'utf-8');
        res.json(JSON.parse(data));
    } catch(e) {
        res.json([]);
    }
});

app.post('/api/kb', (req, res) => {
    const fs = require('fs');
    try {
        let current = [];
        if (fs.existsSync('./db.json')) {
            current = JSON.parse(fs.readFileSync('./db.json', 'utf-8') || '[]');
        }
        current.push({ ...req.body, timestamp: new Date().toISOString() });
        fs.writeFileSync('./db.json', JSON.stringify(current, null, 2));
        res.json({ success: true, count: current.length });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/kb/:index', (req, res) => {
    const fs = require('fs');
    try {
        let current = [];
        if (fs.existsSync('./db.json')) {
            current = JSON.parse(fs.readFileSync('./db.json', 'utf-8') || '[]');
        }
        current.splice(req.params.index, 1);
        fs.writeFileSync('./db.json', JSON.stringify(current, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎬 BOB Central Server running on port ${PORT}`);
    console.log(`- Web Widget Endpoint: POST http://localhost:${PORT}/api/chat/web`);
    console.log(`- WhatsApp Webhook Endpoint: POST http://localhost:${PORT}/webhook/whatsapp`);
});
