// api/callback.js
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
    const { code } = req.query;
    if (!code) return res.redirect('/login.html?error=no_code');

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'desconhecido';

    try {
        const params = new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'https://jordan-shop-bot-site.vercel.app/api/callback'
        });

        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!tokenRes.ok) return res.redirect('/login.html?error=auth_failed');

        const tokenData = await tokenRes.json();
        const userRes = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        if (!userRes.ok) return res.redirect('/login.html?error=auth_failed');

        const userData = await userRes.json();

        // ===== Buscar o nickname na guild =====
        const GUILD_ID = '1393629457599828040';
        let displayName = userData.global_name || userData.username;

        try {
            const memberRes = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            if (memberRes.ok) {
                const memberData = await memberRes.json();
                if (memberData.nick) displayName = memberData.nick;
            }
        } catch (err) {
            console.warn('⚠️ Erro ao buscar nickname:', err.message);
        }

        const staffAutorizado = {
            "924344854232834068": "Jordan Costa",
            "996454465555136675": "Arteex26",
            "1476260824669618307": "lucasvieira",
            "1138795786507919410": "migueldodrip",
            "886007990942052362": "pincher11"
        };

        if (!staffAutorizado[userData.id]) {
            await enviarLog(
                '🚫 Tentativa de login Discord (não autorizado)',
                `**User:** ${userData.username} (\`${userData.id}\`)\n**IP:** \`${ip}\``,
                '#cc0000'
            );
            return res.redirect('/login.html?error=nao_autorizado');
        }

        const tokenSessao = Math.random().toString(36).substring(2);

        await enviarLog(
            '✅ Login Discord bem-sucedido',
            `**Staff:** <@${userData.id}> (${staffAutorizado[userData.id]})\n` +
            `**Discord:** \`${userData.username}\`\n` +
            `**Nickname:** \`${displayName}\`\n` +
            `**Método:** 🎮 Discord OAuth\n` +
            `**IP:** \`${ip}\`\n` +
            `**Hora:** <t:${Math.floor(Date.now()/1000)}:F>`,
            '#00aa00'
        );

        return res.redirect(`/loja.html?user=${encodeURIComponent(displayName)}&token=${tokenSessao}`);
    } catch (error) {
        console.error('Callback error:', error);
        return res.redirect('/login.html?error=auth_failed');
    }
};
