// api/_db.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ====== Parser de User-Agent → "Chrome · Windows 10/11" ======
function parseBrowser(ua = '') {
    ua = String(ua);
    if (!ua) return 'Desconhecido';

    let os = 'Desconhecido';
    if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT/.test(ua)) os = 'Windows';
    else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Android/.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
    else if (/Linux/.test(ua)) os = 'Linux';

    let browser = 'Desconhecido';
    if (/Edg\//.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
    else if (/SamsungBrowser/.test(ua)) browser = 'Samsung Internet';
    else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = 'Chrome';
    else if (/Firefox\//.test(ua)) browser = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

    return `${browser} · ${os}`;
}

// ====== Log para webhook ======
async function enviarLog(titulo, descricao, cor = '#8b0000') {
    const url = process.env.DISCORD_WEBHOOK_LOGS;
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: titulo,
                    description: descricao,
                    color: parseInt(cor.replace('#', ''), 16),
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Jordan Shop • Logs' }
                }]
            })
        });
    } catch (err) {
        console.error('Erro enviarLog:', err);
    }
}

// ====== Credenciais (Supabase + fallback hardcoded) ======
const FALLBACK_CREDS = {
    "Jordan Costa": { password: "Jordan26Costa", discord_id: "924344854232834068" },
    "Arteex26": { password: "Arteex_26", discord_id: "996454465555136675" },
    "lucasvieira0453": { password: "lucasvieira", discord_id: "1476260824669618307" },
    "migueldodrip_09110": { password: "migueldodrip", discord_id: "1138795786507919410" },
    "pincher11": { password: "pincher11", discord_id: "886007990942052362" }
};

async function getCredencial(username) {
    try {
        const { data, error } = await supabase
            .from('credenciais')
            .select('*');
        if (error) throw error;

        const chave = (data || []).find(c =>
            c.username.toLowerCase() === String(username).toLowerCase()
        );
        if (chave) return chave;
    } catch (err) {
        console.error('Supabase erro, a usar fallback:', err.message);
    }

    // Fallback
    const chave = Object.keys(FALLBACK_CREDS).find(
        k => k.toLowerCase() === String(username).toLowerCase()
    );
    if (!chave) return null;
    return { username: chave, ...FALLBACK_CREDS[chave] };
}

async function alterarPassword(username, nova) {
    const { error } = await supabase
        .from('credenciais')
        .update({ password: nova, atualizado_em: new Date().toISOString() })
        .eq('username', username);
    if (error) throw error;
}

module.exports = { supabase, parseBrowser, enviarLog, getCredencial, alterarPassword };
