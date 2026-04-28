import { db, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from './firebase.js';

// ... (Giữ nguyên các config ADMIN, DEFAULT_PAIRS, v.v...) ...
const ADMIN_LIST = ["admin", "minhtien45x3"];
const ADMIN_MASTER_PASS = "admin123";
let journalData = [], wikiData = [], libraryData = [], pairsData = [], quotePostersData = [];
let initialCapital = 20000;
let isAdmin = false;
let currentEntryImgBase64 = null, currentAnalysisTabImg = null, currentPracticeItem = null;
let chartInst = {};
let selectedAnalysisStrategy = null;
let currentFilter = 'all';

// ... (Giữ nguyên DEFAULT_WIKI, CRITERIA_LIST, QUOTES, safeSetText, init, startMarquee) ...
const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];
const DEFAULT_WIKI = [{ id: "1", code: "XH01", cat: "Setup", title: "Uptrend", image: "", content: "Higher Highs" }];
const CRITERIA_LIST = [
    { name: "1. XU HƯỚNG", desc: "Trend Market" }, { name: "2. CẢN (KEY LEVEL)", desc: "Support/Resistance" },
    { name: "3. TRENDLINE", desc: "Break/Retest" }, { name: "4. EMA", desc: "Dynamic S/R" },
    { name: "5. HỢP LƯU", desc: "Confluence" }, { name: "6. TÍN HIỆU NẾN", desc: "Rejection/Engulfing" },
    { name: "7. MÔ HÌNH GIÁ", desc: "Pattern" }, { name: "8. FIBONACCI", desc: "Golden Zone" },
    { name: "9. THỜI GIAN", desc: "Session/Timing" }, { name: "10. TỶ LỆ R:R", desc: "Risk Reward" }
];
const QUOTES = ["Hành trình vạn dặm bắt đầu bằng một bước chân.", "Kỷ luật là cầu nối giữa mục tiêu và thành tựu."];
const DEFAULT_QUOTE_POSTERS = [
    { id: "legend-1", title: "Kỷ luật trước lợi nhuận", author: "Paul Tudor Jones", quote: "Đừng tập trung vào việc kiếm tiền, hãy tập trung vào việc bảo vệ những gì bạn có.", image: "", theme: "emerald" },
    { id: "legend-2", title: "Cắt lỗ là kỹ năng sinh tồn", author: "Stanley Druckenmiller", quote: "Điều quan trọng không phải là đúng hay sai, mà là bạn kiếm được bao nhiêu khi đúng và mất bao nhiêu khi sai.", image: "", theme: "blue" },
    { id: "legend-3", title: "Chờ thời điểm chất lượng", author: "Jesse Livermore", quote: "Tiền lớn không nằm ở việc mua bán liên tục, mà nằm ở việc ngồi yên đúng lúc.", image: "", theme: "amber" }
];

const TRADER_MISTAKES = [
    { id: "fomo", name: "FOMO - Đuổi giá", symptom: "Mua khi giá đã chạy xa khỏi điểm mua chuẩn.", wrong: "Nhảy vào sau cây nến tăng mạnh vì sợ lỡ cơ hội.", right: "Chỉ mua khi có nền giá, điểm pivot rõ và R:R còn đủ hấp dẫn.", frequency: 86, impact: -34, fix: "Đặt quy tắc: nếu giá vượt điểm mua quá 5-7% thì bỏ qua, chờ nền mới." },
    { id: "no-stop", name: "Không cắt lỗ", symptom: "Biến lệnh sai thành khoản lỗ lớn.", wrong: "Hy vọng giá quay lại, bình quân giá xuống không có kế hoạch.", right: "Cắt lỗ theo mức đã định trước khi vào lệnh.", frequency: 78, impact: -48, fix: "Luôn nhập stop-loss trước khi bấm mua; rủi ro mỗi lệnh tối đa 0.5-1.5% NAV." },
    { id: "overtrade", name: "Giao dịch quá nhiều", symptom: "Vào lệnh vì buồn chán hoặc muốn gỡ nhanh.", wrong: "Ngày nào cũng tìm lý do để mua bán.", right: "Chỉ giao dịch khi setup đạt chuẩn và thị trường thuận lợi.", frequency: 72, impact: -29, fix: "Giới hạn số lệnh/ngày và checklist bắt buộc trước khi vào lệnh." },
    { id: "against-market", name: "Đánh ngược thị trường", symptom: "Mua mạnh khi thị trường đang phân phối/downtrend.", wrong: "Tin rằng cổ phiếu của mình sẽ đi ngược xu hướng chung.", right: "Ưu tiên tiền mặt khi VNI xấu, giảm size khi thị trường sideway.", frequency: 66, impact: -41, fix: "Theo dõi ngày phân phối, EMA50 của chỉ số và nhóm ngành dẫn dắt." },
    { id: "oversize", name: "Vào vị thế quá lớn", symptom: "Một lệnh sai làm tổn thương tâm lý và tài khoản.", wrong: "All-in vì quá tự tin vào một setup.", right: "Tính position sizing theo điểm cắt lỗ.", frequency: 61, impact: -45, fix: "Dùng công thức: Số tiền rủi ro / khoảng cách stop-loss." },
    { id: "sell-early", name: "Bán non cổ phiếu mạnh", symptom: "Chốt lời quá sớm vì sợ mất lãi.", wrong: "Thấy lãi nhỏ đã bán hết dù xu hướng vẫn khỏe.", right: "Bán theo quy tắc: một phần ở R:R, phần còn lại bám EMA/trailing stop.", frequency: 58, impact: -24, fix: "Tách lệnh thành 2 phần: bảo vệ vốn và để lãi chạy." },
    { id: "no-journal", name: "Không ghi nhật ký", symptom: "Lặp lại lỗi cũ vì không đo lường hành vi.", wrong: "Chỉ nhớ lệnh thắng, quên nguyên nhân lệnh thua.", right: "Ghi ảnh chart, lý do vào lệnh, cảm xúc, lỗi và bài học.", frequency: 54, impact: -22, fix: "Sau mỗi lệnh ghi 3 dòng: setup, lỗi, hành động sửa lần sau." }
];

const TRADER_DISCIPLINE_MODULES = [
    { id: "pretrade", icon: "shield-check", title: "Pre-Trade Gate", priority: "Bắt buộc", desc: "Khoá lệnh nếu chưa đủ điều kiện: xu hướng, điểm mua, R:R, stop-loss, tâm lý.", build: "Thêm checklist bắt buộc vào modal Nhật ký; chỉ bật nút Lưu khi đạt điểm tối thiểu." },
    { id: "setup-score", icon: "badge-check", title: "Trade Quality Score", priority: "Rất nên có", desc: "Chấm điểm A+/A/B/C/D cho mỗi lệnh theo setup, volume, keylevel, EMA50, market regime.", build: "Tự động tính điểm từ checklist Phân tích và lưu cùng Journal." },
    { id: "risk-guard", icon: "lock-keyhole", title: "Risk Guardrail", priority: "Bắt buộc", desc: "Cảnh báo khi risk/lệnh quá cao, vào vị thế quá lớn, hoặc drawdown vượt giới hạn.", build: "Liên kết vốn hiện tại, stop-loss và position sizing để cảnh báo trước khi đặt lệnh." },
    { id: "loss-autopsy", icon: "activity", title: "Loss Autopsy", priority: "Sau mỗi lệnh thua", desc: "Mổ xẻ lệnh thua: lỗi setup, lỗi timing, lỗi thị trường hay lỗi tâm lý.", build: "Khi chọn LOSS, mở form bắt buộc chọn nguyên nhân và bài học sửa." },
    { id: "mistake-heatmap", icon: "flame", title: "Mistake Heatmap", priority: "Hàng tuần", desc: "Thống kê lỗi nào lặp lại nhiều nhất và lỗi nào làm mất tiền nhiều nhất.", build: "Gắn tag lỗi vào Journal, sau đó vẽ heatmap theo tuần/tháng." },
    { id: "market-regime", icon: "bar-chart-3", title: "Market Regime Filter", priority: "Trước phiên", desc: "Xác định Uptrend / Sideway / Downtrend và số ngày phân phối để quyết định có được phép đánh không.", build: "Thêm tab Thị trường với trạng thái VNI, EMA50, ngày phân phối, nhóm ngành dẫn dắt." },
    { id: "playbook", icon: "book-open-check", title: "Setup Playbook Coach", priority: "Huấn luyện", desc: "So sánh lệnh thực tế với mẫu hình chuẩn: VCP, Cup with Handle, 3C, Tight Flag.", build: "Link ảnh lý thuyết từ Wiki với ảnh Journal, chấm mức giống/khác." },
    { id: "weekly-review", icon: "calendar-check", title: "Weekly Review Sprint", priority: "Cuối tuần", desc: "Tự động tổng kết tuần: lãi/lỗ, lỗi lặp lại, setup tốt nhất, hành động sửa tuần sau.", build: "Tạo báo cáo 1 trang từ Journal và Mistake Radar." }
];


