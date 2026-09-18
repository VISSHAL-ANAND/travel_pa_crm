require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createCustomerActivityService } = require('./server/customerActivity');

const app = express();

app.use(cors());
app.use(express.json());

// ─── Lightweight request rate limiting ───
function rateLimit({ windowMs, max, message }) {
    const hits = new Map();
    return (req, res, next) => {
        const key = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const current = hits.get(key);
        if (!current || now - current.startedAt >= windowMs) {
            hits.set(key, { startedAt: now, count: 1 });
            return next();
        }
        current.count += 1;
        if (current.count > max) return res.status(429).json({ success: false, message });
        next();
    };
}

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Please try again later.' });
const leadRateLimit = rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Too many lead submissions. Please try again later.' });
const feedbackRateLimit = rateLimit({ windowMs: 60 * 1000, max: 20, message: 'Too many feedback submissions. Please try again later.' });

// ─── STATIC ROUTING ───
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/client', express.static(path.join(__dirname, 'client')));
app.use('/feedback', express.static(path.join(__dirname, 'feedback')));
app.use(express.static(__dirname));

// ─── SERVE PDF FILES ─── (Fixed - using regex instead of wildcard)
app.get(/^\/Report_.*\.pdf$/, (req, res) => {
    const fileName = req.path.substring(1);
    const filePath = path.join(__dirname, fileName);
    
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
        res.sendFile(filePath);
    } else {
        console.log('❌ PDF not found:', filePath);
        res.status(404).send('PDF file not found');
    }
});

app.get('/', (req, res) => {
    res.redirect('/client/client_UI.html');
});

// ─── GEMINI INIT ───
if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY is missing in .env!");
} else {
    console.log("🔑 Gemini API Key loaded.");
}

let ai;
try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch (e) {
    console.error("❌ Failed to initialize Gemini SDK:", e.message);
}

// ─── SUPABASE INIT ───
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

function normalizeSectionObject(section) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
    const title = typeof section.title === 'string' ? section.title : '';
    const subtitle = typeof section.subtitle === 'string' ? section.subtitle : '';
    const options = Array.isArray(section.options)
        ? section.options
            .filter(option => option && typeof option === 'object')
            .map(option => ({
                v: typeof option.v === 'string' ? option.v : '',
                l: typeof option.l === 'string' ? option.l : '',
                ik: typeof option.ik === 'string' ? option.ik : 'notsure'
            }))
        : [];
    return { title, subtitle, options };
}

function normalizeMainConfig(mainConfig) {
    const normalized = {};
    if (!mainConfig || typeof mainConfig !== 'object' || Array.isArray(mainConfig)) return normalized;
    Object.entries(mainConfig).forEach(([key, value]) => {
        if (key === '__deletedKeys') return;
        const section = normalizeSectionObject(value);
        if (section) normalized[key] = section;
        else if (value && typeof value === 'object') normalized[key] = value;
    });
    return normalized;
}

function buildMergedMainConfig(existingMainConfig, incomingMainConfig, deletedKeys = []) {
    const base = normalizeMainConfig(existingMainConfig);
    const incoming = normalizeMainConfig(incomingMainConfig);
    const merged = { ...base, ...incoming };
    deletedKeys.forEach((key) => delete merged[key]);
    return merged;
}

const CUSTOM_QUESTION_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox']);

function normalizeCustomQuestion(question, index) {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return null;
    const id = typeof question.id === 'string' ? question.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') : '';
    const label = typeof question.label === 'string' ? question.label.trim() : '';
    const type = typeof question.type === 'string' ? question.type.trim().toLowerCase() : 'text';
    if (!id || !label || !CUSTOM_QUESTION_TYPES.has(type)) return null;

    const options = Array.isArray(question.options)
        ? question.options
            .filter(option => typeof option === 'string' && option.trim())
            .map(option => option.trim())
            .slice(0, 50)
        : [];

    if (['select', 'multiselect'].includes(type) && options.length === 0) return null;

    return {
        id,
        label: label.slice(0, 240),
        type,
        required: question.required === true,
        options
    };
}

function validateCustomQuestions(questions) {
    if (!Array.isArray(questions) || questions.length > 100) return { valid: false, message: 'Maximum 100 custom questions allowed.' };
    const seen = new Set();
    const normalized = [];

    for (let i = 0; i < questions.length; i++) {
        const question = normalizeCustomQuestion(questions[i], i);
        if (!question) return { valid: false, message: 'Each custom question must have a valid id, label, type, and options when required.' };
        if (seen.has(question.id)) return { valid: false, message: 'Custom question IDs must be unique.' };
        seen.add(question.id);
        normalized.push(question);
    }

    return { valid: true, questions: normalized };
}

if (supabase) {
    console.log('🔌 Supabase client configured.');
} else {
    console.warn('⚠️  Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.');
}

// ─── NODEMAILER INIT ───
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// =========================================================================
// ─── ADMIN ID CACHE — resolved ONCE at startup, reused everywhere ───
// =========================================================================

let cachedAdminId = null;

async function resolveAdminId() {
    if (!supabase) {
        console.warn('⚠️  Skipping admin resolve — Supabase not configured.');
        return;
    }

    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL;

    if (!adminEmail) {
        console.error('❌ STARTUP ERROR: DEFAULT_ADMIN_EMAIL is missing in .env');
        process.exit(1);
    }

    try {
        const { data: rows, error: selectErr } = await supabase
            .from('admins')
            .select('id')
            .eq('email', adminEmail.trim().toLowerCase())
            .limit(1);

        if (selectErr) throw selectErr;

        if (rows && rows.length > 0) {
            cachedAdminId = rows[0].id;
            console.log(`✅ Admin resolved. admin_id: ${cachedAdminId}`);
        } else {
            const { data: inserted, error: insertErr } = await supabase
                .from('admins')
                .insert({
                    email: adminEmail.trim().toLowerCase(),
                    admin_name: (process.env.DEFAULT_ADMIN_NAME || 'Admin').trim()
                })
                .select('id')
                .single();

            if (insertErr) throw insertErr;
            cachedAdminId = inserted.id;
            console.log(`✅ Admin row created. admin_id: ${cachedAdminId}`);
        }
    } catch (err) {
        console.error('❌ Failed to resolve admin_id at startup:', err.message);
        process.exit(1);
    }
}

// =========================================================================
// ─── AUTHENTICATION ───
// =========================================================================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const AUTH_SECRET = process.env.AUTH_SECRET || ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
    console.warn('⚠️ ADMIN_PASSWORD is not configured. Admin login will remain unavailable until it is set.');
}
if (!AUTH_SECRET) {
    console.warn('⚠️ AUTH_SECRET is not configured. Authentication tokens cannot be issued until AUTH_SECRET or ADMIN_PASSWORD is set.');
}

