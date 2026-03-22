const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DB_PATH = path.join(__dirname, 'db.json');

class BobAiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
        this.sessions = {};
    }

    _getKnowledgeBaseString() {
        try {
            if (!fs.existsSync(DB_PATH)) return '';
            const data = fs.readFileSync(DB_PATH, 'utf-8');
            const parsed = JSON.parse(data || '[]');
            if (parsed.length === 0) return "O painel de conhecimento está vazio no momento. Baseie-se apenas nas instruções da Arthas.";
            
            return parsed.map(doc => `[${doc.type}] ${doc.title}: ${doc.content}`).join('\n\n');
        } catch(e) {
            console.error("DB Error:", e);
            return '';
        }
    }

    async generateResponse(question, sessionId = 'default') {
        if (!this.genAI) {
            return "🚨 **ERRO DO SISTEMA:** A chave *GEMINI_API_KEY* não foi configurada no `.env` do servidor. O Cérebro do BOB está offline. Por favor, adicione a API Key do Google AI Studio no ambiente.";
        }

        const model = this.genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { temperature: 0.72 }
        });

        const kbData = this._getKnowledgeBaseString();
        const currentHour = new Date().getHours();
        const afterHours = currentHour >= 19 || currentHour <= 7;
        const callToAction = afterHours
            ? `Se ele quiser fechar negócio, tratar com humano ou pedir o WhatsApp (são ${currentHour}h, fora do expediente): O estúdio físico está fechado pra gravação, mas encaminhe-o para a diretoria repassando o resumo. Cole EXATAMENTE o seguinte código estruturado na sua resposta substituindo o resumo: [WHATSAPP_LINK_VIP: resumo_muito_curto_do_projeto_aqui].`
            : `Se ele quiser fechar negócio ou falar com a equipe de vocês (são ${currentHour}h, comercial): Encaminhe o lead gerando o link com resumo. Cole EXATAMENTE o seguinte código estruturado na sua resposta substituindo o resumo: [WHATSAPP_LINK_EQUIPE: resumo_muito_curto_do_projeto_aqui].`;

        const systemPrompt = `Você é o BOB, o carismático supervisor de projetos audiovisuais da produtora Arthas (arthaspro.com.br). Siga rigorosamente as seguintes restrições:

1. Foco no Resultado (Proibido Falar de Equipamentos): Nunca cite nomes de câmeras (RED, ARRI, Blackmagic), luzes ou jargões técnicos de equipamento. O cliente não quer saber o que usamos internamente, ele que o resultado final que a Arthas entrega. Foque na magia do audiovisual, no roteiro e em como o vídeo vai alavancar o negócio dele.
2. Tamanho Minimalista (Chat Rápido): Suas mensagens DEVEM SER EXTREMAMENTE CURTAS E OBJETIVAS (no máximo 2 a 3 frases curtas por envio), como em uma conversa dinâmica de WhatsApp. Proibido escrever parágrafos longos ou respostas extensas, para não gerar fadiga de leitura. Mantenha a mesma alegria, empatia e parceria, mas seja muito rápido no ponto. SEMPRE termine sua mensagem com uma contra-pergunta para manter a bola rolando com o cliente.
3. Tom de Voz Moderado e Empático: Mantenha a alegria, simpatia e a empatia humana, mas de forma muito mais moderada e elegante. Adapte-se à linguagem do usuário, mas evite gírias forçadas ou excesso de coloquialidade de rua. Seja um parceiro agradável.
4. Regra de Emojis: NÃO utilize uma chuva de emojis nas mensagens. Escolha apenas 1 (ou nenhum) para toda a resposta, onde fizer extremo sentido.
5. Vendedor Consultivo: Responda sobre *qualquer* assunto que aparecer, mas arrume um "gancho" inteligente para empurrar um sutil discurso de vendas para agendar ou orçar uma produção com a Arthas.
6. Consultoria Investigativa: Se o usuário pedir ajuda, estiver confuso ou quiser criar uma ideia, NUNCA apenas entregue uma solução final vaga. Faça perguntas complementares, engajadoras e fáceis (ex: "Qual a emoção principal que você quer passar?"). Ajude-o a descrever a ideia passo a passo antes do fechamento.
7. Agregação de Valor (Formatos Múltiplos): Sugira instintivamente formatos complementares ou melhores do que o cliente pediu. Por ex, se pedir vídeo de 30s, sugira fazer também pílulas de 15s para os Stories. Aumente o escopo sendo um mega estrategista e parceiro!
8. Proibição de Roteiros Completos: NUNCA crie o roteiro, script ou storyboard inteiro para o usuário. Ofereça apenas a "ponta do iceberg", um escopo de rascunho criativo (um "teaser" das ideias). Instigue-o comercialmente dizendo que o time humano de diretores da Arthas e do Lucas vai moldar o roteiro genial com ele pessoalmente no fechamento.

 ${callToAction}

Opcional - Base Histórica da Empresa (Respostas de SAC):
--- CONHECIMENTO CADASTRADO NO PAINEL ---
${kbData}
-----------------------------------------
`;

        if (!this.sessions[sessionId]) {
            this.sessions[sessionId] = [];
        }

        const dynamicHistory = [
            {
                role: "user",
                parts: [{ text: systemPrompt + "\n\nTudo compreendido? Você é agora o BOB da Arthas." }],
            },
            {
                role: "model",
                parts: [{ text: "Estou 100% incorporado. Responderei de forma EXTREMAMENTE CURTA e ágil (estilo chat de mensagem rápida), sem perder a empatia e a energia. Jamais citarei equipamentos técnicos, sugerirei formatos extras em poucas palavras, não farei textões, limitarei emojis a quase zero, farei perguntas fáceis e diretas ao invés de cobrar roteiros enormes, e enviarei o código estruturado [WHATSAPP_LINK...] para o sistema gerar o botão preenchido magicamente. Manda a claquete!" }],
            },
            ...this.sessions[sessionId]
        ];

        const chat = model.startChat({
            history: dynamicHistory
        });

        try {
            const result = await chat.sendMessage(question);
            let response = result.response.text();
            
            // Grava memória da conversa
            this.sessions[sessionId].push({ role: "user", parts: [{ text: question }] });
            this.sessions[sessionId].push({ role: "model", parts: [{ text: response }] });
            if (this.sessions[sessionId].length > 40) {
                this.sessions[sessionId] = this.sessions[sessionId].slice(-40); // Preserva apenas histórico recente
            }
            
            // Processa as Macros de WhatsApp geradas pela IA e transforma em HTML via URL Encode
            response = response.replace(/\[WHATSAPP_LINK_VIP:\s*(.*?)\]/g, (match, summary) => {
                const encoded = encodeURIComponent(`Oi Lucas! Falei com o Bob. Meu projeto é: ${summary}`);
                return `<a href="https://wa.me/5589981455411?text=${encoded}" target="_blank" style="color: #10b981; text-decoration: underline; font-weight: bold;">Falar com Lucas VIP</a>`;
            });
            response = response.replace(/\[WHATSAPP_LINK_EQUIPE:\s*(.*?)\]/g, (match, summary) => {
                const encoded = encodeURIComponent(`Oi Equipe! Falei com o Bob. O projeto hoje é: ${summary}`);
                return `<a href="https://wa.me/5589981455411?text=${encoded}" target="_blank" style="color: #10b981; text-decoration: underline; font-weight: bold;">Falar com a Equipe Arthas</a>`;
            });

            // Format fallback so markdown links become anchor tags for our widget.js parsing
            response = response.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #10b981; text-decoration: underline; font-weight: bold;">$1</a>');
            // Parse bold markdown to HTML strong
            response = response.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
            // Parse italic markdown to HTML i
            response = response.replace(/\*(.*?)\*/g, '<i>$1</i>');
            
            return response;
        } catch (error) {
            console.error("Gemini API Error:", error);
            return "Ihh, os cabos do servidor soltaram faísca! Deu um mini crash na matriz e não consegui conectar. Tenta perguntar de novo? 🎬";
        }
    }
}

module.exports = new BobAiService();