function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

// --- CORE INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if(typeof initTheme === 'function') initTheme();
    if(window.lucide) lucide.createIcons();
    startMarquee();
    const hardEnterBtn = document.getElementById('btn-enter-system');
    if (hardEnterBtn) hardEnterBtn.addEventListener('click', (e) => { e.preventDefault(); window.enterSystem(); });
    const landing = document.getElementById('landing-page');
    if(landing) { landing.classList.remove('hidden'); document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-container').classList.add('hidden'); }
});
function startMarquee() { let idx = 0; safeSetText('dashboard-marquee', QUOTES[0]); setInterval(() => { idx = (idx + 1) % QUOTES.length; safeSetText('dashboard-marquee', QUOTES[idx]); }, 8000); }
function updateMarquee(text) { safeSetText('dashboard-marquee', text); }

// --- DATA LOAD ---
window.loadData = async function() {
    if (!window.currentUser) return;
    updateMarquee('Đang đồng bộ dữ liệu...');
    isAdmin = ADMIN_LIST.includes(window.currentUser);
    const adminBtn = document.getElementById('btn-admin-panel');
    if(adminBtn) adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    safeSetText('current-user-chip', window.currentUser || 'User');
    const roleChip = document.getElementById('role-chip');
    if(roleChip) {
        roleChip.innerText = isAdmin ? 'Admin' : 'Member';
        roleChip.className = isAdmin ? 'admin-role' : '';
    }
    try {
        const uRef = doc(db, 'users', window.currentUser);
        const uSnap = await getDoc(uRef);
        let legacyPosters = null;
        if (uSnap.exists()) {
            const d = uSnap.data();
            journalData = Array.isArray(d.journal) ? d.journal : [];
            pairsData = Array.isArray(d.pairs) && d.pairs.length ? d.pairs : DEFAULT_PAIRS;
            initialCapital = d.capital || 20000;
            legacyPosters = d.quotePosters || null;
        } else {
            await saveUserData();
        }

        const wSnap = await getDoc(doc(db, 'system', SYSTEM_MASTER_DOC.wiki));
        const wikiFallback = wSnap.exists() && Array.isArray(wSnap.data().items) ? wSnap.data().items : DEFAULT_WIKI;
        wikiData = await loadSystemItems('wiki', wikiFallback);

        const lSnap = await getDoc(doc(db, 'system', SYSTEM_MASTER_DOC.library));
        const libraryFallback = lSnap.exists() && Array.isArray(lSnap.data().items) ? lSnap.data().items : [];
        libraryData = await loadSystemItems('library', libraryFallback);

        const qRef = doc(db, 'system', 'quote_posters_master');
        const qSnap = await getDoc(qRef);
        quotePostersData = qSnap.exists() && Array.isArray(qSnap.data().items)
            ? qSnap.data().items
            : (Array.isArray(legacyPosters) && legacyPosters.length ? legacyPosters : DEFAULT_QUOTE_POSTERS);
        if (isAdmin && !qSnap.exists()) await saveQuotePostersData(false);
        initUI();
        safeSetText('dashboard-marquee', QUOTES[0]);
    } catch (e) {
        alert('Lỗi tải dữ liệu: ' + e.message);
        console.error(e);
    }
}

// --- BỘ LỌC LÀM SẠCH DỮ LIỆU TRƯỚC KHI LƯU ---
const sanitize = (data) => JSON.parse(JSON.stringify(data, (key, value) => {
    if (value === undefined) return null;
    if (typeof value === 'number' && Number.isNaN(value)) return null;
    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) return undefined;
    return value;
}));

const SYSTEM_ITEM_PREFIX = { wiki: 'wiki_item_', library: 'library_item_' };
const SYSTEM_INDEX_DOC = { wiki: 'wiki_items_index', library: 'library_items_index' };
const SYSTEM_MASTER_DOC = { wiki: 'wiki_master', library: 'library_master' };
const MAX_IMAGE_DATA_URL_CHARS = 760000;
let wikiImageProcessing = false;

function normalizeContentItem(raw = {}) {
    const id = (raw.id || Date.now()).toString();
    return {
        id,
        title: (raw.title || '').toString(),
        code: (raw.code || '').toString(),
        cat: (raw.cat || '').toString(),
        image: typeof raw.image === 'string' ? raw.image : '',
        content: (raw.content || '').toString(),
        updated_at: raw.updated_at || new Date().toISOString()
    };
}

function escapeHtml(value = '') {
    return value.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadSystemItems(mode, fallbackItems = []) {
    const prefix = SYSTEM_ITEM_PREFIX[mode];
    const loaded = [];
    try {
        const snap = await getDocs(collection(db, 'system'));
        snap.forEach(docSnap => {
            if (docSnap.id.startsWith(prefix)) {
                const data = docSnap.data() || {};
                loaded.push(normalizeContentItem({ ...data, id: data.id || docSnap.id.replace(prefix, '') }));
            }
        });
    } catch (error) {
        console.warn('Không đọc được item docs, dùng dữ liệu master nếu có', error);
    }
    if (loaded.length) {
        return loaded.sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi') || (a.title || '').localeCompare(b.title || '', 'vi'));
    }
    return Array.isArray(fallbackItems) ? fallbackItems.map(normalizeContentItem) : [];
}

async function saveSystemItems(mode, items) {
    if (!isAdmin) throw new Error('Chỉ Admin mới được lưu dữ liệu này.');
    const prefix = SYSTEM_ITEM_PREFIX[mode];
    const normalizedItems = (items || []).map(normalizeContentItem);
    await Promise.all(normalizedItems.map(item => {
        const cleanItem = sanitize({ ...item, updated_at: new Date().toISOString(), updated_by: window.currentUser || 'admin' });
        return setDoc(doc(db, 'system', `${prefix}${item.id}`), cleanItem, { merge: false });
    }));
    await setDoc(doc(db, 'system', SYSTEM_INDEX_DOC[mode]), {
        ids: normalizedItems.map(item => item.id),
        count: normalizedItems.length,
        last_updated: new Date().toISOString(),
        updated_by: window.currentUser || 'admin'
    }, { merge: true });
}

async function saveSystemItem(mode, item) {
    if (!isAdmin) throw new Error('Chỉ Admin mới được lưu dữ liệu này.');
    const prefix = SYSTEM_ITEM_PREFIX[mode];
    const cleanItem = sanitize({ ...normalizeContentItem(item), updated_at: new Date().toISOString(), updated_by: window.currentUser || 'admin' });
    await setDoc(doc(db, 'system', `${prefix}${cleanItem.id}`), cleanItem, { merge: false });
    await setDoc(doc(db, 'system', SYSTEM_INDEX_DOC[mode]), { last_updated: new Date().toISOString(), updated_by: window.currentUser || 'admin' }, { merge: true });
}

async function deleteSystemItem(mode, id) {
    if (!isAdmin) throw new Error('Chỉ Admin mới được xóa dữ liệu này.');
    await deleteDoc(doc(db, 'system', `${SYSTEM_ITEM_PREFIX[mode]}${id}`));
    await setDoc(doc(db, 'system', SYSTEM_INDEX_DOC[mode]), { last_updated: new Date().toISOString(), updated_by: window.currentUser || 'admin' }, { merge: true });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function imageToCanvasDataURL(img, maxWidth, maxHeight, quality) {
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
}

async function compressImageFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) throw new Error('File chọn vào không phải ảnh.');
    const originalUrl = await readFileAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Không đọc được ảnh. Hãy thử ảnh JPG/PNG khác.'));
        image.src = originalUrl;
    });
    const attempts = [
        { w: 1280, h: 820, q: 0.72 },
        { w: 1100, h: 720, q: 0.64 },
        { w: 900, h: 620, q: 0.56 },
        { w: 760, h: 520, q: 0.48 }
    ];
    let output = originalUrl;
    for (const a of attempts) {
        output = imageToCanvasDataURL(img, a.w, a.h, a.q);
        if (output.length <= MAX_IMAGE_DATA_URL_CHARS) break;
    }
    if (output.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error('Ảnh vẫn quá nặng sau khi nén. Hãy dùng ảnh dưới 500KB hoặc crop nhỏ hơn.');
    return output;
}