function signAuthToken(payload) {
    if (!AUTH_SECRET) return null;
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + (8 * 60 * 60 * 1000) })).toString('base64url');
    const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    return `tp_${body}.${signature}`;
}

function verifyAuthToken(token) {
    if (!AUTH_SECRET || typeof token !== 'string' || !token.startsWith('tp_')) return null;
    const raw = token.slice(3);
    const [body, signature] = raw.split('.');
    if (!body || !signature) return null;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload.exp || Date.now() >= payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

const requireAuth = (role) => async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const payload = verifyAuthToken(token);

    if (!payload) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (payload.role !== role) return res.status(403).json({ success: false, message: 'Forbidden.' });

    if (role === 'agent') {
        if (!payload.agentId || !supabase) return res.status(401).json({ success: false, message: 'Invalid agent session.' });
        const { data: agent, error } = await supabase.from('agents').select('id, email, is_active').eq('id', payload.agentId).single();
        if (error || !agent || agent.is_active === false) return res.status(403).json({ success: false, message: 'Agent account is inactive or unavailable.' });
        req.agentId = agent.id;
        req.agentEmail = agent.email;
    }

    req.auth = payload;
    next();
};

// ─── CUSTOMER WORKSPACE / ACTIVITY SERVICE ───
// Installed after auth middleware exists; routes are additive and preserve legacy lead endpoints.
const customerActivityService = createCustomerActivityService({ app, supabase, requireAuth, buildLeadObject: (lead) => buildLeadObject(lead) });
const recordCustomerActivity = customerActivityService.recordCustomerActivity;

// ─── Unified Login ───
app.post('/api/auth/login', loginRateLimit, async (req, res) => {
    const { role, email, password } = req.body || {};

    if (role === 'admin') {
        if (!ADMIN_PASSWORD || !password || password !== ADMIN_PASSWORD) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
        }
        const token = signAuthToken({ role: 'admin', email: (process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase() });
        if (!token) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
        return res.status(200).json({ success: true, token, redirect: '/admin/dashboard.html' });
    }

    if (role === 'agent') {
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
        if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });

        const normalizedEmail = email.trim().toLowerCase();
        const { data: agentRows, error: agentErr } = await supabase
            .from('agents')
            .select('id, email, password, agent_name, is_active')
            .eq('email', normalizedEmail)
            .limit(1);

        if (agentErr) {
            console.error('❌ DB error during agent login:', agentErr.message);
            return res.status(500).json({ success: false, message: 'Database error.' });
        }
        if (!agentRows || agentRows.length === 0) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const agent = agentRows[0];
        if (agent.is_active === false) return res.status(403).json({ success: false, message: 'This agent account is inactive.' });
        if (!agent.password || !/^\$2[aby]\$/.test(agent.password)) {
            return res.status(403).json({ success: false, message: 'Agent account requires a password reset before login.' });
        }

        const passwordMatch = await bcrypt.compare(password, agent.password);
        if (!passwordMatch) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

        const token = signAuthToken({ role: 'agent', agentId: agent.id, email: agent.email });
        if (!token) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
        return res.status(200).json({
            success: true,
            token,
            agentName: agent.agent_name,
            agentId: agent.id,
            agentEmail: agent.email,
            redirect: '/admin/dashboard.html'
        });
    }

    return res.status(400).json({ success: false, message: 'Invalid role specified.' });
});

// =========================================================================
// ─── ADMIN ENDPOINTS ───
// =========================================================================

// GET /api/admin/agents — list all agents with customer count
app.get('/api/admin/agents', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const { data: agents, error: agentsErr } = await supabase
            .from('agents')
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, is_active');

        if (agentsErr) throw agentsErr;

        const agentsWithCount = await Promise.all(agents.map(async (agent) => {
            const { count, error: countErr } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agent.id);

            if (countErr) throw countErr;

            return {
                id: agent.id,
                name: agent.agent_name,
                email: agent.email,
                logo_url: agent.logo_url,
                profile_photo_url: agent.profile_photo_url,
                brand_name: agent.brand_name || agent.agent_name,
                brand_tagline: agent.brand_tagline,
                is_active: agent.is_active !== false,
                client_count: count || 0
            };
        }));

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const mapped = agentsWithCount.map(a => ({
            id: a.id,
            name: a.name,
            email: a.email,
            logo_url: a.logo_url,
            profile_photo_url: a.profile_photo_url,
            brand_name: a.brand_name,
            brand_tagline: a.brand_tagline,
            is_active: a.is_active,
            client_count: a.client_count,
            intakeLink: `${baseUrl}/client/client_UI.html?agent=${a.id}`
        }));        
        res.status(200).json({ success: true, data: mapped });
    } catch (err) {
        console.error("❌ Error fetching agents:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch agents.", error: err.message });
    }
});

// GET /api/admin/leads — all clients across all agents
app.get('/api/admin/leads', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) throw error;

        const processed = data.map(lead => buildLeadObject(lead));
        res.status(200).json({ success: true, data: processed });
    } catch (err) {
        console.error("❌ Error fetching all leads:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch leads.", error: err.message });
    }
});

// POST /api/admin/agents — create a new agent
app.post('/api/admin/agents', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });

    try {
        const { name, email, password } = req.body;

        if (!name || !name.trim()) return res.status(400).json({ success: false, message: "Agent name is required." });
        if (!email || !email.includes('@')) return res.status(400).json({ success: false, message: "A valid email address is required." });
        if (!password || password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });

        const { data: existing, error: checkErr } = await supabase
            .from('agents')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .limit(1);
        if (checkErr) throw checkErr;
        if (existing && existing.length > 0) {
            return res.status(409).json({ success: false, message: "An agent with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('agents')
            .insert({
                admin_id:   cachedAdminId,
                agent_name: name.trim(),
                email:      email.trim().toLowerCase(),
                password:   hashedPassword
            })
            .select('id, agent_name, email')
            .single();

        if (error) throw error;

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        console.log(`✅ Agent created: ${data.agent_name} (${data.email})`);
        res.status(200).json({
            success: true,
            data: {
                ...data,
                name: data.agent_name,
                client_count: 0,
                intakeLink: `${baseUrl}/client/client_UI.html?agent=${data.id}`
            }
        });

    } catch (err) {
        console.error("❌ Error creating agent:", err.message);
        res.status(500).json({ success: false, message: "Failed to create agent.", error: err.message });
    }
});

