// ── Session ──
const TOKEN       = localStorage.getItem('crm_token');
const ROLE        = localStorage.getItem('crm_role');
const AGENT_EMAIL = new URLSearchParams(location.search).get('email');
const IS_AGENT    = ROLE === 'agent' || !!AGENT_EMAIL;
const COLORS      = ['c-blue', 'c-green', 'c-orange', 'c-purple'];

if (!TOKEN) location.href = '/admin/login.html';

let allAgents   = [];
let allFeedback = [];
let sortAsc     = true;
let fbLoaded    = false;

const INTAKE_EDITOR_SECTIONS = [
    { key: 'trip', label: 'Trip Type' },
    { key: 'who', label: 'Travellers' },
    { key: 'plan', label: 'Services' },
    { key: 'details', label: 'Details' },
    { key: 'timing', label: 'Timing' },
    { key: 'style', label: 'Style & Budget' },
    { key: 'airports', label: 'Airports' },
    { key: 'dest', label: 'Destination' }
];
const DEFAULT_INTAKE_CONFIG = {
    trip: {
        title: 'What kind of trip are you dreaming about?',
        subtitle: 'Select all that resonate with your vision.',
        options: [
            { v: 'beach', l: 'Beach Type', ik: 'beach' },
            { v: 'celebrate', l: 'Celebration', ik: 'celebrdet' },
            { v: 'water', l: 'Near Water', ik: 'water' },
            { v: 'food', l: 'Great Food & Wine', ik: 'food' },
            { v: 'adventure', l: 'Adventure', ik: 'adventure' },
            { v: 'family', l: 'Family Time', ik: 'family' },
            { v: 'culture', l: 'Arts & Culture', ik: 'culture' },
            { v: 'wellness', l: 'Wellness', ik: 'wellness' },
            { v: 'festivals', l: 'Festivals', ik: 'festivals' },
            { v: 'sport', l: 'Sporting Events', ik: 'sport' },
            { v: 'wildlife', l: 'Wildlife', ik: 'wildlife' },
            { v: 'urban', l: 'Urban Exploring', ik: 'urban' },
            { v: 'outdoors', l: 'Outdoors', ik: 'outdoors' },
            { v: 'business', l: 'Business', ik: 'business' },
            { v: 'figuring', l: 'Still Figuring Out', ik: 'notsure' }
        ]
    },
    who: {
        title: "Who's coming with?",
        subtitle: 'Tell us who will be joining your journey.',
        options: [
            { v: 'solo', l: 'Solo', ik: 'solo' },
            { v: 'partner', l: 'Partner', ik: 'partner' },
            { v: 'kids', l: 'Kids', ik: 'kidsT' },
            { v: 'family', l: 'Family', ik: 'familyT' },
            { v: 'friends', l: 'Friends', ik: 'friends' },
            { v: 'elderly', l: 'Elderly', ik: 'elderly' },
            { v: 'pets', l: 'Pets', ik: 'pets' }
        ]
    },
    plan: {
        title: 'How may we serve you?',
        subtitle: 'Select every service you wish us to arrange.',
        options: [
            { v: 'hotel', l: 'Book a Hotel or Villa', ik: 'hotel' },
            { v: 'cruise', l: 'Book a Cruise', ik: 'cruise' },
            { v: 'itinerary', l: 'Plan a Full Itinerary', ik: 'itinerary' },
            { v: 'group', l: 'Plan a Group or Special Event', ik: 'group' },
            { v: 'notsure', l: 'Not Sure Yet', ik: 'notsure' }
        ]
    },
    details: {
        title: 'Any special occasions or wishes?',
        subtitle: 'Mention anything that makes this journey truly yours.',
        options: [
            { v: 'safari', l: 'Safari', ik: 'safari' },
            { v: 'access', l: 'Accessibility Matters', ik: 'access' },
            { v: 'groups', l: 'Groups', ik: 'groups2' },
            { v: 'solotv', l: 'Solo Travel', ik: 'solo' },
            { v: 'honey', l: 'Honeymoon', ik: 'honey' },
            { v: 'baby', l: 'Babymoon', ik: 'baby' },
            { v: 'wedding', l: 'Wedding', ik: 'wedding' },
            { v: 'celeb', l: 'Celebration', ik: 'celebrdet' },
            { v: 'slow', l: 'Slow Travel', ik: 'slow' },
            { v: 'other', l: 'Other', ik: 'other' }
        ]
    },
    timing: {
        title: 'When shall we begin<br>your journey?',
        subtitle: 'Share your timing and how long you wish to travel.',
        flexOptions: [
            { v: 'specific', l: 'I have specific dates' },
            { v: 'flex', l: 'I am flexible' }
        ],
        durations: [
            { v: 'weekend', l: 'Weekend Escape', ik: 'weekend' },
            { v: 'week', l: 'Week Away', ik: 'week' },
            { v: 'extended', l: 'Extended Journey', ik: 'extended' }
        ]
    },
    style: {
        title: 'Your style & investment',
        subtitle: 'Help us craft an experience befitting your taste.',
        styles: [
            { v: 'luxe', l: 'Exclusively Luxury', ik: 'luxe' },
            { v: 'boutique', l: 'Boutique & Artisan', ik: 'boutique' },
            { v: 'mix', l: 'Curated Mix', ik: 'mix' },
            { v: 'cause', l: 'Mindful & Considered', ik: 'cause' },
            { v: 'notsure', l: 'Advise Me', ik: 'notsure' }
        ],
        budgetTiers: [
            { v: '120-180', l: '£120 – £180  ·  Comfort' },
            { v: '180-300', l: '£180 – £300  ·  Premium' },
            { v: '300-600', l: '£300 – £600  ·  Luxury' },
            { v: '600+', l: '£600+  ·  Ultra Luxury' }
        ]
    },
    airports: {
        title: 'Where do you depart from?',
        subtitle: 'Select your nearest departure airport in the United Kingdom.',
        options: [
            { n: 'Manchester', c: 'MAN', k: 'man' },
            { n: 'London Heathrow', c: 'LHR', k: 'lhr' },
            { n: 'Edinburgh', c: 'EDI', k: 'edi' },
            { n: 'London Gatwick', c: 'LGW', k: 'lgw' },
            { n: 'Birmingham', c: 'BHX', k: 'bhx' },
            { n: 'London Stansted', c: 'STN', k: 'stn' },
            { n: 'Belfast', c: 'BHD/BFS', k: 'bel' }
        ]
    },
    dest: {
        title: 'Where do you want to go?',
        subtitle: 'Select a region to explore its destinations.',
        regions: [
            { key:'indian_ocean', label:'Indian Ocean', dests:['Maldives','Mauritius','Seychelles','Sri Lanka','India'] },
            { key:'middle_east', label:'Middle East', dests:['Dubai','Abu Dhabi','Oman','Fujairah','Ras al Khaimah','Zighy Bay','Qatar','Saudi Arabia','AlUla'] },
            { key:'europe', label:'Europe', dests:['Greece','Spain','Cyprus','Portugal','Turkey','Croatia','Italy','Lapland','Switzerland','Malta','Montenegro','Iceland','France','Finland'] },
            { key:'caribbean_mexico', label:'Caribbean & Mexico', dests:['Barbados','Saint Lucia','Antigua And Barbuda','Aruba Dutch Antilles','Grenada','Jamaica','St Barths','Dominican Republic','St Vincent and the Grenadines','Anguilla','British Virgin Islands','Turks and Caicos','Bermuda','St Kitts and Nevis','Bahamas','Mexico'] },
            { key:'far_east', label:'Far East', dests:['Thailand','Indonesia','Vietnam','Malaysia','Cambodia','Singapore','Japan','Philippines','Hong Kong'] },
            { key:'north_america', label:'North America', dests:['USA','Canada'] },
            { key:'africa', label:'Africa', dests:['South Africa','Kenya','Tanzania and Zanzibar','Morocco','Botswana','Zimbabwe','Rwanda'] },
            { key:'australasia', label:'Australasia', dests:['Australia','New Zealand'] },
            { key:'cruise', label:'Cruise', dests:['Mediterranean','Caribbean','Northern Europe','Asia & Far East','South America','Alaska','North America','Middle East & Indian Ocean','Australasia & South Pacific','Antarctica'] }
        ]
    }
};
const IC_SVG = {
    beach:'<svg viewBox="0 0 24 24"><path d="M2 20h20"/><path d="M12 20V8"/><path d="M6 20c0-5.5 2.5-9 6-9s6 3.5 6 9"/><circle cx="12" cy="5" r="2"/><path d="M19 8c-1-3-4-4-7-4S7 5 6 8"/></svg>',
    celebrate:'<svg viewBox="0 0 24 24"><path d="M5.8 11.3L2 22l10.7-3.79"/><path d="M22 2l-2.24.75a2.9 2.9 0 00-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/></svg>',
    water:'<svg viewBox="0 0 24 24"><path d="M2 12h20M2 17c1.4-1.7 3.5-2.7 5.5-2.7s4.1 1 5.5 2.7c1.4-1.7 3.5-2.7 5.5-2.7"/></svg>',
    food:'<svg viewBox="0 0 24 24"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>',
    adventure:'<svg viewBox="0 0 24 24"><polygon points="3 20 12 4 21 20"/><path d="M3 20h18"/></svg>',
    family:'<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="2.5"/><circle cx="17" cy="6" r="2"/><path d="M6 22v-4a3 3 0 016 0v4M14 22v-3a2.5 2.5 0 015 0v3"/></svg>',
    culture:'<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="13" rx="1"/><path d="M8 9V7a4 4 0 018 0v2"/></svg>',
    wellness:'<svg viewBox="0 0 24 24"><path d="M12 22c1 0 9.5-5 9.5-12a9.5 9.5 0 00-19 0C2.5 17 11 22 12 22z"/></svg>',
    festivals:'<svg viewBox="0 0 24 24"><path d="M9 20c0-2.8 1.3-5 3-5s3 2.2 3 5"/><path d="M4 14c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M2 20h20"/><circle cx="12" cy="4" r="1.5"/></svg>',
    sport:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3c2.5 2 4 5 4 9s-1.5 7-4 9"/></svg>',
    wildlife:'<svg viewBox="0 0 24 24"><path d="M14 14c0 3.3-2.7 6-6 6H6a6 6 0 010-12h1"/><path d="M10 10c0-3.3 2.7-6 6-6h1a6 6 0 010 12h-1"/></svg>',
    urban:'<svg viewBox="0 0 24 24"><rect x="2" y="6" width="8" height="16"/><rect x="10" y="10" width="6" height="12"/><rect x="16" y="3" width="6" height="19"/></svg>',
    outdoors:'<svg viewBox="0 0 24 24"><path d="M3 20l7-12 4 7 2-3 5 8"/><path d="M2 20h20"/></svg>',
    business:'<svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="14" rx="2"/><path d="M16 8V6a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>',
    notsure:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 015.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>',
    warm:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4"/></svg>',
    romantic:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 000-7.8z"/></svg>',
    nature:'<svg viewBox="0 0 24 24"><path d="M12 22V12"/><path d="M8 16c0-4.4 1.8-8 4-8s4 3.6 4 8"/></svg>',
    kids:'<svg viewBox="0 0 24 24"><circle cx="9" cy="5" r="2"/><path d="M9 7v6l3 3 6-1"/></svg>',
    secret:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>',
    historic:'<svg viewBox="0 0 24 24"><path d="M3 22h18M4 22V10l8-8 8 8v12"/></svg>',
    pet:'<svg viewBox="0 0 24 24"><path d="M10 5.2C10 3.8 8.4 2.7 6.5 3 3.7 3.5 2.4 9 2.5 10"/></svg>',
    hotel:'<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>',
    cruise:'<svg viewBox="0 0 24 24"><path d="M2 20h20M4 14l2-8h12l2 8"/><path d="M4 14c4 3 12 3 16 0"/></svg>',
    jet:'<svg viewBox="0 0 24 24"><path d="M22 16.9l-3.5-1.7c-.4-.2-.7-.5-.8-1L16 9l-4-4-4 7H4l2 4h5l5 5 4-2v-3l-2-1"/></svg>',
    itinerary:'<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>',
    group:'<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    safari:'<svg viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>',
    access:'<svg viewBox="0 0 24 24"><circle cx="12" cy="4" r="1.5" fill="currentColor"/><path d="M9 9h6M12 7v5"/><path d="M7 20l2-4h6l2 4"/></svg>',
    groups2:'<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    solo:'<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a6 6 0 0112 0v2"/></svg>',
    honey:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7"/></svg>',
    baby:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1 2 4 2 4-2 4-2"/></svg>',
    wedding:'<svg viewBox="0 0 24 24"><path d="M12 2l2 4h4l-3 3 1 4-4-2.5L8 13l1-4L6 6h4l2-4z"/></svg>',
    celebrdet:'<svg viewBox="0 0 24 24"><path d="M22 12c0 5.5-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2s10 4.5 10 10z"/><path d="M8 12l2 2 4-4"/></svg>',
    slow:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    other:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
    partner:'<svg viewBox="0 0 24 24"><circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M2 21v-2a5 5 0 0110 0v2"/></svg>',
    kidsT:'<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M12 10v5"/><path d="M9 22v-5l-2-3h10l-2 3v5"/></svg>',
    familyT:'<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="2.5"/><circle cx="17" cy="6" r="2"/><path d="M6 22v-4a3 3 0 016 0v4"/></svg>',
    friends:'<svg viewBox="0 0 24 24"><circle cx="7" cy="6" r="3"/><circle cx="17" cy="6" r="3"/><path d="M1 21v-2a5 5 0 0112 0v2"/></svg>',
    elderly:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><path d="M9 9a3 3 0 00-3 3v3h12v-3a3 3 0 00-3-3"/></svg>',
    pets:'<svg viewBox="0 0 24 24"><circle cx="5" cy="9" r="2"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="19" cy="9" r="2"/></svg>',
    luxe:'<svg viewBox="0 0 24 24"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5"/></svg>',
    boutique:'<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
    mix:'<svg viewBox="0 0 24 24"><rect x="2" y="14" width="7" height="6" rx="1"/><rect x="13" y="10" width="9" height="10" rx="1"/></svg>',
    cause:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h4M18 12h4M12 2v4M12 18v4"/></svg>',
    shield:'<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    weekend:'<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>',
    week:'<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="17" rx="2"/><path d="M1 10h22"/></svg>',
    extended:'<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
};
const ICON_KEYS = Object.keys(IC_SVG);