async function saveUserData() { 
    if(!window.currentUser) return; 
    await setDoc(doc(db, "users", window.currentUser), { 
        journal: sanitize(journalData), 
        pairs: sanitize(pairsData), 
        capital: initialCapital 
    }, { merge: true }); 
}

async function saveQuotePostersData(showToast = true) {
    if(!isAdmin) return alert("Chỉ Admin mới được quản lý Poster.");
    try {
        await setDoc(doc(db, "system", "quote_posters_master"), {
            items: sanitize(quotePostersData),
            last_updated: new Date().toISOString(),
            updated_by: window.currentUser || "admin"
        }, { merge: true });
        if(showToast) console.log("Đã lưu Poster hệ thống");
    } catch(error) {
        alert("🚨 LỖI LƯU POSTER:\n" + error.message);
        console.error(error);
    }
}

// Hàm lưu dữ liệu Wiki: bản v40.2 lưu từng Setup thành document riêng
async function saveWikiData() { 
    if(!isAdmin) return; 
    try {
        await saveSystemItems('wiki', wikiData);
        console.log('Đã lưu Wiki thành công');
    } catch (error) {
        alert('🚨 LỖI LƯU WIKI:\n' + error.message);
        console.error(error);
        throw error;
    }
}

// Hàm lưu dữ liệu Thư Viện: bản v40.2 lưu từng bài thành document riêng
async function saveLibraryData() { 
    if(!isAdmin) return; 
    try {
        await saveSystemItems('library', libraryData);
        console.log('Đã lưu Thư viện thành công');
    } catch (error) {
        alert('🚨 LỖI LƯU THƯ VIỆN:\n' + error.message);
        console.error(error);
        throw error;
    }
}

function initUI() {
    renderDashboard(); renderJournalList(); populateStrategies(); renderWikiGrid(); renderLibraryGrid(); renderPairsList(); renderPairSelects(); renderQuotePosters(); renderMistakesPreview(); renderMistakeCharts(); renderDisciplineModules();
    const cap = document.getElementById('real-init-capital'); if(cap) cap.value = initialCapital; updateCapitalCalc();
    // (Render Checklist - giữ nguyên)
    const checklistContainer = document.getElementById('ana-checklist-container');
    if(checklistContainer) { checklistContainer.innerHTML = CRITERIA_LIST.map(c => `<label class="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition"><input type="checkbox" class="accent-blue-500 w-5 h-5"><div><p class="text-xs font-bold">${c.name}</p><p class="text-[10px] opacity-70">${c.desc}</p></div></label>`).join(''); }
    const btnCreate = document.querySelector('#tab-wiki button[onclick^="openWikiEditor"]'); if(btnCreate) btnCreate.style.display = isAdmin ? 'flex' : 'none';
    const btnLib = document.querySelector('#tab-library button[onclick^="openWikiEditor"]'); if(btnLib) btnLib.style.display = isAdmin ? 'flex' : 'none';
    if(window.lucide) lucide.createIcons();
    loadRandomTraining(); // Khởi động tab Rèn Luyện lần đầu
}

// --- TRAINING LOGIC (Quiz Mode - Trắc Nghiệm) ---

let currentQuizCorrectItem = null; // Lưu đáp án đúng hiện tại

window.loadRandomTraining = function() {
    // 1. Lấy dữ liệu từ Thư Viện
    let allData = [...libraryData];
    const filterCat = document.getElementById('training-filter').value;
    
    // 2. Lọc dữ liệu
    if(filterCat !== 'all') {
        allData = allData.filter(item => item.cat && item.cat.toLowerCase().includes(filterCat.toLowerCase()));
    }

    // 3. Xử lý khi không có dữ liệu
    if(allData.length === 0) {
        document.getElementById('training-image').classList.add('hidden');
        document.getElementById('training-empty').classList.remove('hidden');
        document.getElementById('quiz-interface').classList.add('hidden');
        return;
    }

    // 4. Chọn đáp án ĐÚNG
    const randomIndex = Math.floor(Math.random() * allData.length);
    currentQuizCorrectItem = allData[randomIndex];

    // 5. Chọn 3 đáp án SAI ngẫu nhiên
    let wrongOptions = allData.filter(i => i.id !== currentQuizCorrectItem.id);
    // Nếu không đủ dữ liệu để làm đáp án sai, lấy trùng cũng được nhưng đổi title chút xíu (fallback)
    while (wrongOptions.length < 3) {
        wrongOptions.push({title: "Không xác định", id: "dummy"}); 
        if (wrongOptions.length >= 3) break; 
    }
    // Trộn và lấy 3 cái sai
    wrongOptions = wrongOptions.sort(() => 0.5 - Math.random()).slice(0, 3);

    // 6. Gộp Đúng + Sai và Trộn vị trí
    let quizOptions = [currentQuizCorrectItem, ...wrongOptions];
    quizOptions = quizOptions.sort(() => 0.5 - Math.random());

    // 7. Hiển thị UI
    document.getElementById('training-empty').classList.add('hidden');
    document.getElementById('training-image').src = currentQuizCorrectItem.image;
    document.getElementById('training-image').classList.remove('hidden');
    
    // Reset Panel kết quả
    document.getElementById('quiz-result-panel').classList.add('hidden');
    document.getElementById('quiz-interface').classList.remove('hidden');

    // Render nút bấm
    const grid = document.getElementById('quiz-options-grid');
    grid.innerHTML = quizOptions.map(opt => `
        <button onclick="checkQuizAnswer('${opt.id}')" 
                class="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl px-2 py-1 text-[11px] font-bold transition duration-200 hover:border-amber-500/50 hover:text-white truncate">
            ${opt.title || "Lựa chọn khác"}
        </button>
    `).join('');
}

// Hàm kiểm tra đáp án
window.checkQuizAnswer = function(selectedId) {
    const resultPanel = document.getElementById('quiz-result-panel');
    const statusTitle = document.getElementById('result-status');
    const contentText = document.getElementById('result-content');
    const titleText = document.getElementById('result-title');
    
    // Hiển thị panel kết quả
    resultPanel.classList.remove('hidden');
    
    if (selectedId === currentQuizCorrectItem.id) {
        // TRẢ LỜI ĐÚNG
        statusTitle.innerHTML = `<span class="text-emerald-500">CHÍNH XÁC! 🎉</span>`;
        // Hiệu ứng âm thanh hoặc rung nếu cần (option)
    } else {
        // TRẢ LỜI SAI
        statusTitle.innerHTML = `<span class="text-rose-500">SAI RỒI! 😅</span>`;
    }

    // Luôn hiện nội dung giải thích dù đúng hay sai để học
    titleText.innerText = currentQuizCorrectItem.title;
    contentText.innerHTML = currentQuizCorrectItem.content 
        ? currentQuizCorrectItem.content 
        : "<i class='text-slate-500'>Chưa có nội dung giải thích cho bài này.</i>";
}


// --- PRO DASHBOARD: QUOTE POSTERS + TRADER MISTAKES ---
const escapeHtml = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function updatePosterAccessUI() {
    const adminPanel = document.getElementById('poster-admin-panel');
    const readonlyNote = document.getElementById('poster-readonly-note');
    const badge = document.getElementById('poster-admin-badge');
    if(adminPanel) adminPanel.classList.toggle('hidden', !isAdmin);
    if(readonlyNote) readonlyNote.classList.toggle('hidden', isAdmin);
    if(badge) {
        badge.innerText = isAdmin ? 'Admin đang quản trị' : 'Chỉ Admin chỉnh sửa';
        badge.className = isAdmin ? 'admin-badge active' : 'admin-badge readonly';
    }
}