// GET /api/admin/customers/:id — canonical customer detail
app.get('/api/admin/customers/:id', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const { data: client, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (clientError) throw clientError;

        const [{ data: feedback, error: feedbackError }, { data: agent, error: agentError }] = await Promise.all([
            supabase.from('feedback').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
            client.agent_id
                ? supabase.from('agents').select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline').eq('id', client.agent_id).single()
                : Promise.resolve({ data: null, error: null })
        ]);
        if (feedbackError) throw feedbackError;
        if (agentError) throw agentError;

        res.json({
            success: true,
            data: {
                customer: buildLeadObject(client),
                agent,
                feedback: feedback || []
            }
        });
    } catch (err) {
        console.error('❌ Error fetching customer detail:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch customer detail.' });
    }
});

// GET /api/agent/leads/:id — customer detail restricted to authenticated agent
app.get('/api/agent/leads/:id', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', req.params.id)
            .eq('agent_id', req.agentId)
            .single();
        if (error) throw error;

        const { data: feedback, error: feedbackError } = await supabase
            .from('feedback')
            .select('*')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false });
        if (feedbackError) throw feedbackError;

        res.json({ success: true, data: { customer: buildLeadObject(client), feedback: feedback || [] } });
    } catch (err) {
        console.error('❌ Error fetching agent customer detail:', err.message);
        res.status(404).json({ success: false, message: 'Customer not found.' });
    }
});

// GET /api/admin/stats — global control-center metrics
app.get('/api/admin/stats', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const [{ data: agents }, { data: clients }, { data: feedback }] = await Promise.all([
            supabase.from('agents').select('id, is_active, created_at'),
            supabase.from('clients').select('id, agent_id, status, created_at'),
            supabase.from('feedback').select('id, agent_id, overall_rating, created_at')
        ]);
        const clientRows = clients || [];
        const feedbackRows = feedback || [];
        const activeAgents = (agents || []).filter(a => a.is_active !== false).length;
        const byStatus = clientRows.reduce((acc, row) => {
            const key = row.status || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const newLeads = clientRows.filter(c => c.created_at && new Date(c.created_at).getTime() >= sevenDaysAgo).length;
        const ratings = feedbackRows.map(f => Number(f.overall_rating)).filter(Number.isFinite);
        const averageRating = ratings.length ? Number((ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2)) : null;

        res.json({
            success: true,
            data: {
                totalAgents: (agents || []).length,
                activeAgents,
                totalCustomers: clientRows.length,
                newLeads,
                totalFeedback: feedbackRows.length,
                averageRating,
                customersByStatus: byStatus
            }
        });
    } catch (err) {
        console.error('❌ Error fetching admin stats:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch admin statistics.' });
    }
});

// GET /api/admin/agents/:id — agent profile plus customers and feedback summary
app.get('/api/admin/agents/:id', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, brand_primary_color, brand_secondary_color, contact_phone, contact_email, website_url, public_slug, is_active, updated_at')
            .eq('id', req.params.id)
            .single();
        if (agentError) throw agentError;

        const [{ data: clients, error: clientsError }, { data: feedback, error: feedbackError }] = await Promise.all([
            supabase.from('clients').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false }),
            supabase.from('feedback').select('*').eq('agent_id', agent.id).order('created_at', { ascending: false })
        ]);
        if (clientsError) throw clientsError;
        if (feedbackError) throw feedbackError;

        res.json({
            success: true,
            data: {
                agent,
                clients: (clients || []).map(buildLeadObject),
                feedback: feedback || []
            }
        });
    } catch (err) {
        console.error('❌ Error fetching agent detail:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch agent detail.' });
    }
});

// PATCH /api/admin/agents/:id/status — enable/disable an agent without deleting their data
app.patch('/api/admin/agents/:id/status', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const isActive = req.body?.is_active;
        if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: "is_active must be a boolean." });
        const { data, error } = await supabase.from('agents')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select('id, agent_name, email, is_active')
            .single();
        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("❌ Error updating agent status:", err.message);
        res.status(500).json({ success: false, message: "Failed to update agent status." });
    }
});

// DELETE /api/admin/agents/:id — destructive deletion is retained for admin use
app.delete('/api/admin/agents/:id', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const { error } = await supabase.from('agents').delete().eq('id', req.params.id);
        if (error) throw error;
        res.status(200).json({ success: true, message: "Agent deleted." });
    } catch (err) {
        console.error("❌ Error deleting agent:", err.message);
        res.status(500).json({ success: false, message: "Failed to delete agent." });
    }
});

// =========================================================================
// ─── AGENT ENDPOINTS ───// =========================================================================
// ─── AGENT ENDPOINTS ───
// =========================================================================

// GET /api/agent/leads?email= — leads belonging to one agent
app.get('/api/agent/leads', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const { data: clients, error: clientsErr } = await supabase
            .from('clients')
            .select('*')
            .eq('agent_id', req.agentId);
        if (clientsErr) throw clientsErr;

        res.status(200).json({ success: true, data: clients.map(lead => buildLeadObject(lead)) });
    } catch (err) {
        console.error("❌ Error fetching agent leads:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch leads.", error: err.message });
    }
});

// GET /api/agent/link — get agent's own shareable intake link
app.get('/api/agent/link', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const email = req.agentEmail;
        if (!email) return res.status(400).json({ success: false, message: "Agent email is required." });

        const { data: agentRows, error } = await supabase
            .from('agents')
            .select('id, agent_name, public_slug')
            .eq('email', email.trim().toLowerCase())
            .limit(1);
        if (error) throw error;

        if (!agentRows || agentRows.length === 0) {
            return res.status(404).json({ success: false, message: "Agent not found." });
        }

        const agent = agentRows[0];
        const publicSlug = agent.public_slug;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const link = publicSlug
            ? `${baseUrl}/client/client_UI.html?slug=${encodeURIComponent(publicSlug)}`
            : `${baseUrl}/client/client_UI.html?agent=${agent.id}`;
        const feedbackLink = publicSlug
            ? `${baseUrl}/feedback/feedback.html?slug=${encodeURIComponent(publicSlug)}`
            : `${baseUrl}/feedback/feedback.html?agent=${agent.id}`;
        res.status(200).json({ success: true, link, feedbackLink, agentId: agent.id, agentName: agent.agent_name, agentEmail: email, publicSlug });
    } catch (err) {
        console.error("❌ Error fetching agent link:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch link.", error: err.message });
    }
});

