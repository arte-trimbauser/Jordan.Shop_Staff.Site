// api/recuperar-password.js
const crypto = require('crypto');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';
const WEBHOOK_FALLBACK = process.env.DISCORD_WEBHOOK_RECUPERACAO || '';
const WEBHOOK_LOGS = process.env.DISCORD_WEBHOOK_LOGS || '';

const credenciais = {
    "Jordan Costa": "Jordan26Costa",
    "Arteex26": "Arteex_26",
    "lucasvieira0453": "lucasvieira",
    "migueldodrip_09110": "migueldodrip",
    "pincher11": "pincher11"
};

const DISCORD_IDS = {
    "Jordan Costa":       "924344854232834068",
    "Arteex26":           "996454465555136675",
    "lucasvieira0453":    "1476260824669618307",
    "migueldodrip_09110": "1138795786507919410",
    "pincher11":          "886007990942052362"
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
    const ua = req.headers['user-agent'] || 'desconhecido';

    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username em falta' });

    const chave = Object.keys(credenciais).find(
        k => k.toLowerCase() === String(username).toLowerCase()
    );

    if (!chave) {
        await enviarLog(
            '❌ Tentativa de recuperação falhada',
            `**Username:** \`${username}\`\n**Motivo:** Utilizador não existe\n**IP:** \`${ip}\``,
            '#cc0000'
        );
        return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = Date.now() + 5 * 60 * 1000;

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const token = Buffer.from(`${expira}:${assinatura}`).toString('base64');

    // ===== 1. Tenta enviar DM via bot =====
    let dmEnviada = false;
    const discordId = DISCORD_IDS[chave];
    if (discordId) {
        try {
            const r = await fetch(`${BOT_URL}/api/enviar-dm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: discordId,
                    titulo: '🔐 Recuperação de Password',
                    descricao:
                        `**Utilizador:** \`${chave}\`\n\n` +
                        `**Código:** \`${codigo}\`\n\n` +
                        '⏰ Válido durante **5 minutos**.\n\n' +
                        'Se não pediste isto, ignora esta mensagem e considera mudar a password.',
                    cor: '#8b0000',
                    campos: [
                        { name: '🌐 IP', value: `\`${ip}\``, inline: true }
                    ]
                })
            });
            const data = await r.json();
            dmEnviada = !!data.success;
        } catch (err) {
            console.error('Erro DM:', err);
        }
    }

    // ===== 2. Fallback: webhook do canal privado =====
    if (!dmEnviada && WEBHOOK_FALLBACK) {
        try {
            await fetch(WEBHOOK_FALLBACK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content:
                        '⚠️ **DM falhou — código enviado aqui como fallback**\n\n' +
                        `**Utilizador:** \`${chave}\`\n` +
                        `**Código:** \`${codigo}\`\n` +
                        '⏰ Válido durante **5 minutos**.'
                })
            });
        } catch (err) {
            console.error('Erro webhook fallback:', err);
        }
    }

    if (!dmEnviada && !WEBHOOK_FALLBACK) {
        return res.status(500).json({ error: 'Não foi possível entregar o código (sem DM nem fallback)' });
    }

    // ===== 3. Log =====
    await enviarLog(
        '🔑 Pedido de recuperação de password',
        `**Utilizador:** \`${chave}\`\n` +
        `**Entrega:** ${dmEnviada ? '✅ DM enviada' : '⚠️ Fallback no canal'}\n` +
        `**IP:** \`${ip}\``,
        '#f1c40f'
    );

    return res.json({ success: true, token, dm: dmEnviada });
};