let iconPickerOpenFor = null;

function iconGlyph(key) {
    return IC_SVG[key] || IC_SVG.notsure;
}

function toggleIconPicker(pickerId) {
    iconPickerOpenFor = (iconPickerOpenFor === pickerId) ? null : pickerId;
    renderIntakeEditorSection();
}

function pickIcon(pickerId, onSelectExpr, iconKey) {
    iconPickerOpenFor = null;
    // eslint-disable-next-line no-new-func
    new Function('value', onSelectExpr)(iconKey);
}

function buildIconPicker(pickerId, currentValue, onChangeExpr) {
    const isOpen = iconPickerOpenFor === pickerId;
    const grid = ICON_KEYS.map(k => `
        <button type="button" class="icon-swatch ${k === currentValue ? 'sel' : ''}" title="${k}"
            onclick='pickIcon(${JSON.stringify(pickerId)}, ${JSON.stringify(onChangeExpr)}.replace("VALUE","${k}"), ${JSON.stringify(k)})'>
            ${iconGlyph(k)}
        </button>
    `).join('');
    return `
        <div class="icon-picker-wrap">
            <button type="button" class="icon-picker-trigger" onclick='toggleIconPicker(${JSON.stringify(pickerId)})'>
                <span class="icon-picker-preview">${iconGlyph(currentValue)}</span>
                <span class="icon-picker-name">${currentValue}</span>
            </button>
            ${isOpen ? `<div class="icon-picker-panel">${grid}</div>` : ''}
        </div>
    `;
}