window.handlePosterUpload = function(input) {
    if (!isAdmin) {
        alert('Chỉ Admin mới được chèn hoặc thay ảnh poster.');
        if(input) input.value = '';
        return;
    }
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const imgData = e.target.result;
        const hidden = document.getElementById('poster-image-data');
        const preview = document.getElementById('poster-image-preview');
        const hint = document.getElementById('poster-upload-hint');
        if (hidden) hidden.value = imgData;
        if (preview) { preview.src = imgData; preview.classList.remove('hidden'); }
        if (hint) hint.classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
};

window.resetPosterForm = function() {
    ['poster-edit-id','poster-title','poster-author','poster-quote','poster-image-data'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const preview = document.getElementById('poster-image-preview');
    const hint = document.getElementById('poster-upload-hint');
    const saveBtn = document.getElementById('poster-save-btn');
    const cancelBtn = document.getElementById('poster-cancel-edit');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    if (hint) hint.classList.remove('hidden');
    if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Lưu poster';
    if (cancelBtn) cancelBtn.classList.add('hidden');
    if(window.lucide) lucide.createIcons();
};

window.addQuotePoster = function() {
    if(!isAdmin) return alert('Chỉ Admin mới được thêm hoặc chỉnh sửa Poster.');
    const editId = document.getElementById('poster-edit-id')?.value?.trim();
    const title = document.getElementById('poster-title')?.value?.trim() || 'Bài học giao dịch';
    const author = document.getElementById('poster-author')?.value?.trim() || 'Trader Legend';
    const quote = document.getElementById('poster-quote')?.value?.trim();
    const image = document.getElementById('poster-image-data')?.value || '';
    if (!quote && !image) return alert('Hãy nhập câu nói hoặc chọn ảnh poster trước khi lưu.');
    if(editId) {
        const idx = quotePostersData.findIndex(item => item.id === editId);
        if(idx !== -1) quotePostersData[idx] = { ...quotePostersData[idx], title, author, quote, image, updated_at: new Date().toISOString() };
    } else {
        quotePostersData.unshift({ id: Date.now().toString(), title, author, quote, image, theme: 'custom', created_at: new Date().toISOString() });
    }
    saveQuotePostersData();
    renderQuotePosters();
    window.resetPosterForm();
};

window.editQuotePoster = function(id) {
    if(!isAdmin) return alert('Chỉ Admin mới được sửa Poster.');
    const item = quotePostersData.find(x => x.id === id);
    if(!item) return;
    const setVal = (field, value) => { const el = document.getElementById(field); if(el) el.value = value || ''; };
    setVal('poster-edit-id', item.id);
    setVal('poster-title', item.title);
    setVal('poster-author', item.author);
    setVal('poster-quote', item.quote);
    setVal('poster-image-data', item.image);
    const preview = document.getElementById('poster-image-preview');
    const hint = document.getElementById('poster-upload-hint');
    const saveBtn = document.getElementById('poster-save-btn');
    const cancelBtn = document.getElementById('poster-cancel-edit');
    if(item.image && preview) { preview.src = item.image; preview.classList.remove('hidden'); if(hint) hint.classList.add('hidden'); }
    else { if(preview) preview.classList.add('hidden'); if(hint) hint.classList.remove('hidden'); }
    if(saveBtn) saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Cập nhật poster';
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    const panel = document.getElementById('poster-admin-panel');
    if(panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(window.lucide) lucide.createIcons();
};

window.deleteQuotePoster = function(id) {
    if(!isAdmin) return alert('Chỉ Admin mới được xóa Poster.');
    if (!confirm('Xóa poster/câu nói này?')) return;
    quotePostersData = quotePostersData.filter(item => item.id !== id);
    saveQuotePostersData();
    renderQuotePosters();
    window.resetPosterForm();
};

function renderQuotePosters() {
    updatePosterAccessUI();
    const grid = document.getElementById('quote-poster-grid');
    if (!grid) return;
    const items = quotePostersData && quotePostersData.length ? quotePostersData : DEFAULT_QUOTE_POSTERS;
    grid.innerHTML = items.map(item => `
        <article class="poster-card group">
            ${item.image ? `<img src="${item.image}" class="poster-card-img" onclick="viewImageFull('${item.image}')">` : `<div class="poster-card-placeholder"><i data-lucide="quote" class="w-10 h-10"></i></div>`}
            <div class="poster-card-overlay">
                <p class="poster-label">${escapeHtml(item.title || 'Trader Wisdom')}</p>
                <h4>“${escapeHtml(item.quote || 'Thêm ảnh hoặc câu nói để nhắc nhở bản thân mỗi ngày.')}”</h4>
                <div class="poster-footer">
                    <span>— ${escapeHtml(item.author || 'Legend')}</span>
                    ${isAdmin ? `<div class="poster-actions">
                        <button onclick="event.stopPropagation(); editQuotePoster('${item.id}')" class="poster-edit" title="Sửa"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                        <button onclick="event.stopPropagation(); deleteQuotePoster('${item.id}')" class="poster-delete" title="Xóa"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>` : ``}
                </div>
            </div>
        </article>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

function renderMistakesPreview() {
    const list = document.getElementById('mistakes-preview-list');
    if (list) {
        list.innerHTML = TRADER_MISTAKES.slice(0, 4).map((m, i) => `
            <button onclick="switchTab('mistakes'); showMistakeDetail('${m.id}')" class="mistake-mini-card">
                <span class="mistake-rank">${i + 1}</span>
                <span class="flex-1 text-left"><b>${escapeHtml(m.name)}</b><small>${escapeHtml(m.symptom)}</small></span>
                <span class="font-mono text-rose-400">${m.impact}%</span>
            </button>
        `).join('');
    }

    const grid = document.getElementById('mistake-card-grid');
    if (grid) {
        grid.innerHTML = TRADER_MISTAKES.map(m => `
            <button onclick="showMistakeDetail('${m.id}')" class="mistake-card-pro">
                <div class="flex justify-between items-start gap-3 mb-3">
                    <h3>${escapeHtml(m.name)}</h3>
                    <span>${m.frequency}%</span>
                </div>
                <p>${escapeHtml(m.symptom)}</p>
                <div class="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full bg-rose-500" style="width:${m.frequency}%"></div></div>
            </button>
        `).join('');
    }

    const body = document.getElementById('mistake-comparison-body');
    if (body) {
        body.innerHTML = TRADER_MISTAKES.map(m => `
            <tr>
                <td class="p-4 font-bold text-slate-200">${escapeHtml(m.name)}</td>
                <td class="p-4 text-rose-300">${escapeHtml(m.wrong)}</td>
                <td class="p-4 text-emerald-300">${escapeHtml(m.right)}</td>
                <td class="p-4 text-slate-300">${escapeHtml(m.fix)}</td>
            </tr>
        `).join('');
    }
    if (window.lucide) lucide.createIcons();
}

window.showMistakeDetail = function(id) {
    const m = TRADER_MISTAKES.find(x => x.id === id) || TRADER_MISTAKES[0];
    const panel = document.getElementById('mistake-detail-panel');
    if (!panel || !m) return;
    panel.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <div class="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center"><i data-lucide="alert-triangle" class="w-5 h-5 text-rose-400"></i></div>
            <div><p class="text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">Sai lầm cần sửa</p><h3 class="text-xl font-bold text-white">${escapeHtml(m.name)}</h3></div>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
            <div class="mistake-detail-box danger"><b>Cách làm sai</b><p>${escapeHtml(m.wrong)}</p></div>
            <div class="mistake-detail-box success"><b>Cách làm đúng</b><p>${escapeHtml(m.right)}</p></div>
        </div>
        <div class="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-slate-300"><b class="text-amber-300">Hành động sửa ngay:</b> ${escapeHtml(m.fix)}</div>
    `;
    if (window.lucide) lucide.createIcons();
};

function makeChart(canvasId, chartKey, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart) return;
    if (chartInst[chartKey]) { chartInst[chartKey].destroy(); chartInst[chartKey] = null; }
    chartInst[chartKey] = new Chart(canvas, config);
}

function renderMistakeCharts() {
    renderMistakesPreview();
    const labels = TRADER_MISTAKES.map(m => m.name.replace(' - ', '\n'));
    const frequency = TRADER_MISTAKES.map(m => m.frequency);
    const impact = TRADER_MISTAKES.map(m => Math.abs(m.impact));
    const commonOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.08)' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,.08)' } } } };

    makeChart('chart-mistake-preview', 'mistakePreview', {
        type: 'bar', data: { labels: TRADER_MISTAKES.slice(0,4).map(m => m.name), datasets: [{ data: TRADER_MISTAKES.slice(0,4).map(m => Math.abs(m.impact)), borderRadius: 12, backgroundColor: 'rgba(244,63,94,.65)' }] },
        options: { ...commonOptions, indexAxis: 'y' }
    });
    makeChart('chart-mistake-freq', 'mistakeFreq', {
        type: 'bar', data: { labels, datasets: [{ data: frequency, borderRadius: 12, backgroundColor: 'rgba(245,158,11,.65)' }] },
        options: commonOptions
    });
    makeChart('chart-mistake-impact', 'mistakeImpact', {
        type: 'line', data: { labels, datasets: [{ data: impact, tension: .35, borderColor: 'rgba(244,63,94,.95)', backgroundColor: 'rgba(244,63,94,.12)', fill: true, pointRadius: 4 }] },
        options: commonOptions
    });
    window.showMistakeDetail('fomo');
}


