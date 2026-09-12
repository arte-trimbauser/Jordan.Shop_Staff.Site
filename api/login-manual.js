// api/login-manual.js
const { parseBrowser, enviarLog, getCredencial } = require('./_db');

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const browser = parseBrowser(req.headers['user-agent'] || '');
    const { username, password } = req.body;
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
};
