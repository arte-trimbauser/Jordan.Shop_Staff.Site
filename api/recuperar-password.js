// api/recuperar-password.js
const crypto = require('crypto');
const { parseBrowser, enviarLog, getCredencial } = require('./_db');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';
const WEBHOOK_FALLBACK = process.env.DISCORD_WEBHOOK_RECUPERACAO || '';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const browser = parseBrowser(req.headers['user-agent'] || '');
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username em falta' });

    const cred = await getCredencial(username);
    if (!cred) {
        await enviarLog(
            '❌ Tentativa de recuperação falhada',
            `**Username:** \`${username}\`\n**Motivo:** Utilizador não existe\n**Browser:** \`${browser}\``,
            '#cc0000'
        );
        return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const chave = cred.username;
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = Date.now() + 5 * 60 * 1000;

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const token = Buffer.from(`${expira}:${assinatura}`).toString('base64');

    // ===== 1. Tenta enviar DM via bot =====
    let dmEnviada = false;
    const discordId = cred.discord_id;
    const expiraUnix = Math.floor(expira / 1000);

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
                        `⏰ Válido durante 5 minutos (expira <t:${expiraUnix}:R>).\n\n` +
                        'Se não pediste isto, ignora esta mensagem e considera mudar a password.',
                    cor: '#8b0000',
                    campos: [
                        { name: '🌐 Browser', value: `\`${browser}\``, inline: true }
                    ]
                })
            });
            const data = await r.json();
            dmEnviada = !!data.success;
        } catch (err) {
            console.error('Erro DM:', err);
        }
    }

    // ===== 2. Fallback webhook =====
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
                        `⏰ Expira <t:${expiraUnix}:R>.\n` +
                        `🌐 Browser: \`${browser}\``
                })
            });
        } catch (err) {
            console.error('Erro webhook fallback:', err);
        }
    }

    if (!dmEnviada && !WEBHOOK_FALLBACK) {
        return res.status(500).json({ error: 'Não foi possível entregar o código' });
    }

    await enviarLog(
        '🔑 Pedido de recuperação',
        `**Utilizador:** \`${chave}\`\n` +
        `**Entrega:** ${dmEnviada ? '✅ DM enviada' : '⚠️ Fallback no canal'}\n` +
        `**Browser:** \`${browser}\``,
        '#f1c40f'
    );

    return res.json({ success: true, token, dm: dmEnviada });
};