let intakeEditorActiveKey = 'trip';
let intakeEditorDraft = {};
let intakeEditorOriginalMainConfig = {};
let intakeEditorQuestions = [];
let intakeEditorModifiedSections = new Set();
let intakeEditorResetSections = new Set();
let intakeEditorLoaded = false;

function cloneIntakeSection(section) {
    return JSON.parse(JSON.stringify(section || { title: '', subtitle: '', options: [] }));
}

function normalizeOptionSection(section, fallback) {
    const base = cloneIntakeSection(fallback || { title: '', subtitle: '', options: [] });
    const source = section && typeof section === 'object' ? section : {};
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title : base.title,
        subtitle: typeof source.subtitle === 'string' && source.subtitle.trim() ? source.subtitle : base.subtitle,
        options: Array.isArray(source.options)
            ? source.options.filter(option => option && typeof option === 'object').map(option => ({
                v: typeof option.v === 'string' && option.v.trim() ? option.v : '',
                l: typeof option.l === 'string' ? option.l : '',
                ik: typeof option.ik === 'string' && option.ik.trim() ? option.ik : 'notsure'
            }))
            : cloneIntakeSection(base).options
    };
}

function normalizeStyleSection(section, fallback) {
    const base = cloneIntakeSection(fallback || { title: '', subtitle: '', styles: [], budgetTiers: [] });
    const source = section && typeof section === 'object' ? section : {};
    const styles = Array.isArray(source.styles)
        ? source.styles.filter(o => o && typeof o === 'object').map(o => ({
            v: typeof o.v === 'string' && o.v.trim() ? o.v : '',
            l: typeof o.l === 'string' ? o.l : '',
            ik: typeof o.ik === 'string' && o.ik.trim() ? o.ik : 'notsure'
        }))
        : cloneIntakeSection(base).styles;
    const budgetTiers = Array.isArray(source.budgetTiers)
        ? source.budgetTiers.filter(o => o && typeof o === 'object').map(o => ({
            v: typeof o.v === 'string' && o.v.trim() ? o.v : '',
            l: typeof o.l === 'string' ? o.l : ''
        }))
        : cloneIntakeSection(base).budgetTiers;
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title : base.title,
        subtitle: typeof source.subtitle === 'string' && source.subtitle.trim() ? source.subtitle : base.subtitle,
        styles,
        budgetTiers
    };
}

function normalizeAirportsSection(section, fallback) {
    const base = cloneIntakeSection(fallback || { title: '', subtitle: '', options: [] });
    const source = section && typeof section === 'object' ? section : {};
    const options = Array.isArray(source.options)
        ? source.options.filter(o => o && typeof o === 'object').map(o => ({
            n: typeof o.n === 'string' ? o.n : '',
            c: typeof o.c === 'string' ? o.c : '',
            k: typeof o.k === 'string' && o.k.trim() ? o.k : ''
        }))
        : cloneIntakeSection(base).options;
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title : base.title,
        subtitle: typeof source.subtitle === 'string' && source.subtitle.trim() ? source.subtitle : base.subtitle,
        options
    };
}

function normalizeTimingSection(section, fallback) {
    const base = cloneIntakeSection(fallback || { title: '', subtitle: '', flexOptions: [], durations: [] });
    const source = section && typeof section === 'object' ? section : {};
    const flexOptions = Array.isArray(source.flexOptions)
        ? source.flexOptions.filter(o => o && typeof o === 'object').map(o => ({
            v: typeof o.v === 'string' && o.v.trim() ? o.v : '',
            l: typeof o.l === 'string' ? o.l : ''
        }))
        : cloneIntakeSection(base).flexOptions;
    const durations = Array.isArray(source.durations)
        ? source.durations.filter(o => o && typeof o === 'object').map(o => ({
            v: typeof o.v === 'string' && o.v.trim() ? o.v : '',
            l: typeof o.l === 'string' ? o.l : '',
            ik: typeof o.ik === 'string' && o.ik.trim() ? o.ik : 'notsure'
        }))
        : cloneIntakeSection(base).durations;
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title : base.title,
        subtitle: typeof source.subtitle === 'string' && source.subtitle.trim() ? source.subtitle : base.subtitle,
        flexOptions,
        durations
    };
}

function normalizeDestSection(section, fallback) {
    const base = cloneIntakeSection(fallback || { title: '', subtitle: '', regions: [] });
    const source = section && typeof section === 'object' ? section : {};
    const regions = Array.isArray(source.regions)
        ? source.regions.filter(o => o && typeof o === 'object').map(o => ({
            key: typeof o.key === 'string' && o.key.trim() ? o.key : '',
            label: typeof o.label === 'string' ? o.label : '',
            dests: Array.isArray(o.dests) ? o.dests.filter(d => typeof d === 'string') : []
        }))
        : cloneIntakeSection(base).regions;
    return {
        title: typeof source.title === 'string' && source.title.trim() ? source.title : base.title,
        subtitle: typeof source.subtitle === 'string' && source.subtitle.trim() ? source.subtitle : base.subtitle,
        regions
    };
}

function normalizeIntakeSection(key, section, fallback) {
    switch (key) {
        case 'style':
            return normalizeStyleSection(section, fallback);
        case 'airports':
            return normalizeAirportsSection(section, fallback);
        case 'timing':
            return normalizeTimingSection(section, fallback);
        case 'dest':
            return normalizeDestSection(section, fallback);
        default:
            return normalizeOptionSection(section, fallback);
    }
}

function slugifyOptionLabel(label) {
    return String(label || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'option';
}

function makeOptionValue(label, existingValues) {
    const base = slugifyOptionLabel(label);
    let value = base;
    let suffix = 1;
    while (existingValues.includes(value)) {
        value = `${base}-${suffix}`;
        suffix += 1;
    }
    return value;
}

function normalizeCustomQuestions(questions) {
    if (!Array.isArray(questions)) return [];
    return questions
        .filter(question => question && typeof question === 'object')
        .map((question, index) => {
            const label = typeof question.label === 'string' ? question.label : '';
            const baseId = typeof question.id === 'string' && question.id.trim()
                ? question.id.trim()
                : `question-${index + 1}`;
            return {
                id: baseId,
                label,
                required: !!question.required
            };
        });
}

function makeCustomizeQuestionId(label) {
    const base = slugifyOptionLabel(label || 'question');
    let value = base;
    let suffix = 1;
    const existingValues = intakeEditorQuestions.map(question => question.id);
    while (existingValues.includes(value)) {
        value = `${base}-${suffix}`;
        suffix += 1;
    }
    return value;
}

function renderCustomizeQuestions() {
    const list = document.getElementById('customQuestionsList');
    const card = document.getElementById('customQuestionsCard');
    if (!list || !card) return;
    card.style.display = 'block';
    if (!intakeEditorQuestions.length) {
        list.innerHTML = '<div class="intake-empty-state">No custom questions yet. Add one to get started.</div>';
        return;
    }
    list.innerHTML = intakeEditorQuestions.map((question, index) => `
        <div class="custom-q-item">
            <input type="text" value="${esc(question.label || '')}" oninput="updateCustomizeQuestion(${index}, this.value)" placeholder="Question label">
            <label class="custom-q-required"><input type="checkbox" ${question.required ? 'checked' : ''} onchange="toggleCustomizeQuestionRequired(${index}, this.checked)"> Required</label>
            <div class="intake-option-actions">
                <button class="intake-option-btn" onclick="moveCustomizeQuestion(${index}, -1)" aria-label="Move up">↑</button>
                <button class="intake-option-btn" onclick="moveCustomizeQuestion(${index}, 1)" aria-label="Move down">↓</button>
                <button class="intake-option-btn danger" onclick="removeCustomizeQuestion(${index})" aria-label="Delete">✕</button>
            </div>
        </div>
    `).join('');
}

function addCustomizeQuestion() {
    intakeEditorQuestions.push({
        id: makeCustomizeQuestionId('question'),
        label: '',
        required: false
    });
    renderCustomizeQuestions();
}

function updateCustomizeQuestion(index, label) {
    if (!intakeEditorQuestions[index]) return;
    intakeEditorQuestions[index].label = label;
}

function toggleCustomizeQuestionRequired(index, required) {
    if (!intakeEditorQuestions[index]) return;
    intakeEditorQuestions[index].required = !!required;
}

function moveCustomizeQuestion(index, direction) {
    if (!intakeEditorQuestions[index]) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= intakeEditorQuestions.length) return;
    const [item] = intakeEditorQuestions.splice(index, 1);
    intakeEditorQuestions.splice(targetIndex, 0, item);
    renderCustomizeQuestions();
}

