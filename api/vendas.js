// api/vendas.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
    try {
        const periodo = (req.query.periodo || 'semanal').toLowerCase();
        const numDias = periodo === 'mensal' ? 30 : 7;

        const hoje = new Date();
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - (numDias - 1));
        inicio.setHours(0, 0, 0, 0);

        const { data: vendas, error } = await supabase
            .from('vendas')
            .select('*')
            .gte('data', inicio.toISOString())
            .order('data', { ascending: true });

        if (error) {
            console.error('Erro ao buscar vendas:', error);
            return res.status(500).json({ error: error.message });
        }

        const dias = [];
        const valores = [];
        let totalPeriodo = 0;
        let countPeriodo = 0;

        for (let i = numDias - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const diaStr = d.toISOString().split('T')[0];
            dias.push(diaStr);

            const doDia = (vendas || []).filter(v => String(v.data || '').startsWith(diaStr));
            const total = doDia.reduce((acc, v) => acc + parseFloat(v.preco || 0), 0);
            valores.push(total);
            totalPeriodo += total;
            countPeriodo += doDia.length;
        }

        res.json({
            success: true,
            vendas: vendas || [],
            periodo,
            dias,
            valores,
            totalPeriodo,
            countPeriodo,
            totalHoje: valores[valores.length - 1] || 0,
            countHoje: (vendas || []).filter(v =>
                String(v.data || '').startsWith(hoje.toISOString().split('T')[0])
            ).length
        });
    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Erro interno' });
    }
};