// GET /api/agent/form-config — agent fetches their custom questions + main config overrides
app.get('/api/agent/form-config', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const email = req.agentEmail;
        if (!email) return res.status(400).json({ success: false, message: "Agent email is required." });

        const { data: agentRows, error: agentErr } = await supabase
            .from('agents').select('id').eq('email', email.trim().toLowerCase()).limit(1);
        if (agentErr) throw agentErr;
        if (!agentRows || agentRows.length === 0) return res.status(404).json({ success: false, message: "Agent not found." });

        const { data, error } = await supabase
            .from('agent_form_config')
            .select('custom_questions, main_config, core_questions, version')
            .eq('agent_id', agentRows[0].id)
            .limit(1);
        if (error) throw error;

        const row = data && data[0];
        res.status(200).json({
            success: true,
            questions: (row && row.custom_questions) || [],
            mainConfig: normalizeMainConfig(row ? row.main_config : {})
        });
    } catch (err) {
        console.error("❌ Error fetching form config:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch form config.", error: err.message });
    }
});

// PUT /api/agent/form-config — agent saves their custom questions + main config overrides
app.put('/api/agent/form-config', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const validation = validateCustomQuestions(req.body?.questions || []);
        if (!validation.valid) return res.status(400).json({ success: false, message: validation.message });

        const incomingMainConfig = req.body?.mainConfig && typeof req.body.mainConfig === 'object' && !Array.isArray(req.body.mainConfig)
            ? req.body.mainConfig : {};
        const deletedKeys = Array.isArray(req.body?.deletedKeys)
            ? req.body.deletedKeys.filter(key => typeof key === 'string').slice(0, 50)
            : [];

        const { data: existingRows, error: existingErr } = await supabase
            .from('agent_form_config')
            .select('main_config, core_questions, version')
            .eq('agent_id', req.agentId).limit(1);
        if (existingErr) throw existingErr;

        const row = existingRows?.[0];
        const existingMainConfig = row?.main_config || {};
        const existingCoreQuestions = Array.isArray(row?.core_questions) ? row.core_questions : [];
        const version = Number(row?.version || 1);
        const mergedMainConfig = buildMergedMainConfig(existingMainConfig, incomingMainConfig, deletedKeys);

        const { data, error } = await supabase.from('agent_form_config').upsert({
            agent_id: req.agentId,
            custom_questions: validation.questions,
            core_questions: existingCoreQuestions,
            main_config: mergedMainConfig,
            version: version + 1,
            updated_at: new Date().toISOString()
        }).select('custom_questions, main_config, core_questions, version').single();
        if (error) throw error;

        res.status(200).json({
            success: true,
            questions: data.custom_questions || [],
            coreQuestions: data.core_questions || [],
            mainConfig: normalizeMainConfig(data.main_config || {}),
            version: data.version
        });
    } catch (err) {
        console.error("❌ Error saving form config:", err.message);
        res.status(500).json({ success: false, message: "Failed to save form config." });
    }
});

// PATCH /api/admin/agents/:id/password — reset an agent password
app.patch('/api/admin/agents/:id/password', requireAuth('admin'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
        const hashedPassword = await bcrypt.hash(password, 12);
        const { error } = await supabase.from('agents').update({ password: hashedPassword, updated_at: new Date().toISOString() }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Agent password updated.' });
    } catch (err) {
        console.error('❌ Error resetting agent password:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update agent password.' });
    }
});

// PATCH /api/agent/password — authenticated agent changes their own password
app.patch('/api/agent/password', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
        if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
        const { data: agent, error: findErr } = await supabase.from('agents').select('password').eq('id', req.agentId).single();
        if (findErr || !agent?.password) return res.status(404).json({ success: false, message: 'Agent not found.' });
        const matches = await bcrypt.compare(currentPassword, agent.password);
        if (!matches) return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        const { error } = await supabase.from('agents').update({ password: hashedPassword, updated_at: new Date().toISOString() }).eq('id', req.agentId);
        if (error) throw error;
        res.json({ success: true, message: 'Password changed successfully. Please sign in again.' });
    } catch (err) {
        console.error('❌ Error changing agent password:', err.message);
        res.status(500).json({ success: false, message: 'Failed to change password.' });
    }
});

// GET /api/agent/profile — authenticated agent profile and white-label settings
app.get('/api/agent/profile', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const { data, error } = await supabase
            .from('agents')
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, brand_primary_color, brand_secondary_color, contact_phone, contact_email, website_url, public_slug, is_active')
            .eq('id', req.agentId)
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('❌ Error fetching agent profile:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
    }
});

// PUT /api/agent/profile — update only the authenticated agent's white-label settings
app.put('/api/agent/profile', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: 'Database not configured.' });
    try {
        const allowed = [
            'agent_name', 'logo_url', 'profile_photo_url', 'brand_name', 'brand_tagline',
            'brand_primary_color', 'brand_secondary_color', 'contact_phone', 'contact_email',
            'website_url', 'public_slug'
        ];
        const updates = {};
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
                const value = req.body[key];
                if (value !== null && typeof value !== 'string') {
                    return res.status(400).json({ success: false, message: `${key} must be a string or null.` });
                }
                updates[key] = typeof value === 'string' ? value.trim() : value;
            }
        }
        if (updates.agent_name !== undefined && !updates.agent_name) {
            return res.status(400).json({ success: false, message: 'Agent name cannot be empty.' });
        }
        if (updates.contact_email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(updates.contact_email)) {
            return res.status(400).json({ success: false, message: 'Invalid contact email.' });
        }
        if (updates.brand_primary_color && !/^#[0-9a-fA-F]{6}$/.test(updates.brand_primary_color)) {
            return res.status(400).json({ success: false, message: 'Primary color must be a hex color.' });
        }
        if (updates.brand_secondary_color && !/^#[0-9a-fA-F]{6}$/.test(updates.brand_secondary_color)) {
            return res.status(400).json({ success: false, message: 'Secondary color must be a hex color.' });
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('agents')
            .update(updates)
            .eq('id', req.agentId)
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, brand_primary_color, brand_secondary_color, contact_phone, contact_email, website_url, public_slug, is_active')
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('❌ Error updating agent profile:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

// GET /api/public/form-config/:agentId — public (no auth), used by client_UI.html
app.get('/api/public/form-config/:agentId', async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const { data: agents, error: agentError } = await supabase
            .from('agents')
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, brand_primary_color, brand_secondary_color, contact_phone, contact_email, website_url, public_slug, is_active')
            .eq('id', req.params.agentId)
            .limit(1);
        if (agentError) throw agentError;
        const agent = agents && agents[0];
        if (!agent || agent.is_active === false) {
            return res.status(404).json({ success: false, message: 'Agent not found or inactive.' });
        }

        const { data, error } = await supabase
            .from('agent_form_config')
            .select('custom_questions, main_config, core_questions, version')
            .eq('agent_id', agent.id)
            .limit(1);
        if (error) throw error;

        const row = data && data[0];
        res.status(200).json({
            success: true,
            agent: {
                id: agent.id,
                name: agent.agent_name,
                email: agent.contact_email || agent.email,
                logoUrl: agent.logo_url,
                profilePhotoUrl: agent.profile_photo_url,
                brandName: agent.brand_name || agent.agent_name,
                brandTagline: agent.brand_tagline,
                primaryColor: agent.brand_primary_color,
                secondaryColor: agent.brand_secondary_color,
                phone: agent.contact_phone,
                websiteUrl: agent.website_url,
                publicSlug: agent.public_slug
            },
            questions: (row && row.custom_questions) || [],
            coreQuestions: (row && row.core_questions) || [],
            mainConfig: normalizeMainConfig(row ? row.main_config : {}),
            version: (row && row.version) || 1
        });
    } catch (err) {
        console.error("❌ Error fetching public form config:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch form config.", error: err.message });
    }
});

