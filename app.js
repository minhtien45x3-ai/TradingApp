import { db, doc, getDoc, setDoc } from './firebase.js';

// --- CONFIG ---
const GEMINI_API_KEY = "AIzaSyDN0i4GycJc-_-7wNMEePkNCa185nwHh6E";
const DEFAULT_WIKI = [
    { id: "XH01", code: "XH01", cat: "Xu Hướng", title: "Uptrend & Downtrend", image: "https://placehold.co/800x400/1e293b/10b981?text=XuHuong", content: "Đỉnh sau cao hơn đỉnh trước (HH), đáy sau cao hơn đáy trước (HL)." },
    { id: "BB02", code: "BB02", cat: "Setup", title: "Bounce Breakout", image: "https://placehold.co/800x400/1e293b/10b981?text=Setup", content: "Mua khi giá quay lại test vùng phá vỡ (Retest)." }
];
const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];
const CRITERIA_LIST = [
    { name: "1. XU HƯỚNG", desc: "Cấu trúc rõ ràng" }, { name: "2. KEYLEVEL", desc: "Phản ứng tại cản" },
    { name: "3. TRENDLINE", desc: "Tôn trọng/Phá vỡ" }, { name: "4. EMA 50", desc: "Vị trí giá" },
    { name: "5. HỢP QUY", desc: "Nhiều yếu tố" }, { name: "6. TÍN HIỆU", desc: "Nến đảo chiều" },
    { name: "7. MÔ HÌNH", desc: "Biểu đồ giá" }, { name: "8. FIBONACCI", desc: "Vùng vàng" },
    { name: "9. THỜI GIAN", desc: "Đóng nến" }, { name: "10. R:R", desc: "Tỷ lệ tốt" }
];

// --- STATE ---
let journalData = [], wikiData = [], pairsData = [];
let initialCapital = 20000;
let currentBgTheme = 'bg-theme-default';
let currentFilter = 'all';
let currentAnalysisImageBase64 = null;
let currentEntryImgBase64 = null;
let currentAnalysisTabImg = null;
let selectedAnalysisStrategy = null;
let chartInstances = {};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    lucide.createIcons();
    const storedUser = localStorage.getItem('min_sys_current_user');
    if (storedUser) document.getElementById('login-user').value = storedUser;
});

// --- CORE ---
window.loadData = async function() {
    if (!window.currentUser) return;
    try {
        const userRef = doc(db, "users", window.currentUser);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            journalData = data.journal || [];
            pairsData = data.pairs || DEFAULT_PAIRS;
            initialCapital = data.capital || 20000;
            if (data.background) window.setBackground(data.background, false);
        } else { await saveUserData(); }

        const wikiRef = doc(db, "system", "wiki_master");
        const wikiSnap = await getDoc(wikiRef);
        wikiData = wikiSnap.exists() ? wikiSnap.data().items : DEFAULT_WIKI;
        if (!wikiSnap.exists()) await saveWikiData();

        initUI();
    } catch (e) { alert("Lỗi tải: " + e.message); }
}

async function saveUserData() {
    if (!window.currentUser) return;
    await setDoc(doc(db, "users", window.currentUser), {
        journal: journalData, pairs: pairsData, capital: initialCapital,
        background: currentBgTheme, last_updated: new Date().toISOString()
    }, { merge: true });
}

async function saveWikiData() {
    await setDoc(doc(db, "system", "wiki_master"), { items: wikiData, last_updated: new Date().toISOString() }, { merge: true });
}

function initUI() {
    renderWikiGrid(); renderCategoryFilters(); renderDashboard();
    populateStrategies(); renderPairSelects(); renderJournalList();
    const capInput = document.getElementById('real-init-capital');
    const simStart = document.getElementById('cap-sim-start');
    if (capInput) capInput.value = initialCapital;
    if (simStart) simStart.value = initialCapital;
    updateCapitalCalc();
    lucide.createIcons();
}

