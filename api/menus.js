// api/menus.js
const BOT_URL = process.env.BOT_API_URL || 'https://jordan-shop.onrender.com';

module.exports = async (req, res) => {
    try {
        const r = await fetch(`${BOT_URL}/api/menus`, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
        });
        const data = await r.json();
        res.status(r.status).json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
