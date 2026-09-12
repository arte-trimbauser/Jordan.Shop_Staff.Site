// api/auth.js — Router único para todos os endpoints de autenticação.
// Endpoints:
//   POST /api/auth?action=login-manual
//   POST /api/auth?action=recuperar-password
//   POST /api/auth?action=verificar-codigo
//   POST /api/auth?action=alterar-password

const crypto = require('crypto');
const { parseBrowser, enviarLog, getCredencial, alterarPassword } = require('./_db');

const SECRET = process.env.RESET_SECRET || 'jordan-shop-secret-muda-isto';
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';
const WEBHOOK_FALLBACK = process.env.DISCORD_WEBHOOK_RECUPERACAO || '';

module.exports = async (req, res) => {
    const { action } = req.query || {};
    switch (action) {
        case 'login-manual':       return handleLoginManual(req, res);
        case 'recuperar-password': return handleRecuperarPassword(req, res);
        case 'verificar-codigo':   return handleVerificarCodigo(req, res);
        case 'alterar-password':   return handleAlterarPassword(req, res);
        default:
            return res.status(400).json({
                error: 'Ação inválida',
                acoes_validas: ['login-manual', 'recuperar-password', 'verificar-codigo', 'alterar-password']
            });
    }
};

// ============= LOGIN MANUAL =============
async function handleLoginManual(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const browser = parseBrowser(req.headers['user-agent'] || '');
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Campos em falta' });
    }

    const cred = await getCredencial(username);
    if (cred && cred.password === password) {
        const tokenSessao = Math.random().toString(36).substring(2);

        await enviarLog(
            '✅ Login Manual bem-sucedido',
            `**Utilizador:** \`${cred.username}\`\n` +
            `**Método:** 🔑 Manual\n` +
            `**Browser:** \`${browser}\`\n` +
            `**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
            '#00aa00'
        );

        return res.json({ success: true, user: cred.username, token: tokenSessao });
    }

    await enviarLog(
        '❌ Tentativa de login manual falhada',
        `**Username tentado:** \`${username}\`\n**Browser:** \`${browser}\``,
        '#cc0000'
    );

    return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
}

// ============= RECUPERAR PASSWORD =============
async function handleRecuperarPassword(req, res) {
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
                    campos: [{ name: '🌐 Browser', value: `\`${browser}\``, inline: true }]
                })
            });
            const data = await r.json();
            dmEnviada = !!data.success;
        } catch (err) {
            console.error('Erro DM:', err);
        }
    }

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
}

// ============= VERIFICAR CÓDIGO =============
async function handleVerificarCodigo(req, res) {
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
}

// ============= ALTERAR PASSWORD =============
async function handleAlterarPassword(req, res) {
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

    const payload = `${chave}:${codigo}:${expira}`;
    const assinatura = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const a = Buffer.from(assinatura, 'hex');
    const b = Buffer.from(assinaturaEsperada, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await enviarLog('❌ Tentativa de alteração com código inválido', `**Utilizador:** \`${chave}\`\n**Browser:** \`${browser}\``, '#cc0000');
        return res.status(400).json({ error: 'Código inválido' });
    }

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
}