// --- DASHBOARD ANALYTICS (ADVANCED) ---
window.renderDashboard = function() {
    // 1. Basic Stats
    const closedTrades = journalData.filter(t => t.status !== 'OPEN').sort((a, b) => a.id - b.id);
    let wins = 0, totalPnl = 0;
    
    // 2. Advanced Stats Variables
    let maxDrawdown = 0, peakCapital = initialCapital, currentEquity = initialCapital;
    let currentLossStreak = 0, maxLossStreak = 0;
    let strategyPerformance = {}; // { 'Strategy A': {profit: 0, loss: 0} }
    let monthlyStats = {}; // { '10/2023': {total:0, win:0, loss:0, pnl:0} }

    // 3. Loop Calculation
    closedTrades.forEach(t => {
        const pnl = parseFloat(t.pnl);
        totalPnl += pnl;
        currentEquity += pnl;

        // Winrate
        if (t.status === 'WIN') wins++;

        // Max Drawdown (Peak to Valley)
        if (currentEquity > peakCapital) peakCapital = currentEquity;
        const drawdown = (peakCapital - currentEquity) / peakCapital;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        // Max Consecutive Loss
        if (t.status === 'LOSS') {
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        } else if (t.status === 'WIN') {
            currentLossStreak = 0;
        }

        // Strategy Performance
        if (!strategyPerformance[t.strategy]) strategyPerformance[t.strategy] = 0;
        strategyPerformance[t.strategy] += pnl;

        // Monthly Stats
        // Date format assumed: dd/mm/yyyy
        const parts = t.date.split('/');
        const monthKey = `${parts[1]}/${parts[2]}`; // mm/yyyy
        if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { total: 0, win: 0, loss: 0, pnl: 0 };
        monthlyStats[monthKey].total++;
        monthlyStats[monthKey].pnl += pnl;
        if (t.status === 'WIN') monthlyStats[monthKey].win++;
        if (t.status === 'LOSS') monthlyStats[monthKey].loss++;
    });

    // 4. Update UI - Basic
    const balance = initialCapital + totalPnl;
    const winRate = closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0;
    document.getElementById('dash-balance').innerText = `$${balance.toLocaleString()}`;
    document.getElementById('header-balance').innerText = `$${balance.toLocaleString()}`;
    document.getElementById('dash-winrate').innerText = `${winRate}%`;
    document.getElementById('dash-total').innerText = `${closedTrades.length} Lệnh`;
    document.getElementById('dash-pnl').innerText = `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`;
    document.getElementById('dash-dd').innerText = `${(maxDrawdown * 100).toFixed(2)}%`;
    document.getElementById('dash-max-loss-streak').innerText = `Chuỗi thua: ${maxLossStreak}`;

    // 5. Update UI - Best/Worst Pattern
    let bestStrat = { name: '-', val: -Infinity }, worstStrat = { name: '-', val: Infinity };
    for (const [name, val] of Object.entries(strategyPerformance)) {
        if (val > bestStrat.val) bestStrat = { name, val };
        if (val < worstStrat.val) worstStrat = { name, val };
    }
    document.getElementById('stat-best-pattern').innerText = bestStrat.name;
    document.getElementById('stat-best-pnl').innerText = bestStrat.val > -Infinity ? `$${bestStrat.val.toFixed(0)}` : '$0';
    document.getElementById('stat-best-pnl').className = "font-mono font-bold text-emerald-500";
    
    document.getElementById('stat-worst-pattern').innerText = worstStrat.name;
    document.getElementById('stat-worst-pnl').innerText = worstStrat.val < Infinity ? `$${worstStrat.val.toFixed(0)}` : '$0';
    
    // 6. Update UI - Monthly Table
    const monthHtml = Object.entries(monthlyStats)
        .sort((a, b) => { // Sort by date descending
            const [m1, y1] = a[0].split('/'); const [m2, y2] = b[0].split('/');
            return new Date(y2, m2 - 1) - new Date(y1, m1 - 1);
        })
        .map(([key, data]) => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                <td class="p-2 font-bold">${key}</td>
                <td class="p-2 text-center">${data.total}</td>
                <td class="p-2 text-center text-emerald-500 font-bold">${data.win}</td>
                <td class="p-2 text-center text-rose-500 font-bold">${data.loss}</td>
                <td class="p-2 text-right font-mono font-bold ${data.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${data.pnl >= 0 ? '+' : ''}$${data.pnl.toLocaleString()}</td>
            </tr>
        `).join('');
    document.getElementById('stats-monthly-body').innerHTML = monthHtml || '<tr><td colspan="5" class="p-4 text-center text-slate-400">Chưa có dữ liệu</td></tr>';

    // 7. Update Marquee
    const marqueeText = ` Balance: $${balance.toLocaleString()} | PnL: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()} | Winrate: ${winRate}% | Max DD: ${(maxDrawdown * 100).toFixed(2)}% | Best: ${bestStrat.name} ($${bestStrat.val > -Infinity ? bestStrat.val : 0}) | Streak Loss: ${maxLossStreak} `;
    document.getElementById('dashboard-marquee').innerText = marqueeText;

    renderCharts(closedTrades, initialCapital);
}

window.renderCharts = function(data, startCap) {
    const ctxEquity = document.getElementById('chart-equity');
    const ctxWinLoss = document.getElementById('chart-winloss');
    
    if(ctxEquity && window.Chart) {
        let bal = startCap;
        const points = [startCap, ...data.map(t => bal += parseFloat(t.pnl))];
        if(chartInstances.eq) chartInstances.eq.destroy();
        chartInstances.eq = new Chart(ctxEquity, {
            type: 'line',
            data: { labels: points.map((_,i) => i), datasets: [{ label: 'Vốn', data: points, borderColor: '#10b981', tension: 0.2, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }] },
            options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false } } }
        });
    }
    if(ctxWinLoss && window.Chart) {
        let win = 0, loss = 0;
        data.forEach(t => t.status === 'WIN' ? win++ : loss++);
        if(chartInstances.wl) chartInstances.wl.destroy();
        chartInstances.wl = new Chart(ctxWinLoss, {
            type: 'doughnut',
            data: { labels: ['Win', 'Loss'], datasets: [{ data: [win, loss], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 0 }] },
            options: { maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });
    }
}

// --- ANALYSIS LOGIC ---
window.selectAnalysisStrategy = function(id) {
    const item = wikiData.find(x => x.id.toString() === id.toString());
    if(!item) return;
    selectedAnalysisStrategy = item;
    document.getElementById('current-setup-name').innerText = item.title;
    document.getElementById('ana-theory-img').src = item.image;
    document.getElementById('ana-theory-content').innerText = item.content;
    document.getElementById('analysis-empty-state').classList.add('hidden');
    document.getElementById('ana-checklist-container').innerHTML = CRITERIA_LIST.map(c => `
        <label class="flex items-center gap-2 p-2 rounded bg-slate-200 dark:bg-slate-800 cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition">
            <input type="checkbox" class="accent-emerald-500 w-4 h-4"><div><p class="text-xs font-bold text-slate-700 dark:text-slate-200">${c.name}</p><p class="text-[10px] text-slate-500">${c.desc}</p></div>
        </label>`).join('');
}
window.handleAnalysisUpload = function(input) {
    if (input.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('ana-real-img').src = e.target.result;
            document.getElementById('ana-real-img').classList.remove('hidden');
            document.getElementById('ana-upload-hint').classList.add('hidden');
            currentAnalysisTabImg = e.target.result;
        };
        r.readAsDataURL(input.files[0]);
    }
}
window.transferAnalysisToJournal = function() {
    if(!selectedAnalysisStrategy) return alert("Chưa chọn chiến lược!");
    window.switchTab('journal');
    window.openEntryModal();
    const stratSelect = document.getElementById('inp-strategy');
    for(let i=0; i<stratSelect.options.length; i++){
        if(stratSelect.options[i].text.includes(selectedAnalysisStrategy.code)){ stratSelect.selectedIndex = i; break; }
    }
    if(currentAnalysisTabImg) {
        currentEntryImgBase64 = currentAnalysisTabImg;
        const img = document.getElementById('entry-img-preview');
        img.src = currentAnalysisTabImg;
        img.classList.remove('hidden');
        document.getElementById('entry-upload-hint').classList.add('hidden');
    }
}

// --- AI LOGIC ---
async function callGeminiAPI(prompt, imageBase64) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const parts = [{ text: prompt }];
    if (imageBase64) parts.push({ inlineData: { mimeType: "image/png", data: imageBase64.split(',')[1] } });
    try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "API Error");
        return data.candidates[0].content.parts[0].text;
    } catch (e) { throw e; }
}
window.handleAIUpload = function(input) {
    if (input.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('ai-preview-img').src = e.target.result;
            document.getElementById('ai-preview-img').classList.remove('hidden');
            document.getElementById('ai-upload-placeholder').classList.add('hidden');
            currentAnalysisImageBase64 = e.target.result;
        };
        r.readAsDataURL(input.files[0]);
    }
}
window.runAIAnalysis = async function() {
    if(!currentAnalysisImageBase64) return alert("Chọn ảnh!");
    const btn = document.getElementById('btn-ai-analyze');
    const org = btn.innerHTML; btn.innerHTML = "Đang xử lý..."; btn.disabled = true;
    const pair = document.getElementById('ai-pair-input').value;
    const prompt = `Phân tích ${pair}. Trả về JSON: { "pattern_name": "Tên (TV)", "score": 85, "conclusion": "Nội dung (Markdown)" }`;
    try {
        const txt = await callGeminiAPI(prompt, currentAnalysisImageBase64);
        const json = JSON.parse(txt.replace(/```json/g, '').replace(/```/g, '').trim());
        document.getElementById('ai-res-pattern').innerText = json.pattern_name;
        document.getElementById('ai-res-score').innerText = json.score + "%";
        document.getElementById('ai-res-conclusion').innerHTML = marked.parse(json.conclusion);
        document.getElementById('ai-result-empty').classList.add('hidden');
        document.getElementById('ai-result-content').classList.remove('hidden');
    } catch (e) { alert("Lỗi: " + e.message); }
    btn.innerHTML = org; btn.disabled = false;
}
window.resetAI = function() {
    document.getElementById('ai-result-content').classList.add('hidden');
    document.getElementById('ai-result-empty').classList.remove('hidden');
    currentAnalysisImageBase64 = null;
    document.getElementById('ai-preview-img').classList.add('hidden');
    document.getElementById('ai-upload-placeholder').classList.remove('hidden');
}

// --- CAPITAL ---
window.saveInitialCapital = function() {
    const val = parseFloat(document.getElementById('real-init-capital').value);
    if(isNaN(val)) return;
    initialCapital = val; saveUserData(); renderDashboard();
    document.getElementById('cap-sim-start').value = val; updateCapitalCalc();
    alert("Đã lưu!");
}
window.updateCapitalCalc = function() {
    const start = parseFloat(document.getElementById('cap-sim-start').value) || 0;
    const pct = parseFloat(document.getElementById('cap-risk-pct').value) || 1;
    const rr = parseFloat(document.getElementById('cap-rr').value) || 2;
    const n = parseInt(document.getElementById('cap-sim-count').value) || 20;
    let bal = start, html = '';
    for(let i=1; i<=n; i++) {
        const risk = bal * (pct/100); const profit = risk * rr; const end = bal + profit;
        html += `<tr class="border-b dark:border-slate-800"><td class="p-3 text-center">${i}</td><td class="p-3 text-right">$${Math.round(bal).toLocaleString()}</td><td class="p-3 text-right text-rose-500 text-xs">-$${Math.round(risk).toLocaleString()}</td><td class="p-3 text-right text-emerald-500 font-bold">+$${Math.round(profit).toLocaleString()}</td><td class="p-3 text-right font-bold">$${Math.round(end).toLocaleString()}</td></tr>`;
        bal = end;
    }
    document.getElementById('cap-projection-list').innerHTML = html;
}

// --- JOURNAL ---
window.openEntryModal = function() { 
    document.getElementById('entry-modal').classList.remove('hidden');
    if(!currentEntryImgBase64) {
        document.getElementById('entry-img-preview').classList.add('hidden');
        document.getElementById('entry-upload-hint').classList.remove('hidden');
        document.getElementById('inp-note').value = "";
    }
    calcRiskPreview();
}
window.handleEntryImage = function(input) {
    if (input.files[0]) {
        const r = new FileReader();
        r.onload = (e) => {
            document.getElementById('entry-img-preview').src = e.target.result;
            document.getElementById('entry-img-preview').classList.remove('hidden');
            document.getElementById('entry-upload-hint').classList.add('hidden');
            currentEntryImgBase64 = e.target.result;
        };
        r.readAsDataURL(input.files[0]);
    }
}
window.saveEntry = function() {
    const pair = document.getElementById('inp-pair').value;
    const strat = document.getElementById('inp-strategy').value;
    const riskVal = parseFloat(document.getElementById('inp-risk').value);
    const rr = parseFloat(document.getElementById('inp-rr').value);
    if(!pair) return alert("Chọn cặp tiền!");
    const riskUSD = document.getElementById('inp-risk-mode').value === '%' ? getCurrentBalance() * (riskVal/100) : riskVal;
    
    journalData.unshift({
        id: Date.now().toString(), date: new Date().toLocaleDateString('vi-VN'),
        pair, dir: document.getElementById('inp-dir').value, session: document.getElementById('inp-session').value,
        strategy: strat, risk: riskUSD.toFixed(2), rr, status: 'OPEN', pnl: 0,
        note: document.getElementById('inp-note').value, image: currentEntryImgBase64
    });
    saveUserData(); renderJournalList(); renderDashboard();
    window.closeModal('entry-modal');
    currentEntryImgBase64 = null;
}
window.updateEntryStatus = function(id, status) {
    const idx = journalData.findIndex(e => e.id.toString() === id.toString());
    if(idx !== -1) {
        journalData[idx].status = status;
        const r = parseFloat(journalData[idx].risk);
        if(status === 'WIN') journalData[idx].pnl = r * parseFloat(journalData[idx].rr);
        else if(status === 'LOSS') journalData[idx].pnl = -r;
        else journalData[idx].pnl = 0;
        saveUserData(); renderJournalList(); renderDashboard();
    }
}
window.deleteEntry = function(id) {
    if(confirm('Xóa?')) { journalData = journalData.filter(e => e.id.toString() !== id.toString()); saveUserData(); renderJournalList(); renderDashboard(); }
}
window.renderJournalList = function() {
    const list = document.getElementById('journal-list');
    list.innerHTML = journalData.map(t => `
        <tr class="border-b border-slate-200 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 group">
            <td class="p-4 text-center text-xs text-slate-500"><div>${t.date}</div><div>${t.session}</div></td>
            <td class="p-4 text-center">${t.image ? `<div class="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer mx-auto" onclick="viewImageFull('${t.image}')"><img src="${t.image}" class="w-full h-full object-cover"></div>` : '-'}</td>
            <td class="p-4 text-center font-bold text-slate-800 dark:text-white">${t.pair} <span class="block text-[10px] ${t.dir==='BUY'?'text-emerald-500':'text-rose-500'} font-extrabold">${t.dir}</span></td>
            <td class="p-4 text-center text-xs text-slate-500 truncate max-w-[120px]">${t.strategy}</td>
            <td class="p-4 text-center text-xs font-mono text-slate-600 dark:text-slate-300">-$${t.risk} | 1:${t.rr}</td>
            <td class="p-4 text-center"><select onchange="updateEntryStatus('${t.id}', this.value)" class="bg-transparent text-xs font-bold outline-none cursor-pointer ${t.status==='WIN'?'text-emerald-500':t.status==='LOSS'?'text-rose-500':'text-blue-500'} text-center border rounded border-slate-200 dark:border-slate-700 p-1"><option value="OPEN" ${t.status==='OPEN'?'selected':''}>OPEN</option><option value="WIN" ${t.status==='WIN'?'selected':''}>WIN</option><option value="LOSS" ${t.status==='LOSS'?'selected':''}>LOSS</option></select></td>
            <td class="p-4 text-right font-bold ${parseFloat(t.pnl)>0?'text-emerald-500':parseFloat(t.pnl)<0?'text-rose-500':'text-slate-500'} font-mono">${parseFloat(t.pnl)>0?'+':''}${parseFloat(t.pnl).toLocaleString()}</td>
            <td class="p-4 text-center"><button onclick="deleteEntry('${t.id}')" class="text-slate-400 hover:text-rose-500 opacity-50 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>
        </tr>`).join('');
    lucide.createIcons();
    updateDailyPnL();
}
function updateDailyPnL() {
    const today = new Date().toLocaleDateString('vi-VN');
    const pnl = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0);
    const el = document.getElementById('journal-pnl-today');
    if(el) { el.innerText = (pnl >= 0 ? '+' : '') + `$${pnl.toFixed(2)}`; el.className = `text-sm font-mono font-bold ${pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`; }
}

// --- WIKI & UTILS ---
// (Wiki logic giữ nguyên như cũ, chỉ rút gọn để hiển thị)
window.openWikiEditor = function(id = null) {
    const cats = [...new Set(wikiData.map(i => i.cat))];
    document.getElementById('cat-suggestions').innerHTML = cats.map(c => `<option value="${c}">`).join('');
    if(id) {
        const item = wikiData.find(i => i.id.toString() === id.toString());
        document.getElementById('wiki-editor-title').innerText = "Sửa Wiki";
        document.getElementById('edit-id').value = item.id;
        document.getElementById('edit-code').value = item.code;
        document.getElementById('edit-cat').value = item.cat;
        document.getElementById('edit-title').value = item.title;
        document.getElementById('edit-image-url').value = item.image;
        document.getElementById('edit-content').value = item.content;
        window.previewImage(item.image);
    } else {
        document.getElementById('wiki-editor-title').innerText = "Thêm Wiki";
        document.getElementById('edit-id').value = "";
        document.getElementById('edit-code').value = "";
        document.getElementById('edit-cat').value = "";
        document.getElementById('edit-title').value = "";
        document.getElementById('edit-image-url').value = "";
        document.getElementById('edit-content').value = "";
        window.previewImage("");
    }
    document.getElementById('wiki-editor-modal').classList.remove('hidden');
}
window.saveWiki = function() {
    const id = document.getElementById('edit-id').value || Date.now().toString();
    const item = {
        id, code: document.getElementById('edit-code').value, cat: document.getElementById('edit-cat').value,
        title: document.getElementById('edit-title').value, image: document.getElementById('edit-image-url').value,
        content: document.getElementById('edit-content').value
    };
    if(!item.code || !item.title) return alert("Điền đủ thông tin!");
    const idx = wikiData.findIndex(i => i.id.toString() === id.toString());
    if(idx !== -1) wikiData[idx] = item; else wikiData.push(item);
    saveWikiData(); renderWikiGrid(); populateStrategies();
    window.closeModal('wiki-editor-modal');
}
window.deleteWikiItem = function(id) { if(confirm("Xóa?")) { wikiData = wikiData.filter(i => i.id.toString() !== id.toString()); saveWikiData(); renderWikiGrid(); populateStrategies(); window.closeModal('wiki-detail-modal'); } }
window.viewWikiDetail = function(id) {
    const item = wikiData.find(x => x.id.toString() === id.toString());
    if(!item) return;
    document.getElementById('view-title').innerText = item.title;
    document.getElementById('view-image').src = item.image;
    document.getElementById('view-content').innerText = item.content;
    const btnEdit = document.getElementById('btn-edit-entry');
    const btnDel = document.getElementById('btn-delete-entry');
    const newEdit = btnEdit.cloneNode(true); const newDel = btnDel.cloneNode(true);
    btnEdit.parentNode.replaceChild(newEdit, btnEdit); btnDel.parentNode.replaceChild(newDel, btnDel);
    newEdit.onclick = () => { window.closeModal('wiki-detail-modal'); window.openWikiEditor(id); };
    newDel.onclick = () => window.deleteWikiItem(id);
    document.getElementById('wiki-detail-modal').classList.remove('hidden');
}
window.renderWikiGrid = function() {
    const term = document.getElementById('wiki-search').value.toLowerCase();
    const list = wikiData.filter(i => (currentFilter==='all' || i.cat===currentFilter) && (i.title.toLowerCase().includes(term)));
    document.getElementById('wiki-grid').innerHTML = list.map(i => `
        <div class="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500/50 cursor-pointer group" onclick="viewWikiDetail('${i.id}')">
            <div class="flex justify-between mb-2"><span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 rounded">${i.code}</span><span class="text-[10px] uppercase font-bold">${i.cat}</span></div>
            <div class="h-36 bg-slate-100 rounded mb-3 overflow-hidden">${i.image ? `<img src="${i.image}" class="w-full h-full object-cover">` : ''}</div>
            <h4 class="font-bold text-sm line-clamp-1 group-hover:text-emerald-500">${i.title}</h4>
        </div>`).join('');
    lucide.createIcons();
}
window.authLogin = async function() {
    const u = document.getElementById('login-user').value; const p = document.getElementById('login-pass').value;
    const users = JSON.parse(localStorage.getItem('min_sys_users_db') || '[]');
    if(users.find(x => x.username===u && x.password===p) || u) {
        window.currentUser = u; localStorage.setItem('min_sys_current_user', u);
        document.getElementById('current-username').innerText = u;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('flex');
        window.loadData();
    } else alert("Sai thông tin");
}
window.authRegister = async function() {
    const u = document.getElementById('reg-user').value; const p = document.getElementById('reg-pass').value;
    if(!u) return;
    const users = JSON.parse(localStorage.getItem('min_sys_users_db') || '[]');
    users.push({username:u, password:p});
    localStorage.setItem('min_sys_users_db', JSON.stringify(users));
    alert("Đăng ký thành công!"); window.toggleAuth();
}
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }
window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');
window.switchTab = (id) => { document.querySelectorAll('main > div').forEach(el => el.classList.add('hidden')); document.getElementById(`tab-${id}`).classList.remove('hidden'); if(id==='dashboard') renderDashboard(); }
window.setBackground = (t, s=true) => { document.body.className = `bg-theme-default text-slate-800 dark:text-slate-200 min-h-screen flex flex-col ${t}`; if(localStorage.theme==='dark') document.body.classList.add('dark'); currentBgTheme=t; if(s) saveUserData(); window.closeModal('bg-settings-modal'); }
window.openBgModal = () => document.getElementById('bg-settings-modal').classList.remove('hidden');
window.toggleTheme = () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark')?'dark':'light'; renderCharts(); }
function initTheme() { if(localStorage.theme==='dark') document.documentElement.classList.add('dark'); }
function getCurrentBalance() { let pnl=0; journalData.forEach(t=>pnl+=parseFloat(t.pnl)); return initialCapital+pnl; }
window.populateStrategies = () => { 
    const list = wikiData.filter(i=>i.cat==='Setup'||i.cat==='Chiến Lược'||i.cat==='Strategy'); 
    document.getElementById('inp-strategy').innerHTML = list.map(s=>`<option value="${s.code}: ${s.title}">${s.code}: ${s.title}</option>`).join('');
    document.getElementById('strategy-list-container').innerHTML = list.map(s=>`<div onclick="selectAnalysisStrategy('${s.id}')" class="p-3 bg-white dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-700 border rounded cursor-pointer mb-2"><span class="font-bold block">${s.code}</span><span class="text-xs text-slate-500">${s.title}</span></div>`).join('');
}
window.renderPairSelects = () => { const h = pairsData.map(p=>`<option value="${p}">${p}</option>`).join(''); document.getElementById('ai-pair-input').innerHTML=h; document.getElementById('inp-pair').innerHTML=h; }
window.renderCategoryFilters = () => { const cats = [...new Set(wikiData.map(i=>i.cat))].sort(); document.getElementById('wiki-filter-container').innerHTML = `<button onclick="filterWikiCat('all')" class="px-4 py-1.5 rounded-lg text-xs border ${currentFilter==='all'?'bg-emerald-500 text-white':''}">All</button>` + cats.map(c=>`<button onclick="filterWikiCat('${c}')" class="px-4 py-1.5 rounded-lg text-xs border ${currentFilter===c?'bg-emerald-500 text-white':''}">${c}</button>`).join(''); }
window.filterWikiCat = (c) => { currentFilter=c; renderWikiGrid(); renderCategoryFilters(); }
window.filterWiki = () => renderWikiGrid();
window.previewImage = (url) => { document.getElementById('edit-preview').src = url; if(url) document.getElementById('edit-preview').classList.remove('hidden'); else document.getElementById('edit-preview').classList.add('hidden'); }
window.handleImageUpload = (inp) => { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('edit-preview').src=e.target.result; document.getElementById('edit-preview').classList.remove('hidden'); document.getElementById('edit-image-url').value=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.calcRiskPreview = () => { const v=parseFloat(document.getElementById('inp-risk').value)||0; const mode=document.getElementById('inp-risk-mode').value; const rr=parseFloat(document.getElementById('inp-rr').value)||0; const r=mode==='%'?getCurrentBalance()*(v/100):v; document.getElementById('risk-preview').innerText=`Risk: $${r.toFixed(1)}`; document.getElementById('reward-preview').innerText=`Reward: $${(r*rr).toFixed(1)}`; }
function initQuote() { document.getElementById('dashboard-marquee').innerText = "Trade what you see, not what you think."; }