// GET /api/public/form-config/slug/:slug — public white-label config by agent slug
app.get('/api/public/form-config/slug/:slug', async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const slug = typeof req.params.slug === 'string'
            ? req.params.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
            : '';
        if (!slug) return res.status(400).json({ success: false, message: 'Invalid agent slug.' });

        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, agent_name, email, logo_url, profile_photo_url, brand_name, brand_tagline, brand_primary_color, brand_secondary_color, contact_phone, contact_email, website_url, public_slug, is_active')
            .eq('public_slug', slug).limit(1).maybeSingle();
        if (agentError) throw agentError;
        if (!agent || agent.is_active === false) return res.status(404).json({ success: false, message: 'Agent not found or inactive.' });

        const { data: config, error: configError } = await supabase
            .from('agent_form_config')
            .select('custom_questions, main_config, core_questions, version')
            .eq('agent_id', agent.id).limit(1).maybeSingle();
        if (configError) throw configError;

        res.json({
            success: true,
            agent: {
                id: agent.id, name: agent.agent_name,
                email: agent.contact_email || agent.email,
                logoUrl: agent.logo_url, profilePhotoUrl: agent.profile_photo_url,
                brandName: agent.brand_name || agent.agent_name,
                brandTagline: agent.brand_tagline,
                primaryColor: agent.brand_primary_color,
                secondaryColor: agent.brand_secondary_color,
                phone: agent.contact_phone, websiteUrl: agent.website_url,
                publicSlug: agent.public_slug
            },
            questions: config?.custom_questions || [],
            coreQuestions: config?.core_questions || [],
            mainConfig: normalizeMainConfig(config?.main_config || {}),
            version: config?.version || 1
        });
    } catch (err) {
        console.error("❌ Error fetching public slug config:", err.message);
        res.status(500).json({ success: false, message: "Failed to fetch public form config." });
    }
});

// PATCH /api/agent/leads/:id/status
app.patch('/api/agent/leads/:id/status', requireAuth('agent'), async (req, res) => {
    if (!supabase) return res.status(500).json({ success: false, message: "Database not configured." });
    try {
        const status = typeof req.body?.status === 'string' ? req.body.status.trim().toLowerCase() : '';
        const allowedStatuses = new Set(['new', 'in-progress', 'contacted', 'completed', 'closed']);
        if (!allowedStatuses.has(status)) return res.status(400).json({ success: false, message: "Invalid status." });
        const { data, error } = await supabase.from('clients')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', req.params.id).eq('agent_id', req.agentId).select().single();
        if (error) throw error;
        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error("❌ Error updating lead status:", err.message);
        res.status(500).json({ success: false, message: "Failed to update status." });
    }
});

// =========================================================================
// ─── FEEDBACK ENDPOINTS ───
// =========================================================================

// POST /api/feedback — Submit new feedback
app.post('/api/feedback', feedbackRateLimit, async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const {
            client_name,
            client_email,
            message,
            overall_rating,
            service_rating,
            value_rating,
            recommend_rating,
            continue_booking,
            agent_email,
            agent_id: requestedAgentId
        } = req.body;

        // --- Validation ---
        if (!client_name || client_name.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Name is required." });
        }
        if (!client_email || !client_email.includes('@')) {
            return res.status(400).json({ success: false, message: "Valid email is required." });
        }
        if (!message || message.trim().length < 5) {
            return res.status(400).json({ success: false, message: "Feedback message is required." });
        }
        if (!overall_rating || overall_rating < 1 || overall_rating > 5) {
            return res.status(400).json({ success: false, message: "Valid overall rating is required." });
        }
        if (!service_rating || service_rating < 1 || service_rating > 5) {
            return res.status(400).json({ success: false, message: "Valid service rating is required." });
        }
        if (!value_rating || value_rating < 1 || value_rating > 5) {
            return res.status(400).json({ success: false, message: "Valid value rating is required." });
        }
        if (!recommend_rating || recommend_rating < 1 || recommend_rating > 5) {
            return res.status(400).json({ success: false, message: "Valid recommend rating is required." });
        }
        if (!continue_booking || !['yes', 'maybe', 'no'].includes(continue_booking)) {
            return res.status(400).json({ success: false, message: "Continue booking selection is required." });
        }

        // --- Find or create client ---
        let clientId = null;
        const { data: existingClient, error: clientFindErr } = await supabase
            .from('clients')
            .select('id, agent_id')
            .eq('email', client_email.trim().toLowerCase())
            .limit(1);

        if (clientFindErr) throw clientFindErr;

        if (existingClient && existingClient.length > 0) {
            clientId = existingClient[0].id;
        } else {
            const { data: newClient, error: clientInsertErr } = await supabase
                .from('clients')
                .insert({
                    first_name: client_name.split(' ')[0] || client_name,
                    last_name: client_name.split(' ').slice(1).join(' ') || '',
                    email: client_email.trim().toLowerCase(),
                    status: 'new'
                })
                .select('id')
                .single();

            if (clientInsertErr) throw clientInsertErr;
            clientId = newClient.id;
        }

        // --- Resolve the agent from the public feedback link ---
        let agentId = null;
        if (requestedAgentId) {
            const { data: agentRows, error: agentFindErr } = await supabase
                .from('agents').select('id, email, is_active').eq('id', requestedAgentId).limit(1);
            if (agentFindErr) throw agentFindErr;
            if (!agentRows || agentRows.length === 0 || agentRows[0].is_active === false) {
                return res.status(404).json({ success: false, message: 'Agent not found or inactive.' });
            }
            agentId = agentRows[0].id;
            if (agent_email && agent_email.trim().toLowerCase() !== agentRows[0].email.toLowerCase()) {
                return res.status(400).json({ success: false, message: 'Agent reference does not match the selected agent.' });
            }
        } else if (agent_email) {
            const { data: agentRows, error: agentFindErr } = await supabase
                .from('agents').select('id, email, is_active').eq('email', agent_email.trim().toLowerCase()).limit(1);
            if (agentFindErr) throw agentFindErr;
            if (agentRows && agentRows.length > 0) {
                if (agentRows[0].is_active === false) return res.status(403).json({ success: false, message: 'This agent account is inactive.' });
                agentId = agentRows[0].id;
            }
        }

        // --- Verify customer/agent ownership BEFORE inserting feedback ---
        if (agentId) {
            const { data: clientCheck, error: clientCheckErr } = await supabase.from('clients')
                .select('agent_id').eq('id', clientId).single();
            if (clientCheckErr) throw clientCheckErr;
            if (clientCheck?.agent_id && clientCheck.agent_id !== agentId) {
                return res.status(409).json({ success: false, message: 'This customer is already associated with a different agent.' });
            }
            if (clientCheck && !clientCheck.agent_id) {
                const { error: attachErr } = await supabase.from('clients')
                    .update({ agent_id: agentId, updated_at: new Date().toISOString() })
                    .eq('id', clientId).is('agent_id', null);
                if (attachErr) throw attachErr;
            }
        }

        // --- Insert feedback only after ownership has been validated ---
        const { error: feedbackErr } = await supabase.from('feedback').insert({
            client_id: clientId, agent_id: agentId,
            client_name: client_name.trim(), client_email: client_email.trim().toLowerCase(),
            message: message.trim(),
            overall_rating: Number(overall_rating), service_rating: Number(service_rating),
            value_rating: Number(value_rating), recommend_rating: Number(recommend_rating),
            continue_booking, agent_email: agent_email ? agent_email.trim().toLowerCase() : null
        });
        if (feedbackErr) throw feedbackErr;

        console.log(`✅ Feedback submitted by ${client_name} (${client_email})`);
        return res.status(201).json({
            success: true,
            message: "Thank you for your feedback!"
        });

    } catch (error) {
        console.error("❌ Error submitting feedback:", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again."
        });
    }
});

