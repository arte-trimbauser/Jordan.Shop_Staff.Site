// api/alterar-password.js
const crypto = require('crypto');
const { parseBrowser, enviarLog, getCredencial, alterarPassword } = require('./_db');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const browser = parseBrowser(req.headers['user-agent'] || '');
    const { username, codigo, token, nova_password } = req.body || {};

    if (!username || !codigo || !token || !nova_password) {
        return res.status(400).json({ error: 'Dados em falta' });
    }
    if (nova_password.length < 4 || nova_password.length > 64) {
        return res.status(400).json({ error: 'Password deve ter entre 4 e 64 caracteres' });
    }

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
    if (Date.now() > expira) return res.status(400).json({ error: 'A sessão expirou. Pede um novo código.' });

    // Revalida o código (para garantir que é quem diz ser)
    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(assinaturaEsperada, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await enviarLog('❌ Tentativa de alteração com código inválido', `**Utilizador:** \`${chave}\`\n**Browser:** \`${browser}\``, '#cc0000');
        return res.status(400).json({ error: 'Código inválido' });
    }

    // Altera
    try {
        await alterarPassword(chave, nova_password);
    } catch (err) {
        console.error('Erro ao alterar password:', err);
        return res.status(500).json({ error: 'Erro ao guardar a nova password' });
    }

    await enviarLog(
        '🔐 Password ALTERADA',
        `**Utilizador:** \`${chave}\`\n` +
        `**Nova password:** \`${nova_password}\`\n` +
        `**Browser:** \`${browser}\`\n` +
        `**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
        '#e67e22'
    );

    // Avisa por DM
    if (cred.discord_id) {
        try {
            await fetch(`${BOT_URL}/api/enviar-dm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: cred.discord_id,
                    titulo: '✅ Password alterada',
                    descricao:
                        `A password da conta **\`${chave}\`** foi alterada com sucesso.\n\n` +
                        `**Nova password:** \`${nova_password}\`\n` +
                        `**Browser:** \`${browser}\`\n\n` +
                        'Se não foste tu, contacta um admin imediatamente.',
                    cor: '#e67e22'
                })
            });
        } catch (err) {
            console.error('Erro DM alteração:', err);
        }
    }

    return res.json({ success: true });
};
