// api/verificar-codigo.js
const crypto = require('crypto');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';
const WEBHOOK_LOGS = process.env.DISCORD_WEBHOOK_LOGS || '';

const credenciais = {
    "Jordan Costa": "Jordan26Costa",
    "Arteex26": "Arteex_26",
    "lucasvieira0453": "lucasvieira",
    "migueldodrip_09110": "migueldodrip",
    "pincher11": "pincher11"
};

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

    const { username, codigo, token } = req.body || {};
    if (!username || !codigo || !token) return res.status(400).json({ error: 'Dados em falta' });

    const chave = Object.keys(credenciais).find(
        k => k.toLowerCase() === String(username).toLowerCase()
    );
    if (!chave) return res.status(404).json({ error: 'Utilizador não encontrado' });

    let expira, assinaturaEsperada;
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        [expira, assinaturaEsperada] = decoded.split(':');
        expira = parseInt(expira, 10);
    } catch {
        return res.status(400).json({ error: 'Token inválido' });
    }

    if (!expira || !assinaturaEsperada) return res.status(400).json({ error: 'Token inválido' });

    if (Date.now() > expira) {
        await enviarLog(
            '⌛ Código expirado',
            `**Utilizador:** \`${chave}\`\n**IP:** \`${ip}\``,
            '#f39c12'
        );
        return res.status(400).json({ error: 'O código expirou. Pede um novo.' });
    }

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(assinaturaEsperada, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await enviarLog(
            '❌ Código de recuperação inválido',
            `**Utilizador:** \`${chave}\`\n**Código tentado:** \`${codigo}\`\n**IP:** \`${ip}\``,
            '#cc0000'
        );
        return res.status(400).json({ error: 'Código inválido' });
    }

    // ===== SUCESSO =====
    await enviarLog(
        '🔓 Password recuperada com sucesso',
        `**Utilizador:** \`${chave}\`\n**IP:** \`${ip}\`\n**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
        '#00aa00'
    );

    return res.json({ success: true, password: credenciais[chave] });
};
