// api/verificar-codigo.js
const crypto = require('crypto');
const { parseBrowser, enviarLog, getCredencial } = require('./_db');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const browser = parseBrowser(req.headers['user-agent'] || '');
    const { username, codigo, token } = req.body || {};
    if (!username || !codigo || !token) return res.status(400).json({ error: 'Dados em falta' });

    const cred = await getCredencial(username);
    if (!cred) return res.status(404).json({ error: 'Utilizador não encontrado' });
    const chave = cred.username;

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
        await enviarLog('⌛ Código expirado', `**Utilizador:** \`${chave}\`\n**Browser:** \`${browser}\``, '#f39c12');
        return res.status(400).json({ error: 'O código expirou. Pede um novo.' });
    }

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(assinaturaEsperada, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await enviarLog('❌ Código inválido', `**Utilizador:** \`${chave}\`\n**Browser:** \`${browser}\``, '#cc0000');
        return res.status(400).json({ error: 'Código inválido' });
    }

    await enviarLog(
        '🔓 Código validado',
        `**Utilizador:** \`${chave}\`\n**Browser:** \`${browser}\`\n**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
        '#00aa00'
    );

    return res.json({ success: true, password: cred.password, username: chave });
};
