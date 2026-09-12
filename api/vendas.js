// api/vendas.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
    try {
        // ============================================================
        // POST — Registar nova venda
        // ============================================================
        if (req.method === 'POST') {
            const { comprador, data, produto, preco, duracao, staff, registradoPor, timestamp } = req.body || {};

            if (!comprador || !produto) {
                return res.status(400).json({ success: false, error: 'Comprador e produto obrigatórios' });
            }

            const { data: inserida, error } = await supabase
                .from('vendas')
                .insert([{
                    comprador,
                    data: data || new Date().toISOString().split('T')[0],
                    produto,
                    preco: preco || 'N/A',
                    duracao: duracao || 'N/A',
                    staff: staff || 'N/A',
                    registrado_por: registradoPor || 'Staff',
                    timestamp: timestamp || new Date().toISOString()
                }])
                .select()
                .single();

            if (error) {
                console.error('Erro ao inserir venda:', error);
                return res.status(500).json({ success: false, error: error.message });
            }
            return res.json({ success: true, venda: inserida });
        }

        // ============================================================
        // GET — Lista todas as vendas + dados para o gráfico
        // ============================================================
        const { data: todasVendas, error } = await supabase
            .from('vendas')
            .select('*')
            .order('data', { ascending: false })
            .limit(500);

        if (error) {
            console.error('Erro ao buscar vendas:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        // ===== Dados para o gráfico (30 dias) =====
        const periodo = (req.query.periodo || 'mensal').toLowerCase();
        const numDias = periodo === 'semanal' ? 7 : 30;

        const hoje = new Date();
        const inicio = new Date();
        inicio.setDate(hoje.getDate() - (numDias - 1));
        inicio.setHours(0, 0, 0, 0);

        const recentes = (todasVendas || []).filter(v => {
            try { return new Date(v.data) >= inicio; } catch { return false; }
        });

        const dias = [];
        const valores = [];
        let totalPeriodo = 0;
        let countPeriodo = 0;

        for (let i = numDias - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const diaStr = d.toISOString().split('T')[0];
            dias.push(diaStr);

            const doDia = recentes.filter(v => String(v.data || '').startsWith(diaStr));
            const total = doDia.reduce((acc, v) => {
                const n = parseFloat(String(v.preco || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
                return acc + (isNaN(n) ? 0 : n);
            }, 0);

            valores.push(total);
            totalPeriodo += total;
            countPeriodo += doDia.length;
        }

        const hojeStr = hoje.toISOString().split('T')[0];
        const doDiaHoje = recentes.filter(v => String(v.data || '').startsWith(hojeStr));
        const totalHoje = doDiaHoje.reduce((acc, v) => {
            const n = parseFloat(String(v.preco || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
            return acc + (isNaN(n) ? 0 : n);
        }, 0);

        return res.json({
            success: true,
            vendas: todasVendas || [],
            periodo,
            dias,
            valores,
            totalPeriodo,
            countPeriodo,
            totalHoje,
            countHoje: doDiaHoje.length
        });

    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ success: false, error: 'Erro interno' });
    }
};