function removeCustomizeQuestion(index) {
    if (!intakeEditorQuestions[index]) return;
    intakeEditorQuestions.splice(index, 1);
    renderCustomizeQuestions();
}

async function loadCustomizeQuestions() {
    renderCustomizeQuestions();
}

function markIntakeSectionModified(key) {
    intakeEditorModifiedSections.add(key);
    intakeEditorResetSections.delete(key);
}

function buildIntakeEditorPayload() {
    const payload = JSON.parse(JSON.stringify(intakeEditorOriginalMainConfig || {}));
    INTAKE_EDITOR_SECTIONS.forEach(({ key }) => {
        if (intakeEditorResetSections.has(key)) {
            delete payload[key];
        } else if (intakeEditorModifiedSections.has(key)) {
            payload[key] = normalizeIntakeSection(key, intakeEditorDraft[key], DEFAULT_INTAKE_CONFIG[key]);
        }
    });
    return payload;
}

function setIntakeEditorSection(key) {
    intakeEditorActiveKey = key;
    renderIntakeEditorSection();
}

function updateIntakeSectionField(key, field, value) {
    if (!intakeEditorDraft[key]) return;
    intakeEditorDraft[key][field] = value;
    markIntakeSectionModified(key);
}

function updateIntakeOption(key, index, label) {
    if (!intakeEditorDraft[key] || !intakeEditorDraft[key].options[index]) return;
    intakeEditorDraft[key].options[index].l = label;
    markIntakeSectionModified(key);
}

function getIntakeSectionArray(key, arrayKey) {
    if (!intakeEditorDraft[key] || typeof intakeEditorDraft[key] !== 'object') {
        intakeEditorDraft[key] = normalizeIntakeSection(key, null, DEFAULT_INTAKE_CONFIG[key]);
    }
    if (!Array.isArray(intakeEditorDraft[key][arrayKey])) {
        intakeEditorDraft[key][arrayKey] = [];
    }
    return intakeEditorDraft[key][arrayKey];
}

function updateIntakeSectionItem(key, arrayKey, index, field, value) {
    const section = intakeEditorDraft[key];
    if (!section || !Array.isArray(section[arrayKey]) || !section[arrayKey][index]) return;
    if (field === 'dests' && typeof value === 'string') {
        section[arrayKey][index][field] = String(value).split(/[,\r\n]+/).map(v => v.trim()).filter(Boolean);
    } else {
        section[arrayKey][index][field] = typeof value === 'string' ? value : value;
    }
    markIntakeSectionModified(key);
}