function renderDisciplineModules() {
    const grid = document.getElementById('discipline-module-grid');
    if(!grid) return;
    grid.innerHTML = TRADER_DISCIPLINE_MODULES.map((m, idx) => `
        <article class="discipline-card">
            <div class="discipline-icon"><i data-lucide="${m.icon}" class="w-5 h-5"></i></div>
            <div class="discipline-content">
                <div class="flex items-center justify-between gap-3"><h3>${escapeHtml(m.title)}</h3><span>${idx + 1}</span></div>
                <p>${escapeHtml(m.desc)}</p>
                <div class="discipline-meta"><b>${escapeHtml(m.priority)}</b></div>
                <small>${escapeHtml(m.build)}</small>
            </div>
        </article>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

window.filterWiki = function() {
    const q = (document.getElementById('wiki-search')?.value || '').toLowerCase();
    const grid = document.getElementById('wiki-grid');
    if (!grid) return;
    grid.innerHTML = wikiData.filter(i => [i.title, i.code, i.cat, i.content].join(' ').toLowerCase().includes(q)).map(i => `<div class="glass-panel p-4 cursor-pointer hover:bg-white/5" onclick="viewWikiDetail('${i.id}', 'wiki')"><div class="h-32 bg-black/20 rounded-lg mb-3 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><h4 class="font-bold text-sm truncate">${escapeHtml(i.title)}</h4><span class="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 mt-1 inline-block">${escapeHtml(i.code)}</span></div>`).join('');
};

window.filterLibrary = function() {
    const q = (document.getElementById('library-search')?.value || '').toLowerCase();
    const grid = document.getElementById('library-grid');
    if (!grid) return;
    grid.innerHTML = libraryData.filter(i => [i.title, i.code, i.cat, i.content].join(' ').toLowerCase().includes(q)).map(i => `<div class="glass-panel p-4 cursor-pointer hover:bg-white/5 border border-blue-500/20" onclick="viewWikiDetail('${i.id}', 'library')"><div class="h-32 bg-black/20 rounded-lg mb-3 overflow-hidden"><img src="${i.image}" class="w-full h-full object-cover"></div><h4 class="font-bold text-sm truncate text-blue-200">${escapeHtml(i.title)}</h4><span class="text-[10px] bg-blue-900/50 px-2 py-1 rounded text-blue-300 mt-1 inline-block">${escapeHtml(i.cat)}</span></div>`).join('');
};

window.showAdvice = function(type) {
    const advice = {
        fomo: ['🔥 FOMO: dừng lại 3 phút', 'Không vào lệnh khi tim đập nhanh và sợ lỡ cơ hội. Hãy hỏi: điểm mua còn hợp lệ không, stop-loss ở đâu, R:R còn đủ không?'],
        fear: ['😨 Sợ hãi: giảm quy mô', 'Nếu setup đúng nhưng bạn sợ, hãy giảm size. Nếu không biết vì sao vào lệnh, bỏ qua.'],
        revenge: ['😡 Muốn gỡ: đóng màn hình', 'Sau 2 lệnh thua liên tiếp, dừng giao dịch. Việc cần làm là ghi nhật ký, không phải trả thù thị trường.'],
        calm: ['🧘 Bình tâm: làm checklist', 'Khi cảm xúc ổn định, hãy giao dịch theo checklist: thị trường, cổ phiếu, setup, điểm mua, stop-loss, R:R.']
    };
    const [title, content] = advice[type] || advice.calm;
    const box = document.getElementById('psychology-advice-box');
    if (box) box.classList.remove('hidden');
    safeSetText('psy-advice-title', title);
    safeSetText('psy-advice-content', content);
};

// ... (Giữ nguyên các hàm AUTH, DASHBOARD, JOURNAL, PAIRS, MODAL khác của code cũ) ...
// (Đảm bảo copy đầy đủ các hàm authLogin, renderDashboard, renderJournalList... từ phiên bản trước)

window.__appLoaded = true;
window.enterSystem = function() {
    const landing = document.getElementById('landing-page');
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-container');
    if (landing) {
        landing.classList.add('hidden');
        landing.style.display = 'none';
        landing.style.pointerEvents = 'none';
    }
    if (app) {
        app.classList.add('hidden');
        app.classList.remove('flex');
        app.style.display = 'none';
    }
    if (auth) {
        auth.classList.remove('hidden');
        auth.classList.add('fade-in');
        auth.style.display = 'flex';
        auth.style.opacity = '1';
        auth.style.pointerEvents = 'auto';
    }
    const u = localStorage.getItem('min_sys_current_user');
    const loginInput = document.getElementById('login-user');
    if (u && loginInput) loginInput.value = u;
    setTimeout(() => { if (loginInput) loginInput.focus(); }, 50);
};
function showAuthScreen() { window.enterSystem(); }
window.authLogin = async function() { const u = document.getElementById('login-user').value.trim(); const p = document.getElementById('login-pass').value.trim(); if(!u || !p) return alert("Thiếu thông tin!"); try { const userDocRef = doc(db, "users", u); const snap = await getDoc(userDocRef); if(!snap.exists()) { if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) { await setDoc(userDocRef, { username:u, password:p, email:"admin@sys", status:"approved", journal:[], pairs:DEFAULT_PAIRS, capital:20000 }); alert("Đã tạo Admin!"); return; } return alert("Chưa có tài khoản!"); } const d = snap.data(); let passValid = (d.password === p); if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) passValid = true; if(!passValid) return alert("Sai mật khẩu!"); if(d.status === 'pending' && !ADMIN_LIST.includes(u)) return alert("Chờ duyệt!"); window.currentUser = u; localStorage.setItem('min_sys_current_user', u); document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('app-container').classList.remove('hidden'); document.getElementById('app-container').classList.add('flex'); window.loadData(); } catch(e) { alert("Lỗi: " + e.message); } }
window.authRegister = async function() { const u = document.getElementById('reg-user').value.trim(); const p = document.getElementById('reg-pass').value.trim(); const e = document.getElementById('reg-email').value.trim(); if(!u || !p) return; try { const snap = await getDoc(doc(db, "users", u)); if(snap.exists()) return alert("Tên tồn tại!"); await setDoc(doc(db, "users", u), { username:u, password:p, email:e, status: ADMIN_LIST.includes(u) ? 'approved':'pending', journal:[], pairs:DEFAULT_PAIRS, capital:20000, created_at:new Date().toISOString() }); alert("Đăng ký thành công!"); window.toggleAuth(); } catch(e) { alert("Lỗi: "+e.message); } }
window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }
window.renderDashboard = function() { if(!journalData) return; const closed = journalData.filter(t=>t.status!=='OPEN'); let wins=0, pnl=0, maxDD=0, peak=initialCapital, bal=initialCapital, monthStats = {}, patternStats = {}; closed.forEach(t=>{ const v = parseFloat(t.pnl); pnl+=v; bal+=v; if(t.status==='WIN') wins++; if(bal > peak) peak = bal; const dd = peak > 0 ? (peak - bal)/peak : 0; if(dd > maxDD) maxDD = dd; const parts = t.date.split('/'); if(parts.length === 3) { const mKey = `${parts[1]}/${parts[2]}`; if(!monthStats[mKey]) monthStats[mKey] = {total:0, win:0, loss:0, pnl:0}; monthStats[mKey].total++; monthStats[mKey].pnl += v; if(t.status==='WIN') monthStats[mKey].win++; else if(t.status==='LOSS') monthStats[mKey].loss++; } const strat = t.strategy || "Unknown"; if(!patternStats[strat]) patternStats[strat] = {pnl:0, win:0, total:0}; patternStats[strat].pnl += v; patternStats[strat].total++; if(t.status==='WIN') patternStats[strat].win++; }); safeSetText('dash-balance', `$${bal.toLocaleString()}`); safeSetText('dash-pnl', `$${pnl.toLocaleString()}`); safeSetText('dash-winrate', `${closed.length ? Math.round((wins/closed.length)*100) : 0}%`); safeSetText('dash-dd', `${(maxDD*100).toFixed(2)}%`); const mBody = document.getElementById('stats-monthly-body'); if(mBody) mBody.innerHTML = Object.entries(monthStats).sort((a,b) => { const [m1, y1] = a[0].split('/'); const [m2, y2] = b[0].split('/'); return new Date(y2, m2) - new Date(y1, m1); }).map(([k,v]) => `<tr class="border-b dark:border-slate-800"><td class="p-3 font-bold text-slate-500">${k}</td><td class="p-3 text-center">${v.total}</td><td class="p-3 text-center text-green-500 font-bold">${v.win}</td><td class="p-3 text-center text-red-500 font-bold">${v.loss}</td><td class="p-3 text-right font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="5" class="p-4 text-center text-slate-500">Trống</td></tr>'; const pBody = document.getElementById('stats-pattern-body'); if(pBody) pBody.innerHTML = Object.entries(patternStats).sort((a,b) => b[1].pnl - a[1].pnl).map(([k,v], i) => `<div class="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-800 rounded-lg"><div class="flex items-center gap-3"><span class="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i===0?'bg-yellow-500 text-black':'bg-slate-300 text-slate-600'}">${i+1}</span><div><p class="text-sm font-bold truncate w-32">${k}</p><p class="text-[10px] text-slate-500">${v.win}/${v.total} wins</p></div></div><span class="font-mono font-bold ${v.pnl>=0?'text-green-500':'text-red-500'}">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</span></div>`).join('') || '<div class="text-center text-slate-500">Trống</div>'; renderCharts(closed, initialCapital); renderQuotePosters(); renderMistakesPreview(); renderMistakeCharts(); renderDisciplineModules(); }
window.renderCharts = function(data, start) { const ctx1=document.getElementById('chart-equity'); const ctx2=document.getElementById('chart-winloss'); if(chartInst.eq) { chartInst.eq.destroy(); chartInst.eq = null; } if(chartInst.wl) { chartInst.wl.destroy(); chartInst.wl = null; } if(ctx1 && window.Chart) { let b = start; const pts = [start, ...data.map(t=>b+=parseFloat(t.pnl))]; chartInst.eq = new Chart(ctx1, {type:'line', data:{labels:pts.map((_,i)=>i), datasets:[{data:pts, borderColor:'#10b981', fill:true, backgroundColor:'rgba(16,185,129,0.1)', tension:0.4}]}, options:{plugins:{legend:false}, scales:{x:{display:false}, y:{grid:{color:'rgba(255,255,255,0.05)'}}}}}); } if(ctx2 && window.Chart) { let w=0, l=0; data.forEach(t=>t.status==='WIN'?w++:l++); chartInst.wl = new Chart(ctx2, {type:'doughnut', data:{labels:['Win','Loss'], datasets:[{data:[w,l], backgroundColor:['#10b981','#ef4444'], borderWidth:0}]}, options:{cutout:'70%', plugins:{legend:{position:'right', labels:{color:'#94a3b8'}}}}}); } }
window.openWikiEditor = function(id = null, mode = 'wiki') {
    if (!isAdmin) return alert('Chỉ Admin!');
    wikiImageProcessing = false;
    const modal = document.getElementById('wiki-editor-modal');
    if(modal) modal.classList.remove('hidden');
    document.getElementById('edit-mode').value = mode;
    document.getElementById('wiki-editor-title').innerText = mode === 'wiki' ? 'Editor: Setup' : 'Editor: Thư Viện';
    const dataSource = mode === 'wiki' ? wikiData : libraryData;
    const cats = [...new Set(dataSource.map(i => i.cat).filter(Boolean))];
    const dl = document.getElementById('cat-suggestions');
    if(dl) dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join('');
    const imgPreview = document.getElementById('wiki-image-preview');
    const uploadHint = document.getElementById('wiki-upload-hint');
    const imgInput = document.getElementById('edit-image-url');
    const fileInput = document.getElementById('wiki-file-input');
    if(fileInput) fileInput.value = '';
    const setImagePreview = (src = '') => {
        imgInput.value = src || '';
        if (src) {
            imgPreview.src = src;
            imgPreview.classList.remove('hidden');
            if(uploadHint) uploadHint.classList.add('hidden');
        } else {
            imgPreview.removeAttribute('src');
            imgPreview.classList.add('hidden');
            if(uploadHint) uploadHint.classList.remove('hidden');
        }
    };
    if (id) {
        const i = dataSource.find(x => x.id == id);
        if (i) {
            document.getElementById('edit-id').value = i.id;
            document.getElementById('edit-title').value = i.title || '';
            document.getElementById('edit-code').value = i.code || '';
            document.getElementById('edit-cat').value = i.cat || '';
            document.getElementById('edit-content').value = i.content || '';
            setImagePreview(i.image || '');
        }
    } else {
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-title').value = '';
        document.getElementById('edit-code').value = '';
        document.getElementById('edit-cat').value = '';
        document.getElementById('edit-content').value = '';
        setImagePreview('');
    }
    if(window.lucide) lucide.createIcons();
}

window.handleWikiImageUpload = async function(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    wikiImageProcessing = true;
    const imgPreview = document.getElementById('wiki-image-preview');
    const uploadHint = document.getElementById('wiki-upload-hint');
    try {
        if(uploadHint) {
            uploadHint.classList.remove('hidden');
            uploadHint.innerHTML = `<p class="text-sm font-bold text-amber-400">Đang nén ảnh...</p><p class="text-[10px] text-slate-500 mt-1">Vui lòng đợi trước khi bấm lưu</p>`;
        }
        const dataUrl = await compressImageFile(file);
        document.getElementById('edit-image-url').value = dataUrl;
        imgPreview.src = dataUrl;
        imgPreview.classList.remove('hidden');
        if(uploadHint) {
            uploadHint.classList.add('hidden');
            uploadHint.innerHTML = `<div class="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition"><i data-lucide="image-plus" class="w-5 h-5"></i></div><p class="text-sm font-bold text-slate-400">Bấm để chọn ảnh</p>`;
        }
        if(window.lucide) lucide.createIcons();
    } catch (error) {
        alert('Không thay được ảnh:\n' + error.message);
        console.error(error);
    } finally {
        wikiImageProcessing = false;
        input.value = '';
    }
}

window.saveWiki = async function() {
    if (!isAdmin) return alert('Chỉ Admin!');
    if (wikiImageProcessing) return alert('Ảnh đang được nén. Vui lòng đợi vài giây rồi bấm lưu lại.');
    const id = document.getElementById('edit-id').value || Date.now().toString();
    const mode = document.getElementById('edit-mode').value === 'library' ? 'library' : 'wiki';
    const item = normalizeContentItem({
        id,
        title: document.getElementById('edit-title').value,
        code: document.getElementById('edit-code').value,
        cat: document.getElementById('edit-cat').value,
        image: document.getElementById('edit-image-url').value,
        content: document.getElementById('edit-content').value
    });
    if (!item.code || !item.title) return alert('Nhập đủ Mã và Tiêu đề!');
    try {
        await saveSystemItem(mode, item);
        if (mode === 'wiki') {
            const idx = wikiData.findIndex(x => x.id == id);
            if (idx !== -1) wikiData[idx] = item; else wikiData.push(item);
            renderWikiGrid();
            populateStrategies();
        } else {
            const idx = libraryData.findIndex(x => x.id == id);
            if (idx !== -1) libraryData[idx] = item; else libraryData.push(item);
            renderLibraryGrid();
        }
        window.closeModal('wiki-editor-modal');
        alert('Đã lưu thành công. Ảnh mới đã được cập nhật.');
    } catch (error) {
        alert('🚨 LỖI LƯU DỮ LIỆU:\n' + error.message + '\n\nGợi ý: dùng ảnh nhẹ hơn hoặc kiểm tra Firestore Rules cho collection system.');
        console.error(error);
    }
}

window.renderWikiGrid = function() {
    const grid = document.getElementById('wiki-grid');
    if(!grid) return;
    grid.innerHTML = wikiData.map(i => `
        <div class="content-card p-4 cursor-pointer" onclick="viewWikiDetail('${i.id}', 'wiki')">
            <div class="h-32 content-thumb rounded-xl mb-3 overflow-hidden flex items-center justify-center bg-slate-950/60">
                ${i.image ? `<img src="${i.image}" class="w-full h-full object-cover" onerror="this.outerHTML='<span class=&quot;text-[10px] text-slate-500&quot;>Ảnh lỗi / quá nặng</span>'">` : `<span class="text-[10px] text-slate-500">Chưa có ảnh</span>`}
            </div>
            <h4 class="font-bold text-sm truncate">${escapeHtml(i.title)}</h4>
            <span class="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 mt-1 inline-block">${escapeHtml(i.code)}</span>
        </div>
    `).join('');
}

window.renderLibraryGrid = function() {
    const grid = document.getElementById('library-grid');
    if(!grid) return;
    grid.innerHTML = libraryData.map(i => `
        <div class="content-card p-4 cursor-pointer border border-blue-500/20" onclick="viewWikiDetail('${i.id}', 'library')">
            <div class="h-32 content-thumb rounded-xl mb-3 overflow-hidden flex items-center justify-center bg-slate-950/60">
                ${i.image ? `<img src="${i.image}" class="w-full h-full object-cover" onerror="this.outerHTML='<span class=&quot;text-[10px] text-slate-500&quot;>Ảnh lỗi / quá nặng</span>'">` : `<span class="text-[10px] text-slate-500">Chưa có ảnh</span>`}
            </div>
            <h4 class="font-bold text-sm truncate text-blue-200">${escapeHtml(i.title)}</h4>
            <span class="text-[10px] bg-blue-900/50 px-2 py-1 rounded text-blue-300 mt-1 inline-block">${escapeHtml(i.cat || i.code)}</span>
        </div>
    `).join('');
}

window.viewWikiDetail = function(id, mode = 'wiki') {
    const dataSource = mode === 'wiki' ? wikiData : libraryData;
    const i = dataSource.find(x => x.id == id);
    if(!i) return;
    document.getElementById('view-title').innerText = i.title || '';
    const viewImg = document.getElementById('view-image');
    if(viewImg) viewImg.src = i.image || '';
    document.getElementById('view-content').innerText = i.content || '';
    const btnEdit = document.getElementById('btn-edit-entry');
    const btnDel = document.getElementById('btn-delete-entry');
    if(isAdmin) {
        btnEdit.style.display='inline-block';
        btnDel.style.display='inline-block';
        const ne = btnEdit.cloneNode(true);
        const nd = btnDel.cloneNode(true);
        btnEdit.parentNode.replaceChild(ne, btnEdit);
        btnDel.parentNode.replaceChild(nd, btnDel);
        ne.onclick = () => { window.closeModal('wiki-detail-modal'); window.openWikiEditor(id, mode); };
        nd.onclick = async () => {
            if(!confirm('Xóa mục này?')) return;
            try {
                await deleteSystemItem(mode, id);
                if(mode === 'wiki') { wikiData = wikiData.filter(x => x.id != id); renderWikiGrid(); populateStrategies(); }
                else { libraryData = libraryData.filter(x => x.id != id); renderLibraryGrid(); }
                window.closeModal('wiki-detail-modal');
            } catch(error) {
                alert('Không xóa được:\n' + error.message);
                console.error(error);
            }
        };
    } else {
        btnEdit.style.display='none';
        btnDel.style.display='none';
    }
    document.getElementById('wiki-detail-modal').classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
}

window.openAdminPanel = async () => { document.getElementById('admin-modal').classList.remove('hidden'); const tb = document.getElementById('admin-user-list'); tb.innerHTML = 'Loading...'; const s = await getDocs(collection(db, "users")); let h = ''; s.forEach(d => { const u = d.data(); const delBtn = u.username===window.currentUser ? '' : `<button onclick="deleteUser('${u.username}')" class="text-red-500 ml-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`; const appBtn = u.status==='pending' ? `<button onclick="approveUser('${u.username}')" class="bg-green-600 px-2 py-1 rounded text-xs">Duyệt</button>` : `<span class="text-green-500 text-xs">Duyệt</span>`; h += `<tr><td class="p-3">${u.username}</td><td class="p-3 text-right">${appBtn} ${delBtn}</td></tr>`; }); tb.innerHTML = h || 'Trống'; if(window.lucide) lucide.createIcons(); }
window.approveUser = async (u) => { if(confirm("Duyệt?")) { await updateDoc(doc(db,"users",u),{status:'approved'}); window.openAdminPanel(); } }
window.deleteUser = async (u) => { if(confirm("Xóa vĩnh viễn?")) { await deleteDoc(doc(db,"users",u)); window.openAdminPanel(); } }
window.selectAnalysisStrategy = function(id) { const item = wikiData.find(x=>x.id==id); if(item) { selectedAnalysisStrategy=item; document.getElementById('current-setup-name').innerText=item.title; document.getElementById('ana-theory-img').src=item.image; document.getElementById('ana-theory-content').innerText=item.content; document.getElementById('analysis-empty-state').classList.add('hidden'); } }
window.handleAnalysisUpload = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('ana-real-img').src=e.target.result; document.getElementById('ana-real-img').classList.remove('hidden'); document.getElementById('ana-upload-hint').classList.add('hidden'); currentAnalysisTabImg=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.transferAnalysisToJournal = function() { if(!selectedAnalysisStrategy) return alert("Chọn Setup trước!"); window.switchTab('journal'); window.openEntryModal(); if(currentAnalysisTabImg) { currentEntryImgBase64=currentAnalysisTabImg; document.getElementById('entry-img-preview').src=currentAnalysisTabImg; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); } }
window.openEntryModal = function() { document.getElementById('entry-modal').classList.remove('hidden'); const now=new Date(); document.getElementById('inp-date').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().split('T')[0]; if(!currentEntryImgBase64) { document.getElementById('entry-img-preview').classList.add('hidden'); document.getElementById('entry-upload-hint').classList.remove('hidden'); } calcRiskPreview(); }
window.handleEntryImage = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('entry-img-preview').src=e.target.result; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); currentEntryImgBase64=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.saveEntry = function() { const d = document.getElementById('inp-date').value.split('-'); const dateStr = `${d[2]}/${d[1]}/${d[0]}`; const p = parseFloat(document.getElementById('inp-risk').value)||0; const mode = document.getElementById('inp-risk-mode').value; const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,''); const curBal = parseFloat(curBalText) || initialCapital; const riskUSD = mode === '%' ? curBal * (p/100) : p; journalData.unshift({ id:Date.now().toString(), date:dateStr, pair: document.getElementById('inp-pair').value, dir: document.getElementById('inp-dir').value, strategy: document.getElementById('inp-strategy').value, session: document.getElementById('inp-session').value, risk: riskUSD.toFixed(2), rr: document.getElementById('inp-rr').value, status:'OPEN', pnl:0, note: document.getElementById('inp-note').value, image: currentEntryImgBase64 }); saveUserData(); renderJournalList(); renderDashboard(); window.closeModal('entry-modal'); currentEntryImgBase64 = null; }
window.deleteEntry = (id) => { if(confirm('Xóa?')) { journalData=journalData.filter(x=>x.id!=id); saveUserData(); renderJournalList(); renderDashboard(); } }
window.renderPairsList = function() { const el = document.getElementById('pairs-list-container'); if(el) el.innerHTML = pairsData.map(p => `<div class="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-sm font-bold">${p} <button onclick="removePair('${p}')" class="text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button></div>`).join(''); if(window.lucide) lucide.createIcons(); }
window.addNewPair = function() { const el = document.getElementById('new-pair-input'); const val = el.value.trim().toUpperCase(); if(val && !pairsData.includes(val)) { pairsData.push(val); saveUserData(); renderPairsList(); renderPairSelects(); } el.value = ""; }
window.removePair = function(val) { if(confirm('Xóa?')) { pairsData = pairsData.filter(p => p !== val); saveUserData(); renderPairsList(); renderPairSelects(); } }
window.renderPairSelects = function() { const h = pairsData.map(p=>`<option value="${p}">${p}</option>`).join(''); const aiSel = document.getElementById('ai-pair-input'); const inpSel = document.getElementById('inp-pair'); if(aiSel) aiSel.innerHTML=h; if(inpSel) inpSel.innerHTML=h; }
window.updateDailyPnL = function() { const today = new Date().toLocaleDateString('vi-VN'); const pnl = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0); safeSetText('journal-pnl-today', (pnl >= 0 ? '+' : '') + `$${pnl.toLocaleString()}`); }
window.renderJournalList = function() { const list = document.getElementById('journal-list'); if (!list) return; list.innerHTML = journalData.map(t => `<tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group"><td class="p-4"><div class="font-bold text-slate-600 dark:text-slate-300 text-xs">${t.date}</div><div class="text-[10px] uppercase text-slate-400 font-bold tracking-wider">${t.session || 'SESSION'}</div></td><td class="p-4 font-bold text-sm"><span class="${t.dir === 'BUY' ? 'text-green-500' : 'text-red-500'}">${t.dir}</span> <span class="text-slate-800 dark:text-slate-200">${t.pair}</span></td><td class="p-4 text-center">${t.image ? `<div class="w-10 h-10 rounded-lg overflow-hidden mx-auto border border-slate-200 dark:border-slate-700 cursor-zoom-in hover:scale-110 transition shadow-sm" onclick="viewImageFull('${t.image}')"><img src="${t.image}" class="w-full h-full object-cover"></div>` : '<span class="text-slate-300 text-xs">-</span>'}</td><td class="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">${t.strategy}</td><td class="p-4 text-center text-xs font-mono text-slate-500">1:${t.rr}</td><td class="p-4 text-center"><select onchange="updateEntryStatus('${t.id}', this.value)" class="bg-transparent text-xs font-bold outline-none cursor-pointer text-center border border-slate-200 dark:border-slate-700 rounded py-1 px-2 shadow-sm focus:border-blue-500 transition ${t.status === 'WIN' ? 'text-green-500' : t.status === 'LOSS' ? 'text-red-500' : 'text-blue-500'}"><option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''} class="text-blue-500 bg-white dark:bg-slate-900">OPEN</option><option value="WIN" ${t.status === 'WIN' ? 'selected' : ''} class="text-green-500 bg-white dark:bg-slate-900">WIN</option><option value="LOSS" ${t.status === 'LOSS' ? 'selected' : ''} class="text-red-500 bg-white dark:bg-slate-900">LOSS</option></select></td><td class="p-4 text-right font-mono font-bold ${parseFloat(t.pnl) > 0 ? 'text-green-500' : parseFloat(t.pnl) < 0 ? 'text-red-500' : 'text-slate-400'}">${parseFloat(t.pnl) > 0 ? '+' : ''}${parseFloat(t.pnl).toLocaleString()}</td><td class="p-4 text-center"><button onclick="deleteEntry('${t.id}')" class="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td></tr>`).join(''); updateDailyPnL(); if(window.lucide) lucide.createIcons(); }
window.updateEntryStatus = function(id, status) { const idx = journalData.findIndex(e => e.id.toString() === id.toString()); if(idx !== -1) { journalData[idx].status = status; const r = parseFloat(journalData[idx].risk); const rr = parseFloat(journalData[idx].rr); if(status === 'WIN') journalData[idx].pnl = r * rr; else if(status === 'LOSS') journalData[idx].pnl = -r; else journalData[idx].pnl = 0; saveUserData(); renderJournalList(); renderDashboard(); } }
window.populateStrategies = () => { document.getElementById('strategy-list-container').innerHTML = wikiData.map(w=>`<div class="p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800" onclick="selectAnalysisStrategy('${w.id}')"><p class="font-bold text-sm">${w.code}</p><p class="text-xs opacity-70 truncate">${w.title}</p></div>`).join(''); document.getElementById('inp-strategy').innerHTML = wikiData.map(w=>`<option value="${w.code}">${w.code} - ${w.title}</option>`).join(''); };
window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = () => { const v=parseFloat(document.getElementById('inp-risk').value)||0; const mode=document.getElementById('inp-risk-mode').value; const rr=parseFloat(document.getElementById('inp-rr').value)||0; const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,''); const curBal = parseFloat(curBalText) || initialCapital; const r = mode==='%'? curBal*(v/100) : v; }
window.saveInitialCapital = () => { initialCapital = parseFloat(document.getElementById('real-init-capital').value)||20000; saveUserData(); renderDashboard(); alert("Đã lưu!"); };
window.updateCapitalCalc = () => { const start = parseFloat(document.getElementById('cap-sim-start').value)||0; const pct = parseFloat(document.getElementById('cap-risk-pct').value)||1; const rr = parseFloat(document.getElementById('cap-rr').value)||2; const n = 20; let bal = start, html = ''; for(let i=1; i<=n; i++) { const risk = bal*(pct/100); const profit = risk*rr; const end = bal+profit; html += `<tr class="border-b border-slate-200 dark:border-slate-800"><td class="p-2 text-center">${i}</td><td class="p-2 text-right">$${Math.round(bal).toLocaleString()}</td><td class="p-2 text-right text-rose-500 text-xs">-$${Math.round(risk).toLocaleString()}</td><td class="p-2 text-right text-emerald-500 font-bold">+$${Math.round(profit).toLocaleString()}</td><td class="p-3 text-right font-bold">$${Math.round(end).toLocaleString()}</td></tr>`; bal = end; } document.getElementById('cap-projection-list').innerHTML = html; }
// --- MINIMAL THEME: bỏ Morphil / blob / gradient config ---
window.openBgModal = () => alert('Bản v39 đã bỏ cấu hình Morphil. Giao diện chỉ còn Dark/Light tối giản.');
window.setBackground = () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.body.className = `text-slate-800 dark:text-slate-200 min-h-screen flex flex-col overflow-hidden ${isDark ? 'bg-theme-default' : 'bg-slate-50'}`;
};

