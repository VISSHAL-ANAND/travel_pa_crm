function createCustomerActivityService({ app, supabase, requireAuth, buildLeadObject }) {
    async function recordCustomerActivity(clientId, agentId, eventType, eventLabel, metadata = {}) {
        if (!supabase || !clientId || !eventType || !eventLabel) return null;
        try {
            const { data, error } = await supabase.from('customer_activity').insert({
                client_id: clientId,
                agent_id: agentId || null,
                event_type: eventType,
                event_label: eventLabel,
                metadata: metadata && typeof metadata === 'object' ? metadata : {}
            }).select().single();
            if (error) {
                console.warn('⚠️ Customer activity write skipped:', error.message);
                return null;
            }
            return data;
        } catch (err) {
            console.warn('⚠️ Customer activity write skipped:', err.message);
            return null;
        }
    }

    app.get('/api/agent/customers', requireAuth('agent'), async (req, res) => {
        if (!supabase) return res.status(500).json({ success:false, message:'Database not configured.' });
        try {
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '50', 10) || 50, 1), 100);
            const offset = Math.max(Number.parseInt(req.query.offset || '0', 10) || 0, 0);

            let query = supabase.from('clients').select('*', { count:'exact' })
                .eq('agent_id', req.agentId)
                .order('created_at', { ascending:false })
                .range(offset, offset + limit - 1);

            if (status) query = query.eq('status', status);
            if (search) {
                const safe = search.replace(/[,()]/g, ' ').trim();
                if (safe) query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,destination.ilike.%${safe}%`);
            }

            const { data, error, count } = await query;
            if (error) throw error;
            res.json({ success:true, data:(data || []).map(buildLeadObject), pagination:{ total:count || 0, limit, offset } });
        } catch (err) {
            console.error('❌ Error fetching agent customers:', err.message);
            res.status(500).json({ success:false, message:'Failed to fetch customers.' });
        }
    });

    app.get('/api/admin/customers', requireAuth('admin'), async (req, res) => {
        if (!supabase) return res.status(500).json({ success:false, message:'Database not configured.' });
        try {
            const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
            const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
            const agentId = typeof req.query.agent_id === 'string' ? req.query.agent_id.trim() : '';
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '100', 10) || 100, 1), 200);
            const offset = Math.max(Number.parseInt(req.query.offset || '0', 10) || 0, 0);

            let query = supabase.from('clients').select('*', { count:'exact' })
                .order('created_at', { ascending:false })
                .range(offset, offset + limit - 1);

            if (status) query = query.eq('status', status);
            if (agentId) query = query.eq('agent_id', agentId);
            if (search) {
                const safe = search.replace(/[,()]/g, ' ').trim();
                if (safe) query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%,destination.ilike.%${safe}%`);
            }

            const { data, error, count } = await query;
            if (error) throw error;
            res.json({ success:true, data:(data || []).map(buildLeadObject), pagination:{ total:count || 0, limit, offset } });
        } catch (err) {
            console.error('❌ Error fetching admin customers:', err.message);
            res.status(500).json({ success:false, message:'Failed to fetch customers.' });
        }
    });

    async function getCustomerDetail(req, res, role) {
        if (!supabase) return res.status(500).json({ success:false, message:'Database not configured.' });
        try {
            let query = supabase.from('clients').select('*').eq('id', req.params.id);
            if (role === 'agent') query = query.eq('agent_id', req.agentId);
            const { data: customer, error: customerError } = await query.single();
            if (customerError || !customer) return res.status(404).json({ success:false, message:'Customer not found.' });

            const [{ data: feedback, error: feedbackError }, { data: activity, error: activityError }, { data: agent, error: agentError }] = await Promise.all([
                supabase.from('feedback').select('*').eq('client_id', customer.id).order('created_at', { ascending:false }),
                supabase.from('customer_activity').select('*').eq('client_id', customer.id).order('created_at', { ascending:false }),
                customer.agent_id
                    ? supabase.from('agents').select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline').eq('id', customer.agent_id).single()
                    : Promise.resolve({ data:null, error:null })
            ]);
            if (feedbackError) throw feedbackError;
            if (activityError) throw activityError;
            if (agentError) throw agentError;

            if (role === 'agent') {
                await recordCustomerActivity(customer.id, req.agentId, 'agent_opened', 'Customer workspace opened');
            }

            res.json({ success:true, data:{
                customer:buildLeadObject(customer),
                agent:agent || null,
                feedback:feedback || [],
                activity:activity || []
            }});
        } catch (err) {
            console.error('❌ Error fetching customer workspace:', err.message);
            res.status(500).json({ success:false, message:'Failed to fetch customer workspace.' });
        }
    }

    app.get('/api/agent/customers/:id', requireAuth('agent'), (req,res) => getCustomerDetail(req,res,'agent'));
    app.get('/api/admin/customers/:id/workspace', requireAuth('admin'), (req,res) => getCustomerDetail(req,res,'admin'));

    app.post('/api/agent/customers/:id/activity', requireAuth('agent'), async (req,res) => {
        if (!supabase) return res.status(500).json({ success:false, message:'Database not configured.' });
        const allowed = new Set(['agent_opened']);
        const eventType = typeof req.body?.event_type === 'string' ? req.body.event_type.trim() : '';
        if (!allowed.has(eventType)) return res.status(400).json({ success:false, message:'Invalid activity event.' });

        const { data: customer, error } = await supabase.from('clients').select('id').eq('id', req.params.id).eq('agent_id', req.agentId).single();
        if (error || !customer) return res.status(404).json({ success:false, message:'Customer not found.' });

        const row = await recordCustomerActivity(customer.id, req.agentId, eventType, 'Customer workspace opened');
        res.status(201).json({ success:true, data:row });
    });

    return { recordCustomerActivity };
}

module.exports = { createCustomerActivityService };