function addIntakeSectionItem(key, arrayKey, template) {
    const items = getIntakeSectionArray(key, arrayKey);
    const newItem = template ? JSON.parse(JSON.stringify(template)) : { v: '', l: '', ik: 'notsure' };
    if (!newItem.v && typeof newItem.l === 'string') {
        newItem.v = makeOptionValue(newItem.l, items.map(item => item.v).filter(Boolean));
    }
    items.push(newItem);
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function deleteIntakeSectionItem(key, arrayKey, index) {
    const section = intakeEditorDraft[key];
    if (!section || !Array.isArray(section[arrayKey]) || !section[arrayKey][index]) return;
    section[arrayKey].splice(index, 1);
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function moveIntakeSectionItem(key, arrayKey, index, direction) {
    const section = intakeEditorDraft[key];
    if (!section || !Array.isArray(section[arrayKey]) || !section[arrayKey][index]) return;
    const items = section[arrayKey];
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function addIntakeOption(key) {
    if (!intakeEditorDraft[key]) return;
    const existingValues = intakeEditorDraft[key].options.map(option => option.v).filter(Boolean);
    intakeEditorDraft[key].options.push({
        v: makeOptionValue('', existingValues),
        l: '',
        ik: 'notsure'
    });
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function deleteIntakeOption(key, index) {
    if (!intakeEditorDraft[key] || !intakeEditorDraft[key].options[index]) return;
    intakeEditorDraft[key].options.splice(index, 1);
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function moveIntakeOption(key, index, direction) {
    if (!intakeEditorDraft[key] || !intakeEditorDraft[key].options[index]) return;
    const options = intakeEditorDraft[key].options;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const [item] = options.splice(index, 1);
    options.splice(targetIndex, 0, item);
    markIntakeSectionModified(key);
    renderIntakeEditorSection();
}

function resetIntakeSection(key) {
    const meta = INTAKE_EDITOR_SECTIONS.find(s => s.key === key);
    if (!meta) return;
    const confirmed = confirm(`Reset ${meta.label} questions to Travel-PA's defaults?`);
    if (!confirmed) return;
    intakeEditorDraft[key] = cloneIntakeSection(DEFAULT_INTAKE_CONFIG[key]);
    intakeEditorResetSections.add(key);
    intakeEditorModifiedSections.add(key);
    renderIntakeEditorSection();
}

function renderIntakeEditorTabs() {
    const container = document.getElementById('intakeEditorTabs');
    if (!container) return;
    container.innerHTML = INTAKE_EDITOR_SECTIONS.map(section => `
        <button class="intake-tab ${section.key === intakeEditorActiveKey ? 'active' : ''}" onclick="setIntakeEditorSection('${section.key}')">${section.label}</button>
    `).join('');
}

function renderIntakeEditorSection() {
    const container = document.getElementById('intakeEditorSection');
    const card = document.getElementById('intakeEditorCard');
    if (!container || !card) return;
    const section = intakeEditorDraft[intakeEditorActiveKey] || normalizeIntakeSection(intakeEditorActiveKey, null, DEFAULT_INTAKE_CONFIG[intakeEditorActiveKey]);
    const meta = INTAKE_EDITOR_SECTIONS.find(item => item.key === intakeEditorActiveKey) || INTAKE_EDITOR_SECTIONS[0];

    let bodyHtml = '';

    if (meta.key === 'style') {
        const stylesHtml = (section.styles || []).map((option, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(option.l || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'styles', ${index}, 'l', this.value)" placeholder="Style label">
                ${buildIconPicker(`${meta.key}-opt-${index}`, option.ik || 'notsure', `updateIntakeSectionItem('${meta.key}', 'styles', ${index}, 'ik', 'VALUE')`)}
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'styles', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'styles', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'styles', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No style options yet. Add one to get started.</div>';

        const budgetsHtml = (section.budgetTiers || []).map((tier, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(tier.l || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'budgetTiers', ${index}, 'l', this.value)" placeholder="Display label">
                <input type="text" value="${esc(tier.v || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'budgetTiers', ${index}, 'v', this.value)" placeholder="Value">
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'budgetTiers', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'budgetTiers', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'budgetTiers', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No budget tiers yet. Add one to get started.</div>';

        bodyHtml = `
            <div class="intake-section-block">
                <div class="intake-section-heading">Style Options</div>
                <div class="intake-option-list">${stylesHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'styles', { v: '', l: '', ik: 'notsure' })">+ Add Style</button></div>
            </div>
            <div class="intake-section-block">
                <div class="intake-section-heading">Budget Tiers</div>
                <div class="intake-option-list">${budgetsHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'budgetTiers', { v: '', l: '' })">+ Add Budget Tier</button></div>
            </div>
        `;
    } else if (meta.key === 'airports') {
        const airportsHtml = (section.options || []).map((option, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(option.n || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'options', ${index}, 'n', this.value)" placeholder="Airport name">
                <input type="text" value="${esc(option.c || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'options', ${index}, 'c', this.value)" placeholder="Airport code">
                <input type="text" value="${esc(option.k || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'options', ${index}, 'k', this.value)" placeholder="Key">
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'options', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'options', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'options', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No airports yet. Add one to get started.</div>';

        bodyHtml = `
            <div class="intake-section-block">
                <div class="intake-section-heading">Airport Options</div>
                <div class="intake-option-list">${airportsHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'options', { n: '', c: '', k: '' })">+ Add Airport</button></div>
            </div>
        `;
    } else if (meta.key === 'timing') {
        const flexHtml = (section.flexOptions || []).map((option, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(option.l || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'flexOptions', ${index}, 'l', this.value)" placeholder="Label">
                <input type="text" value="${esc(option.v || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'flexOptions', ${index}, 'v', this.value)" placeholder="Value">
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'flexOptions', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'flexOptions', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'flexOptions', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No date preference options yet. Add one to get started.</div>';

        const durationHtml = (section.durations || []).map((option, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(option.l || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'durations', ${index}, 'l', this.value)" placeholder="Label">
                <input type="text" value="${esc(option.v || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'durations', ${index}, 'v', this.value)" placeholder="Value">
                ${buildIconPicker(`dur-${index}`, option.ik || 'notsure', `updateIntakeSectionItem('${meta.key}', 'durations', ${index}, 'ik', 'VALUE')`)}
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'durations', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'durations', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'durations', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No duration options yet. Add one to get started.</div>';
        bodyHtml = `
            <div class="intake-section-block">
                <div class="intake-section-heading">Date Preference</div>
                <div class="intake-option-list">${flexHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'flexOptions', { v: '', l: '' })">+ Add Preference</button></div>
            </div>
            <div class="intake-section-block">
                <div class="intake-section-heading">Length of Stay</div>
                <div class="intake-option-list">${durationHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'durations', { v: '', l: '', ik: 'notsure' })">+ Add Duration</button></div>
            </div>
        `;
    } else if (meta.key === 'dest') {
        const regionsHtml = (section.regions || []).map((region, index) => `
            <div class="intake-option-item">
                <input type="text" value="${esc(region.label || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'regions', ${index}, 'label', this.value)" placeholder="Region label">
                <input type="text" value="${esc(region.key || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'regions', ${index}, 'key', this.value)" placeholder="Region key">
                <textarea rows="3" oninput="updateIntakeSectionItem('${meta.key}', 'regions', ${index}, 'dests', this.value)" placeholder="Destinations, separated by commas or new lines">${esc((region.dests || []).join(', '))}</textarea>
                <div class="intake-option-actions">
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'regions', ${index}, -1)" aria-label="Move up">↑</button>
                    <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'regions', ${index}, 1)" aria-label="Move down">↓</button>
                    <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'regions', ${index})" aria-label="Delete">✕</button>
                </div>
            </div>
        `).join('') || '<div class="intake-empty-state">No regions yet. Add one to get started.</div>';

        bodyHtml = `
            <div class="intake-section-block">
                <div class="intake-section-heading">Destination Regions</div>
                <div class="intake-option-list">${regionsHtml}</div>
                <div class="intake-editor-actions"><button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'regions', { key: '', label: '', dests: [] })">+ Add Region</button></div>
            </div>
        `;
    } else {
        const optionsHtml = (section.options || []).length
            ? (section.options || []).map((option, index) => `
                <div class="intake-option-item">
                    <input type="text" value="${esc(option.l || '')}" oninput="updateIntakeSectionItem('${meta.key}', 'options', ${index}, 'l', this.value)" placeholder="Option label">
                    ${buildIconPicker(`${meta.key}-opt-${index}`, option.ik || 'notsure', `updateIntakeSectionItem('${meta.key}', 'options', ${index}, 'ik', 'VALUE')`)}
                    <div class="intake-option-actions">
                        <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'options', ${index}, -1)" aria-label="Move up">↑</button>
                        <button class="intake-option-btn" onclick="moveIntakeSectionItem('${meta.key}', 'options', ${index}, 1)" aria-label="Move down">↓</button>
                        <button class="intake-option-btn danger" onclick="deleteIntakeSectionItem('${meta.key}', 'options', ${index})" aria-label="Delete">✕</button>
                    </div>
                </div>
            `).join('')
            : '<div class="intake-empty-state">No options yet. Add one to get started.</div>';
        bodyHtml = `
            <div class="intake-option-list">${optionsHtml}</div>
            <div class="intake-editor-actions">
                <button class="btn-secondary" onclick="addIntakeSectionItem('${meta.key}', 'options', { v: '', l: '', ik: 'notsure' })">+ Add Option</button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="intake-editor-grid">
            <div class="intake-editor-field">
                <label for="intakeTitleInput">Section title</label>
                <input id="intakeTitleInput" type="text" value="${esc(section.title || '')}" oninput="updateIntakeSectionField('${meta.key}', 'title', this.value)">
            </div>
            <div class="intake-editor-field">
                <label for="intakeSubtitleInput">Section subtitle</label>
                <input id="intakeSubtitleInput" type="text" value="${esc(section.subtitle || '')}" oninput="updateIntakeSectionField('${meta.key}', 'subtitle', this.value)">
            </div>
        </div>
        ${bodyHtml}
        <div class="intake-editor-actions">
            <button class="btn-secondary" onclick="resetIntakeSection('${meta.key}')">Reset to Default</button>
            <button class="btn-primary" onclick="saveIntakeFormConfig()">Save Changes</button>
        </div>
    `;
    renderIntakeEditorTabs();
    card.style.display = 'block';
}

async function loadIntakeFormConfig() {
    if (intakeEditorLoaded) return;
    const card = document.getElementById('intakeEditorCard');
    const customCard = document.getElementById('customQuestionsCard');
    if (!card) return;
    card.style.display = 'block';
    if (customCard) customCard.style.display = 'block';

    const url = `/api/agent/form-config?email=${encodeURIComponent(AGENT_EMAIL)}`;

    try {
        const response = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
        const payload = await response.json();
        if (!payload.success) throw new Error(payload.message || 'Failed to load form config.');
        const loadedMainConfig = payload.mainConfig && typeof payload.mainConfig === 'object' ? payload.mainConfig : {};
        intakeEditorQuestions = normalizeCustomQuestions(payload.questions);
        intakeEditorOriginalMainConfig = JSON.parse(JSON.stringify(loadedMainConfig));
        intakeEditorDraft = {};
        INTAKE_EDITOR_SECTIONS.forEach(({ key }) => {
            intakeEditorDraft[key] = normalizeIntakeSection(key, loadedMainConfig[key], DEFAULT_INTAKE_CONFIG[key]);
        });
        intakeEditorModifiedSections = new Set();
        intakeEditorResetSections = new Set();
        intakeEditorLoaded = true;
        renderIntakeEditorSection();
        loadCustomizeQuestions();
    } catch (err) {
        console.error('Intake form config load failed:', err);
        intakeEditorQuestions = [];
        intakeEditorDraft = {};
        INTAKE_EDITOR_SECTIONS.forEach(({ key }) => {
            intakeEditorDraft[key] = normalizeIntakeSection(key, null, DEFAULT_INTAKE_CONFIG[key]);
        });
        intakeEditorLoaded = true;
        renderIntakeEditorSection();
        loadCustomizeQuestions();
    }
}

async function saveIntakeFormConfig() {
    const payload = {
        questions: intakeEditorQuestions,
        mainConfig: buildIntakeEditorPayload(),
        deletedKeys: Array.from(intakeEditorResetSections)
    };

    try {
        const response = await fetch(`/api/agent/form-config?email=${encodeURIComponent(AGENT_EMAIL)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + TOKEN
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.message || 'Failed to save form config.');
        intakeEditorQuestions = normalizeCustomQuestions(json.questions);
        intakeEditorOriginalMainConfig = JSON.parse(JSON.stringify(payload.mainConfig));
        intakeEditorModifiedSections = new Set();
        intakeEditorResetSections = new Set();
        toast('Intake form updates saved.', 'ok');
        renderIntakeEditorSection();
        renderCustomizeQuestions();
    } catch (err) {
        console.error('Intake form config save failed:', err);
        toast(err.message || 'Failed to save intake form changes.', 'err');
    }
}

async function saveCustomizeQuestions() {
    const payload = {
        questions: intakeEditorQuestions,
        mainConfig: intakeEditorOriginalMainConfig,
        deletedKeys: []
    };
    try {
        const response = await fetch(`/api/agent/form-config?email=${encodeURIComponent(AGENT_EMAIL)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + TOKEN
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.message || 'Failed to save custom questions.');
        intakeEditorQuestions = normalizeCustomQuestions(json.questions);
        toast('Custom questions saved.', 'ok');
        renderCustomizeQuestions();
    } catch (err) {
        console.error('Custom questions save failed:', err);
        toast(err.message || 'Failed to save custom questions.', 'err');
    }
}

window.setIntakeEditorSection = setIntakeEditorSection;
window.updateIntakeSectionField = updateIntakeSectionField;
window.updateIntakeOption = updateIntakeOption;
window.addIntakeOption = addIntakeOption;
window.deleteIntakeOption = deleteIntakeOption;
window.moveIntakeOption = moveIntakeOption;
window.resetIntakeSection = resetIntakeSection;
window.saveIntakeFormConfig = saveIntakeFormConfig;
window.loadCustomizeQuestions = loadCustomizeQuestions;
window.addCustomizeQuestion = addCustomizeQuestion;
window.updateCustomizeQuestion = updateCustomizeQuestion;
window.toggleCustomizeQuestionRequired = toggleCustomizeQuestionRequired;
window.moveCustomizeQuestion = moveCustomizeQuestion;
window.removeCustomizeQuestion = removeCustomizeQuestion;
window.saveCustomizeQuestions = saveCustomizeQuestions;

// ── Init ──
window.addEventListener('DOMContentLoaded', () => {
    if (IS_AGENT) {
        document.getElementById('navAgents').style.display = 'none';
        const label = AGENT_EMAIL ? AGENT_EMAIL.split('@')[0] : 'Agent';
        document.getElementById('hName').textContent        = label;
        document.getElementById('hRole').textContent        = 'Agent';
        document.getElementById('avatar').textContent       = label[0].toUpperCase();
        document.getElementById('profileName').textContent  = label;
        document.getElementById('agentLinkBanner').style.display = 'flex';
        document.getElementById('agentFeedbackBanner').style.display = 'flex';
        document.getElementById('fbAgentsStat').style.display = 'none';
        document.getElementById('navCustom').style.display = 'flex';
        loadAgentLink();
        loadAgentFeedbackLink();
        showView('reports');
    } else {
        document.getElementById('hName').textContent       = 'Admin';
        document.getElementById('hRole').textContent       = 'Workspace';
        document.getElementById('avatar').textContent      = 'A';
        document.getElementById('profileName').textContent = 'Admin';
        showView('agents');
    }
    loadAll();
});

// ── Navigation ──
function showView(v) {
    ['agents','reports','custom','feedback'].forEach(id => {
        const card = document.getElementById('view' + id.charAt(0).toUpperCase() + id.slice(1));
        if (card) card.classList.toggle('active', id === v);
        const nav = document.getElementById('nav' + id.charAt(0).toUpperCase() + id.slice(1));
        if (nav && nav.style.display !== 'none') nav.classList.toggle('active', id === v);
    });
    if (v === 'custom') {
        loadIntakeFormConfig();
    }
    if (v === 'feedback' && !fbLoaded) {
        if (IS_AGENT) {
            loadAgentFeedback();
        } else {
            loadFeedback();
        }
    }
}

function logout() { localStorage.clear(); location.href = '/admin/login.html'; }

// ── Load all data ──
async function loadAll() {
    const H = { 'Authorization': 'Bearer ' + TOKEN };
    if (!IS_AGENT) {
        skeleton('agentsBody', 5, 5);
        try {
            const r = await fetch('/api/admin/agents', { headers: H });
            const j = await r.json();
            if (j.success) { allAgents = j.data; renderAgents(allAgents); }
            else tableError('agentsBody', 5, j.message);
        } catch { tableError('agentsBody', 5, 'Could not reach the server.'); }
    }
    skeleton('reportsBody', 8, 6);
    try {
        const url = IS_AGENT ? `/api/agent/leads?email=${encodeURIComponent(AGENT_EMAIL)}` : '/api/admin/leads';
        const r = await fetch(url, { headers: H });
        const j = await r.json();
        if (j.success) renderReports(j.data);
        else tableError('reportsBody', 8, j.message);
    } catch { tableError('reportsBody', 8, 'Could not reach the server.'); }
}

// ── Agent Feedback Link ──
async function loadAgentFeedbackLink() {
    try {
        const baseUrl = window.location.origin;
        const feedbackLink = `${baseUrl}/client/feedback.html?agent=${encodeURIComponent(AGENT_EMAIL)}`;
        document.getElementById('agentFeedbackLinkInput').value = feedbackLink;
    } catch {
        document.getElementById('agentFeedbackLinkInput').value = 'Could not load feedback link.';
    }
}

function copyAgentFeedbackLink() {
    const input = document.getElementById('agentFeedbackLinkInput');
    const btn   = document.getElementById('agentFeedbackCopyBtn');
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
        btn.textContent = 'Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy Link'; btn.classList.remove('copied'); }, 2000);
    });
}

// ══════════════════════════════════════
// FEEDBACK - ADMIN
// ══════════════════════════════════════
async function loadFeedback() {
    fbLoaded = true;
    const H = { 'Authorization': 'Bearer ' + TOKEN };
    const container = document.getElementById('fbGroups');

    container.innerHTML = `
        <div class="fb-sk"></div>
        <div class="fb-sk"></div>
        <div class="fb-sk"></div>`;
    ['fbTotal','fbAgents','fbMonth'].forEach(id => document.getElementById(id).textContent = '—');

    try {
        const r = await fetch('/api/admin/feedback', { headers: H });
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'Failed to load feedback.');
        allFeedback = j.data || [];
        renderFeedback(allFeedback);
    } catch (err) {
        container.innerHTML = `<div class="fb-empty" style="color:#EF4444">${esc(err.message)}</div>`;
    }
}

function renderStars(rating) {
    let stars = '';
    for (let i = 0; i < 5; i++) {
        if (i < Math.round(rating)) {
            stars += `<svg viewBox="0 0 24 24"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5"/></svg>`;
        } else {
            stars += `<svg viewBox="0 0 24 24" style="fill:#D1D5DB;stroke:#D1D5DB;"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5"/></svg>`;
        }
    }
    return stars;
}

function renderFeedback(list) {
    const container = document.getElementById('fbGroups');
    const now = new Date();

    const thisMonth = list.filter(f => {
        const d = new Date(f.submitted_at || f.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;

    const groups = {};
    list.forEach(f => {
        const key = f.agent_id || f.agent_email || 'unknown';
        if (!groups[key]) groups[key] = { name: f.agent_name || 'Unknown Agent', email: f.agent_email || '—', items: [] };
        groups[key].items.push(f);
    });
    const agentKeys = Object.keys(groups);

    document.getElementById('fbTotal').textContent  = list.length;
    document.getElementById('fbAgents').textContent = agentKeys.length;
    document.getElementById('fbMonth').textContent  = thisMonth;

    if (!list.length) {
        container.innerHTML = `
            <div class="fb-empty">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                No client feedback has been submitted yet.
            </div>`;
        return;
    }

    container.innerHTML = agentKeys.map((key, gi) => {
        const g   = groups[key];
        const col = COLORS[gi % COLORS.length];
        const ini = initials(g.name);
        return `
        <div class="fb-group" id="fbg-${gi}">
            <div class="fb-group-hd" onclick="toggleFbGroup(${gi})">
                <div class="fb-group-avatar ${col}">${ini}</div>
                <div class="fb-group-info">
                    <div class="fb-group-name">${esc(g.name)}</div>
                    <div class="fb-group-email">${esc(g.email)}</div>
                </div>
                <span class="fb-group-badge">${g.items.length} feedback</span>
                <svg class="fb-chevron" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
            <div class="fb-group-body">
                <table class="fb-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Ratings</th>
                            <th>Message</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${g.items.map(f => {
                            const date = (f.submitted_at || f.created_at)
                                ? new Date(f.submitted_at || f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—';
                            const avgRating = (f.overall_rating + f.service_rating + f.value_rating + f.recommend_rating) / 4;
                            return `<tr>
                                <td>
                                    <div style="font-weight:600">${esc(f.client_name || 'Client')}</div>
                                    <div class="sub-email">${esc(f.client_email || '')}</div>
                                </td>
                                <td>
                                    <div class="fb-stars">${renderStars(avgRating)}</div>
                                    <div style="font-size:11px;color:var(--muted);margin-top:2px;">
                                        Overall: ${f.overall_rating} ★ | Service: ${f.service_rating} ★ | Value: ${f.value_rating} ★ | Recommend: ${f.recommend_rating} ★
                                    </div>
                                </td>
                                <td><div class="fb-msg">${esc(f.message || f.feedback || '')}</div></td>
                                <td><div class="fb-date">${date}</div></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');
}

function toggleFbGroup(gi) {
    document.getElementById('fbg-' + gi).classList.toggle('collapsed');
}

// ══════════════════════════════════════
// FEEDBACK - AGENT
// ══════════════════════════════════════
async function loadAgentFeedback() {
    fbLoaded = true;
    const H = { 'Authorization': 'Bearer ' + TOKEN };
    const container = document.getElementById('fbGroups');
    
    container.innerHTML = `
        <div class="fb-sk"></div>
        <div class="fb-sk"></div>
        <div class="fb-sk"></div>`;
    ['fbTotal','fbAgents','fbMonth'].forEach(id => document.getElementById(id).textContent = '—');
    
    try {
        const r = await fetch(`/api/agent/feedback?email=${encodeURIComponent(AGENT_EMAIL)}`, { headers: H });
        const j = await r.json();
        if (!j.success) throw new Error(j.message || 'Failed to load feedback.');
        allFeedback = j.data || [];
        renderAgentFeedback(allFeedback);
    } catch (err) {
        container.innerHTML = `<div class="fb-empty" style="color:#EF4444">${esc(err.message)}</div>`;
    }
}

function renderAgentFeedback(list) {
    const container = document.getElementById('fbGroups');
    const now = new Date();
    
    const thisMonth = list.filter(f => {
        const d = new Date(f.submitted_at || f.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    
    document.getElementById('fbTotal').textContent = list.length;
    document.getElementById('fbAgents').textContent = '—';
    document.getElementById('fbMonth').textContent = thisMonth;
    
    if (!list.length) {
        container.innerHTML = `
            <div class="fb-empty">
                <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                No client feedback has been submitted yet.
            </div>`;
        return;
    }
    
    container.innerHTML = `
        <div class="fb-group">
            <div class="fb-group-hd" style="cursor:default">
                <div class="fb-group-avatar ${COLORS[0]}">${initials('Your Clients')}</div>
                <div class="fb-group-info">
                    <div class="fb-group-name">Your Client Feedback</div>
                    <div class="fb-group-email">${list.length} feedback messages</div>
                </div>
                <span class="fb-group-badge">${list.length}</span>
            </div>
            <div class="fb-group-body">
                <table class="fb-table">
                    <thead>
                        <tr>
                            <th>Client</th>
                            <th>Ratings</th>
                            <th>Message</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${list.map(f => {
                            const date = (f.submitted_at || f.created_at)
                                ? new Date(f.submitted_at || f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—';
                            const avgRating = (f.overall_rating + f.service_rating + f.value_rating + f.recommend_rating) / 4;
                            return `<tr>
                                <td>
                                    <div style="font-weight:600">${esc(f.client_name || 'Client')}</div>
                                    <div class="sub-email">${esc(f.client_email || '')}</div>
                                </td>
                                <td>
                                    <div class="fb-stars">${renderStars(avgRating)}</div>
                                    <div style="font-size:11px;color:var(--muted);margin-top:2px;">
                                        Overall: ${f.overall_rating} ★ | Service: ${f.service_rating} ★ | Value: ${f.value_rating} ★ | Recommend: ${f.recommend_rating} ★
                                    </div>
                                </td>
                                <td><div class="fb-msg">${esc(f.message || f.feedback || '')}</div></td>
                                <td><div class="fb-date">${date}</div></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
}

function refreshFeedback() {
    fbLoaded = false;
    if (IS_AGENT) {
        loadAgentFeedback();
    } else {
        loadFeedback();
    }
}

// ── Filter feedback ──
function filterFeedback() {
    const q = document.getElementById('fbSearch').value.toLowerCase().trim();
    if (!q) { 
        if (IS_AGENT) {
            renderAgentFeedback(allFeedback);
        } else {
            renderFeedback(allFeedback);
        }
        return; 
    }
    const filtered = allFeedback.filter(f =>
        (f.agent_name   || '').toLowerCase().includes(q) ||
        (f.agent_email  || '').toLowerCase().includes(q) ||
        (f.client_name  || '').toLowerCase().includes(q) ||
        (f.client_email || '').toLowerCase().includes(q) ||
        (f.message || f.feedback || '').toLowerCase().includes(q)
    );
    if (IS_AGENT) {
        renderAgentFeedback(filtered);
    } else {
        renderFeedback(filtered);
    }
}

// ── CSV Download ──
function downloadFeedbackCSV() {
    if (!allFeedback || allFeedback.length === 0) {
        toast('No feedback data to export.', 'err');
        return;
    }

    const headers = [
        'Client Name',
        'Client Email',
        'Agent Name',
        'Agent Email',
        'Overall Rating',
        'Service Rating',
        'Value Rating',
        'Recommend Rating',
        'Average Rating',
        'Continue Booking',
        'Message',
        'Date'
    ];

    const rows = allFeedback.map(f => {
        const avgRating = ((f.overall_rating || 0) + (f.service_rating || 0) + (f.value_rating || 0) + (f.recommend_rating || 0)) / 4;
        const date = f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '';
        return [
            `"${(f.client_name || '').replace(/"/g, '""')}"`,
            `"${(f.client_email || '').replace(/"/g, '""')}"`,
            `"${(f.agent_name || '').replace(/"/g, '""')}"`,
            `"${(f.agent_email || '').replace(/"/g, '""')}"`,
            f.overall_rating || 0,
            f.service_rating || 0,
            f.value_rating || 0,
            f.recommend_rating || 0,
            avgRating.toFixed(1),
            f.continue_booking || '',
            `"${(f.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${date}"`
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `feedback_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast('CSV downloaded successfully!', 'ok');
}

// ── Render agents ──
function renderAgents(list) {
    const tbody = document.getElementById('agentsBody');
    const count = document.getElementById('agentCount');
    const n = list.length;
    count.textContent = n > 0 ? `Showing 1 to ${n} of ${n} agent${n !== 1 ? 's' : ''}` : 'Showing 0 to 0 of 0 agents';
    if (!n) { tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No agents yet. Click "Add Agent" to create one.</td></tr>`; return; }
    tbody.innerHTML = list.map((a, i) => {
        const col = COLORS[i % COLORS.length];
        const ini = initials(a.name || 'AG');
        const cnt = typeof a.client_count === 'number' ? a.client_count : 0;
        const link = a.intakeLink || '';
        return `<tr>
            <td style="color:var(--muted)">${i + 1}</td>
            <td><div class="cell-person"><div class="circle ${col}">${ini}</div><div><strong>${esc(a.name)}</strong><div class="sub-email">${esc(a.email)}</div></div></div></td>
            <td><span class="count-pill">${cnt}</span></td>
            <td><div class="link-cell"><input type="text" id="link-input-${a.id}" value="${esc(link)}" readonly title="${esc(link)}"><button class="btn-copy-sm" id="link-btn-${a.id}" onclick="copyIntakeLink('${a.id}')">Copy</button></div></td>
            <td style="text-align:right">
                <button class="btn-del" id="del-${a.id}" onclick="deleteAgent('${a.id}','${esc(a.name)}')">
                    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Delete
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Render reports ──
function renderReports(list) {
    const tbody = document.getElementById('reportsBody');
    if (!list.length) { tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No pipeline reports compiled yet.</td></tr>`; return; }
    tbody.innerHTML = list.map((lead, i) => {
        const col    = COLORS[i % COLORS.length];
        const ini    = initials(lead.name || 'CL');
        const date   = lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        const tdate  = lead.travel_date || '—';
        let budget = '—';
        if (lead.budget) {
            const numBudget = parseFloat(lead.budget);
            if (!isNaN(numBudget) && numBudget > 0) {
                budget = `£${numBudget.toLocaleString()}`;
            } else {
                budget = lead.budget;
            }
        }
        const dest   = esc(lead.destination || lead.concept || '—');
        const st     = lead.status || 'new';
        const stClass = st === 'closed' ? 'badge-closed' : st === 'contacted' ? 'badge-contacted' : 'badge-new';
        const pdf    = lead.reportFile ? `/${lead.reportFile}#view` : null;
        
        return `<tr>
            <td style="color:var(--muted)">${i + 1}</td>
            <td><div class="cell-person"><div class="circle ${col}">${ini}</div><div><strong>${esc(lead.name || 'Client')}</strong><div class="sub-email">${esc(lead.email || '')}</div></div></div></td>
            <td>${dest}</td><td>${budget}</td><td>${esc(tdate)}</td>
            <td><span class="badge ${stClass}">${st}</span></td>
            <td style="color:var(--muted);font-size:13px">${date}</td>
            <td style="text-align:right">${pdf
                ? `<a href="${pdf}" target="_blank" class="btn-pdf"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></a>`
                : `<span style="color:#D1D5DB;font-size:12px">—</span>`}</td>
        </tr>`;
    }).join('');
}

// ── Agent link helpers ──
async function loadAgentLink() {
    try {
        const r = await fetch(`/api/agent/link?email=${encodeURIComponent(AGENT_EMAIL)}`, { headers: { 'Authorization': 'Bearer ' + TOKEN } });
        const j = await r.json();
        if (j.success) document.getElementById('agentLinkInput').value = j.link;
    } catch { document.getElementById('agentLinkInput').value = 'Could not load link.'; }
}
function copyAgentLink() {
    const input = document.getElementById('agentLinkInput');
    const btn   = document.getElementById('agentLinkCopyBtn');
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
        btn.textContent = 'Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy Link'; btn.classList.remove('copied'); }, 2000);
    });
}
function copyIntakeLink(agentId) {
    const input = document.getElementById(`link-input-${agentId}`);
    const btn   = document.getElementById(`link-btn-${agentId}`);
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => {
        btn.textContent = 'Copied!'; btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    });
}

// ── Delete agent ──
async function deleteAgent(id, name) {
    if (!confirm(`Remove agent "${name}"?\n\nAll their client records will also be deleted.`)) return;
    const btn = document.getElementById(`del-${id}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }
    try {
        const r = await fetch(`/api/admin/agents/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + TOKEN } });
        const j = await r.json();
        if (j.success) { toast(`Agent "${name}" removed.`, 'ok'); loadAll(); }
        else { toast(j.message || 'Failed to delete.', 'err'); if (btn) { btn.disabled = false; btn.textContent = 'Delete'; } }
    } catch { toast('Network error. Try again.', 'err'); if (btn) { btn.disabled = false; btn.textContent = 'Delete'; } }
}

// ── Modal ──
function openModal() {
    ['fName','fEmail','fPass','fPass2'].forEach(id => document.getElementById(id).value = '');
    const e = document.getElementById('modalErr');
    e.style.display = 'none'; e.textContent = '';
    document.getElementById('overlay').classList.add('open');
    setTimeout(() => document.getElementById('fName').focus(), 50);
}
function closeModal()    { document.getElementById('overlay').classList.remove('open'); }
function overlayClick(e) { if (e.target === document.getElementById('overlay')) closeModal(); }
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && document.getElementById('overlay').classList.contains('open')) saveAgent();
});

// ── Save agent ──
async function saveAgent() {
    const name  = document.getElementById('fName').value.trim();
    const email = document.getElementById('fEmail').value.trim();
    const pass  = document.getElementById('fPass').value;
    const pass2 = document.getElementById('fPass2').value;
    const errEl = document.getElementById('modalErr');
    const btn   = document.getElementById('saveBtn');
    const setErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';
    if (!name)                          return setErr('Full name is required.');
    if (!email || !email.includes('@')) return setErr('A valid email address is required.');
    if (!pass)                          return setErr('Password is required.');
    if (pass.length < 8)                return setErr('Password must be at least 8 characters.');
    if (pass !== pass2)                 return setErr('Passwords do not match.');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        const r = await fetch('/api/admin/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
            body: JSON.stringify({ name, email, password: pass })
        });
        const j = await r.json();
        if (j.success) { closeModal(); toast(`Agent "${name}" added! They can now log in.`, 'ok'); loadAll(); }
        else setErr(j.message || 'Failed to create agent.');
    } catch { setErr('Network error. Please try again.'); }
    finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Save Agent`;
    }
}
// ── Filter & sort ──
function togglePopover() { document.getElementById('popover').classList.toggle('open'); }
function applyFilter() {
    const val = document.querySelector('input[name="cf"]:checked')?.value || 'all';
    togglePopover();
    if (val === 'all') { renderAgents(allAgents); return; }
    const [lo, hi] = val === '51+' ? [51, Infinity] : val.split('-').map(Number);
    renderAgents(allAgents.filter(a => { const c = a.client_count || 0; return c >= lo && c <= hi; }));
}
function filterAgents() {
    const q = document.getElementById('agentSearch').value.toLowerCase();
    renderAgents(allAgents.filter(a => (a.name||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q)));
}
function toggleSort() {
    sortAsc = !sortAsc;
    renderAgents([...allAgents].sort((a,b) => sortAsc ? (a.name||'').localeCompare(b.name||'') : (b.name||'').localeCompare(a.name||'')));
}
function clearFilters() {
    document.getElementById('agentSearch').value = '';
    document.querySelector('input[name="cf"][value="all"]').checked = true;
    sortAsc = true;
    renderAgents(allAgents);
}
document.addEventListener('click', e => {
    const pop = document.getElementById('popover');
    if (pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('[onclick="togglePopover()"]'))
        pop.classList.remove('open');
});

// ── Helpers ──
function initials(name) { return name.trim().split(/\s+/).map(n=>n[0]).join('').substring(0,2).toUpperCase(); }
function esc(s) { if(!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toast(msg, type) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `show ${type}`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = '', 3800);
}
function skeleton(id, cols, rows) {
    document.getElementById(id).innerHTML = Array(rows).fill(0).map(() =>
        `<tr class="sk">${Array(cols).fill(0).map(()=>`<td><span></span></td>`).join('')}</tr>`
    ).join('');
}
function tableError(id, cols, msg) {
    document.getElementById(id).innerHTML = `<tr class="error-row"><td colspan="${cols}">${esc(msg)}</td></tr>`;
}
</script>