window.initTheme = () => { 
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if(isDark) document.documentElement.classList.add('dark'); 
    else document.documentElement.classList.remove('dark');
    document.body.className = `text-slate-800 dark:text-slate-200 min-h-screen flex flex-col overflow-hidden ${isDark ? 'bg-theme-default' : 'bg-slate-50'}`;
    const btn = document.getElementById('theme-toggle-btn');
    if(btn) btn.innerHTML = isDark ? `<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>` : `<i data-lucide="moon" class="w-5 h-5 text-slate-600"></i>`;
    if(window.lucide) lucide.createIcons();
};

window.closeModal = (id) => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); };
window.switchTab = (id) => { 
    document.querySelectorAll('main > div').forEach(e=>e.classList.add('hidden')); 
    const tab = document.getElementById('tab-'+id); 
    if(tab) tab.classList.remove('hidden');
    document.querySelectorAll('[data-tab-btn]').forEach(btn => btn.classList.toggle('active', btn.dataset.tabBtn === id));
    if(id==='dashboard') renderDashboard(); 
    if(id==='mistakes') { renderMistakesPreview(); setTimeout(renderMistakeCharts, 50); }
    if(id==='discipline') renderDisciplineModules();
    if(window.lucide) lucide.createIcons(); 
};

window.toggleTheme = () => { 
    document.documentElement.classList.toggle('dark'); 
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    window.setBackground();
    const btn = document.getElementById('theme-toggle-btn');
    if(btn) btn.innerHTML = isDark ? `<i data-lucide="sun" class="w-5 h-5 text-yellow-400"></i>` : `<i data-lucide="moon" class="w-5 h-5 text-slate-600"></i>`;
    if(window.lucide) lucide.createIcons();
    if (typeof renderCharts === 'function' && typeof journalData !== 'undefined') {
        renderCharts(journalData.filter(t=>t.status!=='OPEN'), initialCapital);
        renderMistakeCharts();
    }
};
