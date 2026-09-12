// api/enviar-dm.js
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    try {
        const r = await fetch(`${BOT_URL}/api/enviar-dm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await r.json();
        res.status(r.status).json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
