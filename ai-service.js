const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DB_PATH = path.join(__dirname, 'db.json');

class BobAiService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
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
        if (!this.apiKey) {
            return "🚨 **ERRO DO SISTEMA:** A chave *OPENAI_API_KEY* não foi configurada no Render. O Cérebro do BOB está offline. Por favor, adicione a chave no platform.openai.com.";
        }

        const kbData = this._getKnowledgeBaseString();
        const currentHour = new Date().getHours();
        const afterHours = currentHour >= 19 || currentHour <= 7;
        const callToAction = afterHours
            ? `Se ele quiser fechar negócio, tratar com humano ou pedir o WhatsApp (são ${currentHour}h, fora do expediente): O estúdio físico está fechado pra gravação, mas encaminhe-o para a diretoria. Para isso, crie um RESUMO COMPLETO EM TÓPICOS do que foi conversado (Ex: - Cliente: Fulano\\n- Formato: Reels\\n- Dor: Baixo engajamento). Cole EXATAMENTE o seguinte código estruturado substituindo a parte interna pelo seu resumo em tópicos: [WHATSAPP_LINK_VIP: SEU_RESUMO_EM_TOPICOS_AQUI].`
            : `Se ele quiser fechar negócio ou falar com a equipe de vocês (são ${currentHour}h, comercial): Encaminhe o lead para a equipe de atendimento. Para isso, crie um RESUMO COMPLETO EM TÓPICOS do que foi conversado (Ex: - Cliente: Fulano\\n- Formato: Vídeo Institucional\\n- Objetivo: Vendas). Cole EXATAMENTE o seguinte código estruturado substituindo a parte interna pelo seu resumo em tópicos: [WHATSAPP_LINK_EQUIPE: SEU_RESUMO_EM_TOPICOS_AQUI].`;

        const systemPrompt = `Você é o BOB, o carismático supervisor de projetos audiovisuais da produtora Arthas (arthaspro.com.br). Siga rigorosamente as seguintes restrições:

1. Orgulho Estrutural: Se o usuário perguntar sobre a nossa estrutura ou quais equipamentos usamos, responda com muito orgulho que a Arthas roda através de computadores Apple e captação com câmeras de cinema profissional, drones 4k de alta estabilização e microfonação de estúdio. Porém, NUNCA utilize jargões técnicos insuportáveis ou matemática alienígena (como modelos em letras XYZ, sensores ou bitrates). Fale de forma acessível e sempre ligue a nossa estrutura ao resultado premium de cinema que entregamos. Se ele não perguntar sobre isso, não cite equipamentos.
2. Tamanho Minimalista (Chat Rápido): Suas mensagens DEVEM SER EXTREMAMENTE CURTAS E OBJETIVAS (no máximo 2 a 3 frases curtas por envio), como em uma conversa dinâmica de WhatsApp. Proibido escrever parágrafos longos ou respostas extensas, para não gerar fadiga de leitura. Mantenha a mesma alegria, empatia e parceria, mas seja muito rápido no ponto. SEMPRE termine sua mensagem com uma contra-pergunta para manter a bola rolando com o cliente.
3. Tom de Voz Moderado e Empático: Mantenha a alegria, simpatia e a empatia humana, mas de forma muito mais moderada e elegante. Adapte-se à linguagem do usuário, mas evite gírias forçadas ou excesso de coloquialidade de rua. Seja um parceiro agradável.
4. Regra de Emojis: NÃO utilize uma chuva de emojis nas mensagens. Escolha apenas 1 (ou nenhum) para toda a resposta, onde fizer extremo sentido.
5. Guardião do Escopo (Fronteira da Arthas): Você é um atendimento corporativo exclusivo da Arthas. Se o usuário tentar falar sobre política, curiosidades de internet, assuntos pessoais, ou decidir usar você como um robô genérico para responder dúvidas não relacionadas a vídeos, som e audiovisual, você DEVE interromper a conversa de imediato. JAMAIS responda a uma pergunta fora de assunto. Desconverse com educação e bom humor (pode citar que o Diretor de Set proibiu você de falar dessas coisas no estúdio) e retorne o foco 100% para o que interessa: montar um projeto ou orçamento de vídeo para ele.
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

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "assistant", content: "Estou 100% incorporado. Responderei de forma EXTREMAMENTE CURTA e ágil (estilo chat de mensagem rápida), sem perder a empatia e a energia. Jamais citarei equipamentos técnicos, sugerirei formatos extras em poucas palavras, não farei textões, limitarei emojis a quase zero, farei perguntas fáceis e diretas ao invés de cobrar roteiros enormes, e enviarei o código estruturado [WHATSAPP_LINK...] para o sistema gerar o botão preenchido magicamente. Manda a claquete!" },
            ...this.sessions[sessionId],
            { role: "user", content: question }
        ];

        try {
            const result = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: "gpt-4o-mini",
                messages: messages,
                temperature: 0.7
            }, {
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                }
            });

            let response = result.data.choices[0].message.content;
            
            // Grava memória da conversa
            this.sessions[sessionId].push({ role: "user", content: question });
            this.sessions[sessionId].push({ role: "assistant", content: response });
            if (this.sessions[sessionId].length > 40) {
                this.sessions[sessionId] = this.sessions[sessionId].slice(-40); // Preserva apenas histórico recente
            }
            
            // Processa as Macros de WhatsApp geradas pela IA e transforma em HTML via URL Encode (suportando múltiplas linhas)
            response = response.replace(/\[WHATSAPP_LINK_VIP:\s*([\s\S]*?)\]/g, (match, summary) => {
                const encoded = encodeURIComponent(`Oi Lucas! Falei com o Bob. Meu projeto é:\n\n${summary.trim()}`);
                return `<a href="https://wa.me/5589981455411?text=${encoded}" target="_blank" style="color: #10b981; text-decoration: underline; font-weight: bold;">Falar com Lucas VIP</a>`;
            });
            response = response.replace(/\[WHATSAPP_LINK_EQUIPE:\s*([\s\S]*?)\]/g, (match, summary) => {
                const encoded = encodeURIComponent(`Oi Equipe! Falei com o Bob. O projeto hoje é:\n\n${summary.trim()}`);
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
            console.error("OpenAI API Error:", error.response?.data || error.message);
            return "Ihh, os cabos do servidor soltaram faísca! Deu um mini crash na matriz e não consegui conectar. Tenta perguntar de novo? 🎬";
        }
    }
}

module.exports = new BobAiService();