// GET /api/agent/feedback — Get feedback for a specific agent
app.get('/api/agent/feedback', requireAuth('agent'), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const email = req.agentEmail || req.query.email;
        if (!email) {
            return res.status(400).json({ success: false, message: "Agent email is required." });
        }

        // First, get the agent ID
        const { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .single();

        if (agentError) {
            console.error("❌ Error finding agent:", agentError.message);
            return res.status(404).json({ success: false, message: "Agent not found." });
        }

        const agentId = agentData.id;

        // Then get feedback for this agent
        const { data: feedback, error } = await supabase
            .from('feedback')
            .select('id, client_name, client_email, message, overall_rating, service_rating, value_rating, recommend_rating, continue_booking, created_at')
            .or(`agent_id.eq.${agentId},agent_email.eq.${email.trim().toLowerCase()}`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json({
            success: true,
            data: feedback || []
        });

    } catch (error) {
        console.error("❌ Error fetching agent feedback:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch feedback."
        });
    }
});

// GET /api/admin/feedback — Get all feedback for admin
app.get('/api/admin/feedback', requireAuth('admin'), async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ success: false, message: "Database not configured." });
    }

    try {
        const { data: feedback, error } = await supabase
            .from('feedback')
            .select(`
                id,
                client_name,
                client_email,
                message,
                overall_rating,
                service_rating,
                value_rating,
                recommend_rating,
                continue_booking,
                created_at,
                agent_email,
                agents:agent_id (
                    agent_name,
                    email
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Format the response to match what the dashboard expects
        const formattedData = feedback.map(item => ({
            id: item.id,
            client_name: item.client_name,
            client_email: item.client_email,
            message: item.message,
            overall_rating: item.overall_rating,
            service_rating: item.service_rating,
            value_rating: item.value_rating,
            recommend_rating: item.recommend_rating,
            continue_booking: item.continue_booking,
            created_at: item.created_at,
            agent_name: item.agents ? item.agents.agent_name : null,
            agent_email: item.agent_email || (item.agents ? item.agents.email : null)
        }));

        return res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error("❌ Error fetching all feedback:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch feedback."
        });
    }
});

// =========================================================================
// ─── NEW LEAD INTAKE (CLIENT QUESTIONNAIRE) ───
// =========================================================================

app.post('/api/new-lead', leadRateLimit, async (req, res) => {
    let dynamicAiSummary = "Fallback Summary: Onboarding details captured and forwarded to queue.";
    let finalStructuredReport = "";

    try {
        console.log("📥 Parsing incoming lead form...");
        const userData = req.body || {};

        const customerName  = `${userData.firstName || 'Unknown'} ${userData.lastName || 'Client'}`;
        const customerEmail = userData.email || 'No Email';
        const customerPhone = userData.phone || 'Not Provided';
        const contactMethod = userData.contactMethod || 'Email';
        const assignedAgent = userData.assignedAgent || 'Unassigned';

        const userOptionsText = buildOptionsText(userData);

        // ── Gemini AI Summary ──
        if (ai) {
            try {
                const aiPrompt = `
You are an expert luxury travel consultant helper. Write a highly professional,
3-sentence custom travel vibe summary and matching strategy for a travel agent to read before contacting this client.
Base your analysis strictly on the user's actual questionnaire choices below:
${userOptionsText}
Keep the tone polished, exclusive, and tailored exactly to their profile. Do not invent details outside of their choices.
                `.trim();

                const aiResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: aiPrompt,
                });
                dynamicAiSummary = aiResponse.text ? aiResponse.text.trim() : "No summary generated.";
            } catch (aiErr) {
                console.error("❌ Gemini error:", aiErr.message);
            }
        }

        finalStructuredReport = buildTextReport(customerName, customerEmail, customerPhone, contactMethod, assignedAgent, userOptionsText, dynamicAiSummary);
        console.log("\n--- ✨ REPORT GENERATED ✨ ---\n", finalStructuredReport, "\n");

        // ── DB Write ──
        let targetAgentEmail = process.env.DEFAULT_AGENT_FALLBACK_EMAIL || 'agent@agency.com';

        if (supabase) {
            try {
                let agentId = null;

                // Priority 1: use agentId from the unique link URL
                if (userData.agentId) {
                    const { data: agentRows, error: agentSelectErr } = await supabase
                        .from('agents')
                        .select('id, email, is_active')
                        .eq('id', userData.agentId)
                        .limit(1);
                    if (agentSelectErr) throw agentSelectErr;
                    if (agentRows && agentRows.length > 0 && agentRows[0].is_active !== false) {
                        agentId = agentRows[0].id;
                        if (agentRows[0].email) targetAgentEmail = agentRows[0].email;
                    } else if (agentRows && agentRows.length > 0) {
                        return res.status(403).json({ success: false, message: 'This agent intake link is inactive.' });
                    }
                }

                // Priority 2: fallback to agent name lookup
                if (!agentId && assignedAgent && assignedAgent !== 'Direct Web Traffic') {
                    let agentQuery = supabase
                        .from('agents')
                        .select('id, email')
                        .eq('agent_name', assignedAgent)
                        .limit(1);
                    if (cachedAdminId) agentQuery = agentQuery.eq('admin_id', cachedAdminId);
                    const { data: agentRows, error: agentSelectErr } = await agentQuery;
                    if (agentSelectErr) throw agentSelectErr;
                    if (agentRows && agentRows.length > 0) {
                        agentId = agentRows[0].id;
                        if (agentRows[0].email) targetAgentEmail = agentRows[0].email;
                    }
                }

                if (!agentId) {
                    console.warn(`⚠️  No agent matched — client saved without agent_id.`);
                }

                const clientRow = {
                    agent_id:             agentId,
                    first_name:           userData.firstName           || null,
                    last_name:            userData.lastName            || null,
                    email:                userData.email               || null,
                    phone:                userData.phone               || null,
                    region:               userData.region              || null,
                    destination_specific: userData.destination_specific || null,
                    destination: Array.isArray(userData.destinationVibes) && userData.destinationVibes.length > 0
                                    ? userData.destinationVibes.join(', ')
                                    : (userData.destination || null),
                    budget:      userData.nightlyBudget || null,
                    travel_date: userData.travelDateStart || null,
                    travel_date_end: userData.travelDateEnd || null,
                    notes:       Array.isArray(userData.specialDetails) && userData.specialDetails.length > 0
                                    ? userData.specialDetails.join(', ')
                                    : (userData.notes || null),
                    status: 'new',
                    contact_method: contactMethod,
                    custom_answers: userData.customAnswers && typeof userData.customAnswers === 'object'
                        ? userData.customAnswers
                        : {},
                    ai_strategy: dynamicAiSummary
                };

                const { data: clientInsert, error: clientInsertErr } = await supabase
                    .from('clients')
                    .insert(clientRow)
                    .select()
                    .single();

                if (clientInsertErr) {
                    console.error('⚠️  Supabase client insert error:', clientInsertErr.message);
                } else {
                    console.log('✅ Client stored. customer_id:', clientInsert.id);
                }

            } catch (dbErr) {
                console.error('⚠️  DB write error (non-fatal):', dbErr.message || dbErr);
            }
        }

        res.status(200).json({
            success: true,
            message: "Report compiled!",
            report: finalStructuredReport
        });

        setImmediate(async () => {
            try {
                const generatedFilename = generateLeadPDF(userData, dynamicAiSummary);
                const fullPdfPath = path.join(__dirname, generatedFilename);

                const mailOptions = {
                    from: `"Travel-PA Platform" <${process.env.SMTP_USER}>`,
                    to: targetAgentEmail,
                    subject: `✨ New AI Travel Report: ${customerName}`,
                    html: buildEmailHtml(customerName, contactMethod, customerEmail, customerPhone, assignedAgent, dynamicAiSummary),
                    attachments: [{ filename: generatedFilename, path: fullPdfPath }]
                };

                const emailStatus = await transporter.sendMail(mailOptions);
                console.log(`✉️  Email sent to [${targetAgentEmail}]. ID: ${emailStatus.messageId}`);
            } catch (bgErr) {
                console.error("❌ Background worker error:", bgErr.message);
            }
        });

    } catch (error) {
        console.error("💥 Pipeline error:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Failed to process lead.", error: error.message || error });
        }
    }
});

// =========================================================================
// ─── HELPERS ───
// =========================================================================

function buildLeadObject(lead) {
    const cleanName = `${lead.first_name || 'Unknown'}_${lead.last_name || 'Client'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr   = lead.created_at
        ? new Date(lead.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
    
    let budget = lead.budget;
    if (budget && !isNaN(parseFloat(budget))) {
        budget = parseFloat(budget);
    } else {
        budget = null;
    }
    
    return {
        ...lead,
        name:       `${lead.first_name || 'Unknown'} ${lead.last_name || 'Client'}`,
        concept:    lead.destination_specific || lead.destination || "Custom Itinerary",
        reportFile: `Report_${cleanName}_${dateStr}.pdf`,
        budget:     budget
    };
}

function buildOptionsText(d) {
    return `
- Trip Concept: ${arr(d.tripDreams)}
- Region: ${d.region || 'Not Specified'}
- Destination: ${d.destination_specific || 'Not Specified'}
- Travel Party: ${arr(d.travelers)}
- Date Flexibility: ${d.datesPreference || 'Not Specified'}
- Stay Length: ${d.stayDuration || 'Not Specified'}
- Travel Date Start: ${d.travelDateStart || 'Not Specified'}
- Travel Date End: ${d.travelDateEnd || 'Not Specified'}
- Required Assistance: ${arr(d.helpNeeded)}
- Special Occasions/Priorities: ${arr(d.specialDetails)}
- Accommodation Style: ${d.travelStyle || 'Not Specified'}
- Nightly Budget Tier: £${d.nightlyBudget || 'Not Specified'}
- Departing From (UK Airport): ${d.ukBaseLocation || 'Not Specified'}
    `.trim();
}

function arr(v) {
    return Array.isArray(v) && v.length > 0 ? v.join(', ') : 'None selected';
}

function buildTextReport(name, email, phone, contact, agent, options, aiSummary) {
    return `
==================================================
            TRAVEL ONBOARDING REPORT
==================================================

CUSTOMER DETAILS
--------------------------------------------------
• Name: ${name}
• Email: ${email}
• Phone: ${phone}
• Preferred Contact Method: ${contact}
• Assigned Agent: ${agent}

QUESTIONNAIRE SELECTIONS
--------------------------------------------------
${options}

AI SUMMARY
--------------------------------------------------
${aiSummary}

==================================================
    `.trim();
}

function buildEmailHtml(name, contact, email, phone, agent, aiSummary) {
    return `
        <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:30px;border:1px solid #cbd5e1;border-radius:12px;background:#ffffff;">
            <h2 style="color:#0284c7;margin-bottom:4px;font-size:22px;">New Strategic Lead Report Ready</h2>
            <p style="color:#475569;font-size:15px;margin-top:0;">Gemini has processed a fresh onboarding questionnaire.</p>
            <div style="background:#f8fafc;padding:20px;border-radius:8px;margin:24px 0;border-left:4px solid #f59e0b;">
                <h3 style="margin-top:0;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">Client Details</h3>
                <p style="margin:8px 0;font-size:14px;"><strong>Name:</strong> ${name}</p>
                <p style="margin:8px 0;font-size:14px;"><strong>Contact:</strong> ${contact} — ${email} / ${phone}</p>
                <p style="margin:8px 0;font-size:14px;"><strong>Assigned Agent:</strong> ${agent}</p>
            </div>
            <h3 style="color:#1a365d;font-size:14px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">AI Strategy Assessment</h3>
            <p style="color:#334155;font-size:14px;line-height:1.6;background:#fff7ed;padding:14px;border-radius:6px;border:1px dashed #fed7aa;">${aiSummary}</p>
            <p style="font-size:14px;margin-top:24px;">Full client report attached as PDF.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:30px 0;"/>
            <p style="font-size:11px;color:#64748b;text-align:center;">Travel-PA Automated CRM</p>
        </div>
    `;
}

// ─── PDF GENERATOR ───
function generateLeadPDF(userData, aiReportText) {
    const cleanName  = `${userData.firstName || 'Unknown'}_${userData.lastName || 'Client'}`.replace(/[^a-zA-Z0-9]/g, '_');
    const dateString = new Date().toISOString().split('T')[0];
    const filename   = `Report_${cleanName}_${dateString}.pdf`;
    const filePath   = path.join(__dirname, filename);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(fs.createWriteStream(filePath));

    const drawPageFrame = () => {
        doc.roundedRect(25, 25, 545, 792, 18).lineWidth(2.5).stroke('#1A365D');
    };
    drawPageFrame();
    doc.on('pageAdded', drawPageFrame);

    const logoPath = ['assets/logo.png', 'logo.png']
        .map(p => path.join(__dirname, p))
        .find(p => fs.existsSync(p));
    const logoWidth = 90;
    const centerX   = (595 - logoWidth) / 2;

    if (logoPath) {
        doc.image(logoPath, centerX, 45, { width: logoWidth });
        doc.moveDown(4.5);
    } else {
        doc.fillColor('#1A365D').font('Helvetica-Bold').fontSize(16).text('T R A V E L   C O .', 50, 55, { align: 'center' });
        doc.moveDown(3);
    }

    doc.fillColor('#2D3748').font('Helvetica-Bold').fontSize(16).text('CLIENT ONBOARDING PROFILE BRIEF', { align: 'center' });
    doc.moveDown(1.5);

    const metaY = doc.y;

    doc.fillColor('#1A365D').font('Helvetica-Bold').fontSize(10).text('CUSTOMER PROFILE', 55, metaY);
    doc.font('Helvetica').fontSize(9.5).fillColor('#4A5568');
    doc.text(`Name: ${userData.firstName || 'Unknown'} ${userData.lastName || 'Client'}`, 55, metaY + 18);
    doc.text(`Email: ${userData.email || 'Not Provided'}`, 55, metaY + 32);
    doc.text(`Phone: ${userData.phone || 'Not Provided'}`, 55, metaY + 46);
    doc.text(`Preferred Contact: ${userData.contactMethod || 'Email'}`, 55, metaY + 60);

    doc.fillColor('#1A365D').font('Helvetica-Bold').fontSize(10).text('TRIP DIMENSIONS', 320, metaY);
    doc.font('Helvetica').fontSize(9.5).fillColor('#4A5568');
    doc.text(`Region: ${userData.region || 'Not Specified'}`, 320, metaY + 18);
    doc.text(`Destination: ${userData.destination_specific || 'Not Specified'}`, 320, metaY + 32);
    const dateRange = userData.travelDateStart && userData.travelDateEnd 
        ? `${userData.travelDateStart} — ${userData.travelDateEnd}` 
        : userData.travelDateStart || 'Not Specified';
    doc.text(`Travel Dates: ${dateRange}`, 320, metaY + 46);
    doc.text(`Duration: ${userData.stayDuration || 'Not Specified'}`, 320, metaY + 60);
    doc.text(`Nightly Budget: £${userData.nightlyBudget || 'Not Specified'}`, 320, metaY + 74);

    doc.moveTo(55, metaY + 95).lineTo(540, metaY + 95).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.x = 55;
    doc.y = metaY + 115;

    doc.fillColor('#1A365D').font('Helvetica-Bold').fontSize(12).text('AI CONSULTANT STRATEGY ASSESSMENT');
    doc.font('Helvetica').fontSize(10).fillColor('#2D3748').moveDown(1);
    doc.text(aiReportText, { align: 'left', lineGap: 5, paragraphGap: 12, width: 485 });
    doc.moveDown(2);

    doc.fillColor('#1A365D').font('Helvetica-Bold').fontSize(12).text('SUBMITTED QUESTIONNAIRE SPECIFICATIONS');
    doc.font('Helvetica').fontSize(9.5).fillColor('#4A5568').moveDown(1);

    doc.text(`• Selected Trip Concepts: ${arr(userData.tripDreams)}`,      { lineGap: 4, width: 485 });
    doc.text(`• Region: ${userData.region || 'Not Specified'}`,             { lineGap: 4, width: 485 });
    doc.text(`• Destination: ${userData.destination_specific || 'Not Specified'}`, { lineGap: 4, width: 485 });
    doc.text(`• Group Setup: ${arr(userData.travelers)}`,                   { lineGap: 4, width: 485 });
    doc.text(`• Travel Dates: ${dateRange || 'Not Specified'}`,             { lineGap: 4, width: 485 });
    doc.text(`• Service Requests: ${arr(userData.helpNeeded)}`,             { lineGap: 4, width: 485 });
    doc.text(`• Priorities & Occasions: ${arr(userData.specialDetails)}`,   { lineGap: 4, width: 485 });
    doc.text(`• UK Departure Airport: ${userData.ukBaseLocation || 'Not Specified'}`, { lineGap: 4, width: 485 });

    doc.end();
    console.log(`📑 PDF generated: ${filename}`);
    return filename;
}

// ─── GLOBAL ERROR HANDLERS ───
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err);
});

// =========================================================================
// ─── START SERVER ───
// =========================================================================

const PORT = process.env.PORT || 5005;

resolveAdminId().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}/`);
        console.log(`   Client Portal: http://localhost:${PORT}/client/client_UI.html`);
        console.log(`   Admin Portal:  http://localhost:${PORT}/admin/login.html\n`);
    });
});