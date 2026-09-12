// api/login-manual.js
const WEBHOOK_LOGS = process.env.DISCORD_WEBHOOK_LOGS || '';

async function enviarLog(titulo, descricao, cor = '#8b0000') {
    if (!WEBHOOK_LOGS) return;
    try {
        await fetch(WEBHOOK_LOGS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: titulo,
                    description: descricao,
                    color: parseInt(cor.replace('#',''), 16),
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Jordan Shop • Logs' }
                }]
            })
        });
    } catch (err) {
        console.error('Erro enviarLog:', err);
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';
    const ua = req.headers['user-agent'] || 'desconhecido';

    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Campos em falta' });
    }

    const credenciais = {
        "Jordan Costa": "Jordan26Costa",
        "Arteex26": "Arteex_26",
        "lucasvieira0453": "lucasvieira",
        "migueldodrip_09110": "migueldodrip",
        "pincher11": "pincher11"
    };

    if (credenciais[username] === password) {
        const tokenSessao = Math.random().toString(36).substring(2);

        await enviarLog(
            '✅ Login Manual bem-sucedido',
            `**Utilizador:** \`${username}\`\n` +
            `**Método:** 🔑 Manual (user+pass)\n` +
            `**IP:** \`${ip}\`\n` +
            `**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
            '#00aa00'
        );

        return res.json({ success: true, user: username, token: tokenSessao });
    } else {
        await enviarLog(
            '❌ Tentativa de login manual falhada',
            `**Username tentado:** \`${username}\`\n` +
            `**IP:** \`${ip}\`\n` +
            `**User-Agent:** \`${ua.slice(0, 100)}\``,
            '#cc0000'
        );

        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }
};
