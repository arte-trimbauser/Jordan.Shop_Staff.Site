// api/tickets.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

module.exports = async (req, res) => {
    try {
        // GET — lista de tickets
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('tickets')
                .select('*')
                .order('criado_em', { ascending: false })
                .limit(100);

            if (error) throw error;

            const lista = data || [];
            const abertos   = lista.filter(t => t.status === 'aberto');
            const assumidos = lista.filter(t => t.status === 'assumido');
            const fechados  = lista.filter(t => t.status === 'fechado').slice(0, 50);

            return res.json({
                success: true,
                tickets: lista,
                abertos,
                assumidos,
                fechados,
                stats: {
                    total: lista.length,
                    abertos: abertos.length,
                    assumidos: assumidos.length,
                    fechados: fechados.length
                }
            });
        }

        // POST — criar / assumir / fechar (usado pelo bot)
        if (req.method === 'POST') {
            const body = req.body || {};
            const { acao, canal_id } = body;

            if (!canal_id) return res.status(400).json({ success: false, error: 'canal_id em falta' });

            if (acao === 'criar') {
                const { error } = await supabase.from('tickets').upsert([{
                    canal_id,
                    canal_nome: body.canal_nome || '',
                    cliente_id: body.cliente_id || '',
                    cliente_nome: body.cliente_nome || '',
                    produto: body.produto || '',
                    metodo: body.metodo || '',
                    status: 'aberto'
                }], { onConflict: 'canal_id' });
                if (error) throw error;
                return res.json({ success: true });
            }

            if (acao === 'assumir') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        status: 'assumido',
                        assumido_por: body.staff || 'Desconhecido',
                        assumido_em: new Date().toISOString()
                    })
                    .eq('canal_id', canal_id);
                if (error) throw error;
                return res.json({ success: true });
            }

            if (acao === 'fechar') {
                const { error } = await supabase
                    .from('tickets')
                    .update({
                        status: 'fechado',
                        fechado_por: body.staff || 'Desconhecido',
                        fechado_em: new Date().toISOString()
                    })
                    .eq('canal_id', canal_id);
                if (error) throw error;
                return res.json({ success: true });
            }

            return res.status(400).json({ success: false, error: 'ação inválida' });
        }

        return res.status(405).json({ success: false, error: 'Método não permitido' });
    } catch (err) {
        console.error('Erro /api/tickets:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
