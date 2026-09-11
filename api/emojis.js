// api/emojis.js
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';

let cache = { data: null, ts: 0 };
const TTL = 10 * 60 * 1000;

module.exports = async (req, res) => {
    if (cache.data && Date.now() - cache.ts < TTL) return res.json(cache.data);
    try {
        const r = await fetch(`${BOT_URL}/api/emojis`);
        const data = await r.json();
        if (data.success) cache = { data, ts: Date.now() };
        res.status(r.status).json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
