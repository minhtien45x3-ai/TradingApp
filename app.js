import { db, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from './firebase.js';

// ═══════════════════════════════════════════════════════════════
// CACON STOCK JOURNAL PRO v41 — Content Quality Upgrade
// ═══════════════════════════════════════════════════════════════

const ADMIN_LIST = ["admin", "minhtien45x3"];
const ADMIN_MASTER_PASS = "admin123";

let journalData = [], wikiData = [], libraryData = [], pairsData = [], quotePostersData = [];
let initialCapital = 20000;
let isAdmin = false;
let currentEntryImgBase64 = null, currentAnalysisTabImg = null;
let chartInst = {};
let selectedAnalysisStrategy = null;

// State for new features
let currentMood = null;          // pre-trade mood
let breathingActive = false;     // breathing timer
let dailyMarketRegime = null;    // up/side/down

const DEFAULT_PAIRS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30", "ETHUSD"];

const CRITERIA_LIST = [
    { name: "1. XU HƯỚNG", desc: "Trend Market", weight: 2 },
    { name: "2. CẢN (KEY LEVEL)", desc: "Support/Resistance", weight: 2 },
    { name: "3. TRENDLINE", desc: "Break/Retest", weight: 1 },
    { name: "4. EMA", desc: "Dynamic S/R", weight: 1 },
    { name: "5. HỢP LƯU", desc: "Confluence", weight: 2 },
    { name: "6. TÍN HIỆU NẾN", desc: "Rejection/Engulfing", weight: 1 },
    { name: "7. MÔ HÌNH GIÁ", desc: "Pattern", weight: 1 },
    { name: "8. FIBONACCI", desc: "Golden Zone", weight: 1 },
    { name: "9. THỜI GIAN", desc: "Session/Timing", weight: 1 },
    { name: "10. TỶ LỆ R:R", desc: "Risk Reward", weight: 2 }
];

const QUOTES = [
    "Hành trình vạn dặm bắt đầu bằng một bước chân.",
    "Kỷ luật là cầu nối giữa mục tiêu và thành tựu.",
    "Cắt lỗ là kỹ năng sinh tồn quan trọng nhất.",
    "Thị trường thưởng người kiên nhẫn, phạt kẻ hấp tấp."
];

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #1: ENHANCED MISTAKES — Self-test + Case Study + Detection
// ═══════════════════════════════════════════════════════════════
const TRADER_MISTAKES = [
    {
        id: "fomo",
        name: "FOMO - Đuổi giá",
        symptom: "Mua khi giá đã chạy xa khỏi điểm mua chuẩn.",
        wrong: "Nhảy vào sau cây nến tăng mạnh vì sợ lỡ cơ hội.",
        right: "Chỉ mua khi có nền giá, điểm pivot rõ và R:R còn đủ hấp dẫn.",
        frequency: 86,
        impact: -34,
        fix: "Đặt quy tắc: nếu giá vượt điểm mua quá 5-7% thì bỏ qua, chờ nền mới.",
        selfTest: [
            "Bạn có thường vào lệnh trong 30 phút sau cây nến tăng/giảm mạnh không?",
            "Bạn có cảm thấy 'phải vào ngay không là mất cơ hội' khi nhìn chart không?",
            "Trong tuần qua, bạn có ≥2 lệnh mà điểm vào cách pivot >5% không?"
        ],
        caseStudy: {
            title: "Lệnh BTCUSD ngày 15/03 — Mất 2.8% NAV",
            story: "Sau khi BTC tăng 4% trong 1h, trader vào BUY ngay tại đỉnh sóng. Giá điều chỉnh ngay sau đó, hit stop-loss đúng đáy retest. Lỗi: không chờ pullback, vào ngay khi 'sóng đã chạy'."
        },
        detectionRule: { type: "loss_streak_24h", threshold: 3 }
    },
    {
        id: "no-stop",
        name: "Không cắt lỗ",
        symptom: "Biến lệnh sai thành khoản lỗ lớn.",
        wrong: "Hy vọng giá quay lại, bình quân giá xuống không có kế hoạch.",
        right: "Cắt lỗ theo mức đã định trước khi vào lệnh.",
        frequency: 78,
        impact: -48,
        fix: "Luôn nhập stop-loss trước khi bấm mua; rủi ro mỗi lệnh tối đa 0.5-1.5% NAV.",
        selfTest: [
            "Bạn có lệnh nào hiện tại đang lỗ >5% mà chưa cắt không?",
            "Bạn có từng dời stop-loss xa hơn khi giá tiếp cận SL không?",
            "Bạn có nhập lệnh mà chưa xác định trước điểm cắt lỗ không?"
        ],
        caseStudy: {
            title: "Lệnh EURUSD — Mất 12% NAV trong 1 ngày",
            story: "Trader vào SELL không SL, kỳ vọng giá sẽ về. Giá đi ngược 200 pips, dời SL 3 lần, cuối cùng đóng tay ở mức lỗ gấp 8 lần kế hoạch ban đầu."
        },
        detectionRule: { type: "no_sl_loss", threshold: 1 }
    },
    {
        id: "overtrade",
        name: "Giao dịch quá nhiều",
        symptom: "Vào lệnh vì buồn chán hoặc muốn gỡ nhanh.",
        wrong: "Ngày nào cũng tìm lý do để mua bán.",
        right: "Chỉ giao dịch khi setup đạt chuẩn và thị trường thuận lợi.",
        frequency: 72,
        impact: -29,
        fix: "Giới hạn số lệnh/ngày và checklist bắt buộc trước khi vào lệnh.",
        selfTest: [
            "Bạn có vào >5 lệnh/ngày trong tuần qua không?",
            "Có lệnh nào bạn vào mà không xác định được setup cụ thể không?",
            "Bạn có cảm giác 'phải làm gì đó' khi không có lệnh nào mở không?"
        ],
        caseStudy: {
            title: "Tuần overtrade — 23 lệnh, lỗ -8.5%",
            story: "Trader giao dịch trung bình 4-5 lệnh/ngày trong 5 ngày liên tục. Winrate 35%. Tổng phí + spread đã ăn 2% NAV. Chất lượng setup giảm rõ rệt sau lệnh thứ 2 mỗi ngày."
        },
        detectionRule: { type: "trades_per_day", threshold: 5 }
    },
    {
        id: "against-market",
        name: "Đánh ngược thị trường",
        symptom: "Mua mạnh khi thị trường đang phân phối/downtrend.",
        wrong: "Tin rằng cổ phiếu của mình sẽ đi ngược xu hướng chung.",
        right: "Ưu tiên tiền mặt khi VNI xấu, giảm size khi thị trường sideway.",
        frequency: 66,
        impact: -41,
        fix: "Theo dõi ngày phân phối, EMA50 của chỉ số và nhóm ngành dẫn dắt.",
        selfTest: [
            "Bạn có vào lệnh BUY khi chỉ số chính đang dưới EMA50 không?",
            "Bạn có ignore market regime để ưu tiên 'cổ phiếu yêu thích' không?",
            "Tỉ lệ thắng của bạn trong downtrend có < 30% không?"
        ],
        caseStudy: {
            title: "Mua ngược downtrend — Mất 15% trong 2 tuần",
            story: "Khi VNI mất EMA50 và có 4 ngày phân phối, trader vẫn mua mạnh các cổ phiếu 'yêu thích'. Tất cả đều giảm theo chỉ số. Bài học: respect market regime."
        },
        detectionRule: { type: "regime_mismatch", threshold: 1 }
    },
    {
        id: "oversize",
        name: "Vào vị thế quá lớn",
        symptom: "Một lệnh sai làm tổn thương tâm lý và tài khoản.",
        wrong: "All-in vì quá tự tin vào một setup.",
        right: "Tính position sizing theo điểm cắt lỗ.",
        frequency: 61,
        impact: -45,
        fix: "Dùng công thức: Số tiền rủi ro / khoảng cách stop-loss.",
        selfTest: [
            "Bạn có lệnh nào risk >2% NAV trong tuần qua không?",
            "Bạn có 'tăng size' khi cảm thấy 'lệnh này chắc thắng' không?",
            "Tổng risk tất cả lệnh đang mở có vượt 6% NAV không?"
        ],
        caseStudy: {
            title: "All-in setup 'chắc ăn' — Mất 22% NAV",
            story: "Trader bỏ 60% NAV vào 1 lệnh vì 'setup hoàn hảo'. Setup đúng 70% — nhưng 30% đã đến. Một lệnh xóa thành quả 6 tháng giao dịch kỷ luật."
        },
        detectionRule: { type: "high_risk_pct", threshold: 2 }
    },
    {
        id: "sell-early",
        name: "Bán non cổ phiếu mạnh",
        symptom: "Chốt lời quá sớm vì sợ mất lãi.",
        wrong: "Thấy lãi nhỏ đã bán hết dù xu hướng vẫn khỏe.",
        right: "Bán theo quy tắc: một phần ở R:R, phần còn lại bám EMA/trailing stop.",
        frequency: 58,
        impact: -24,
        fix: "Tách lệnh thành 2 phần: bảo vệ vốn và để lãi chạy.",
        selfTest: [
            "Tỉ lệ R:R thực tế của bạn có thường <1:1 không (dù SL 1R)?",
            "Bạn có chốt full khi vừa đạt 1R không, dù xu hướng khỏe?",
            "Bạn có hối tiếc 'giá như cầm lâu hơn' ≥3 lần tuần qua không?"
        ],
        caseStudy: {
            title: "Bán XAUUSD ở +1R, missing +5R",
            story: "Setup XAU đẹp, vào BUY ở 1900, SL 1880, TP1 1920 (1R). Trader chốt full ở 1920. Giá tiếp tục lên 2000. Mất 4R lợi nhuận chỉ vì không có rule trailing."
        },
        detectionRule: { type: "low_rr_realized", threshold: 1.5 }
    },
    {
        id: "no-journal",
        name: "Không ghi nhật ký",
        symptom: "Lặp lại lỗi cũ vì không đo lường hành vi.",
        wrong: "Chỉ nhớ lệnh thắng, quên nguyên nhân lệnh thua.",
        right: "Ghi ảnh chart, lý do vào lệnh, cảm xúc, lỗi và bài học.",
        frequency: 54,
        impact: -22,
        fix: "Sau mỗi lệnh ghi 3 dòng: setup, lỗi, hành động sửa lần sau.",
        selfTest: [
            "Bạn có ≥30% lệnh không có note/screenshot không?",
            "Bạn có thể kể chi tiết về 5 lệnh thua gần nhất không?",
            "Bạn có review journal hàng tuần không?"
        ],
        caseStudy: {
            title: "6 tháng không journal — Lặp 1 lỗi 14 lần",
            story: "Trader phát hiện sau khi review: 14/30 lệnh thua đều do cùng 1 nguyên nhân (FOMO sau cây nến lớn). Nếu ghi journal sớm, có thể tiết kiệm 8% NAV."
        },
        detectionRule: { type: "missing_notes_pct", threshold: 30 }
    }
];

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #2: PATTERN LIBRARY — 30 setup chuẩn
// ═══════════════════════════════════════════════════════════════
const PATTERN_LIBRARY = [
    // LEVEL 1 — Foundation
    { id: "p01", level: 1, code: "L1-01", cat: "Foundation", title: "Uptrend - Xu hướng tăng", image: "", content: "ĐIỀU KIỆN HÌNH THÀNH:\n• Đỉnh sau cao hơn đỉnh trước (HH)\n• Đáy sau cao hơn đáy trước (HL)\n• Giá nằm trên EMA50\n\nENTRY: Mua tại đáy mới (HL) khi có tín hiệu xác nhận\nSTOP: Dưới đáy gần nhất\nTARGET: Đỉnh trước hoặc R:R 2:1\n\nTỈ LỆ THẮNG: 60-70% trong trend mạnh\n\nKẾT HỢP: EMA50 + Trendline tăng + RSI > 50" },
    { id: "p02", level: 1, code: "L1-02", cat: "Foundation", title: "Downtrend - Xu hướng giảm", image: "", content: "ĐIỀU KIỆN HÌNH THÀNH:\n• Đỉnh sau thấp hơn đỉnh trước (LH)\n• Đáy sau thấp hơn đáy trước (LL)\n• Giá nằm dưới EMA50\n\nENTRY: Bán tại đỉnh mới (LH) khi có tín hiệu xác nhận\nSTOP: Trên đỉnh gần nhất\nTARGET: Đáy trước hoặc R:R 2:1\n\nTỈ LỆ THẮNG: 60-70% trong trend mạnh" },
    { id: "p03", level: 1, code: "L1-03", cat: "Foundation", title: "Support - Hỗ trợ", image: "", content: "ĐỊNH NGHĨA: Vùng giá mà lực mua ≥ lực bán, giá khó giảm dưới mức này.\n\nXÁC NHẬN: ≥2 lần test mà giá bật lên\n\nENTRY: Mua khi giá test support + có nến rejection (pin bar, hammer)\nSTOP: Dưới support 0.5-1%\nTARGET: Resistance gần nhất\n\nKẾT HỢP: EMA + Fibonacci 0.618" },
    { id: "p04", level: 1, code: "L1-04", cat: "Foundation", title: "Resistance - Kháng cự", image: "", content: "ĐỊNH NGHĨA: Vùng giá mà lực bán ≥ lực mua, giá khó tăng vượt mức này.\n\nXÁC NHẬN: ≥2 lần test mà giá quay xuống\n\nENTRY: Bán khi giá test resistance + có nến rejection\nSTOP: Trên resistance 0.5-1%\nTARGET: Support gần nhất" },
    { id: "p05", level: 1, code: "L1-05", cat: "Foundation", title: "EMA20 - Trend ngắn hạn", image: "", content: "EMA20 = đường giá trung bình 20 phiên gần nhất.\n\nDÙNG ĐỂ:\n• Xác định trend ngắn hạn\n• Làm dynamic support/resistance\n• Entry pullback trong trend mạnh\n\nENTRY: Mua khi giá pullback về EMA20 trong uptrend mạnh\nSTOP: Dưới EMA20 1.5%" },
    { id: "p06", level: 1, code: "L1-06", cat: "Foundation", title: "EMA50 - Trend trung hạn", image: "", content: "EMA50 = đường giá trung bình 50 phiên.\n\nQUY TẮC VÀNG:\n• Giá > EMA50: chỉ tìm setup BUY\n• Giá < EMA50: chỉ tìm setup SELL\n• Giá test EMA50 + reject = setup pullback đẹp\n\nENTRY pullback: BUY khi nến đóng cửa trên EMA50 sau khi test" },
    { id: "p07", level: 1, code: "L1-07", cat: "Foundation", title: "EMA200 - Trend dài hạn", image: "", content: "EMA200 = ranh giới bull/bear thị trường.\n\nÝ NGHĨA:\n• Giá > EMA200: bull market\n• Giá < EMA200: bear market\n• Cross EMA200: tín hiệu thay đổi xu hướng quan trọng\n\nQUY TẮC: Tránh swing trade ngược EMA200" },
    { id: "p08", level: 1, code: "L1-08", cat: "Foundation", title: "Higher High - Đỉnh cao hơn", image: "", content: "HH = đỉnh mới cao hơn đỉnh trước → xác nhận uptrend còn mạnh.\n\nỨNG DỤNG:\n• HH + HL liên tục = trend tăng còn nguyên\n• Không có HH mới sau 3 lần thử = trend yếu\n• HH break giả + đảo chiều = signal đảo trend" },
    { id: "p09", level: 1, code: "L1-09", cat: "Foundation", title: "Higher Low - Đáy cao hơn", image: "", content: "HL = đáy mới cao hơn đáy trước → buyer mạnh hơn seller.\n\nENTRY ĐẸP NHẤT TRONG UPTREND:\n• Chờ giá pullback tạo HL\n• Vào BUY khi xác nhận đảo chiều ở HL\n• SL dưới HL\n• R:R thường 3:1 trở lên" },
    { id: "p10", level: 1, code: "L1-10", cat: "Foundation", title: "Lower Low - Đáy thấp hơn", image: "", content: "LL = đáy mới thấp hơn đáy trước → seller áp đảo.\n\nXÁC NHẬN DOWNTREND:\n• LL + LH liên tục = downtrend mạnh\n• Vào SELL tại LH với SL trên LH\n\nĐẢO CHIỀU: Khi LL fail (giá không phá đáy mới) → có thể đảo trend" },

    // LEVEL 2 — Candle Signals
    { id: "p11", level: 2, code: "L2-01", cat: "Candle", title: "Pin Bar - Nến râu dài", image: "", content: "HÌNH DẠNG: Thân nhỏ, đuôi (râu) dài gấp 2-3 lần thân, đầu kia gần như không có râu.\n\nÝ NGHĨA:\n• Pin bar đáy: lực bán đẩy xuống nhưng buyer kéo lên → tín hiệu BUY\n• Pin bar đỉnh: lực mua đẩy lên nhưng seller kéo xuống → tín hiệu SELL\n\nENTRY: Vào ngược chiều râu, ngay khi nến tiếp theo mở\nSTOP: Đầu kia của râu\n\nĐỘ TIN CẬY CAO khi xuất hiện ở: support/resistance, EMA50, fib 0.618" },
    { id: "p12", level: 2, code: "L2-02", cat: "Candle", title: "Engulfing - Nến nhấn chìm", image: "", content: "HÌNH DẠNG: Nến hiện tại có thân lớn, NHẤN CHÌM hoàn toàn thân nến trước.\n\nBULLISH ENGULFING (BUY):\n• Sau downtrend\n• Nến xanh nhấn chìm nến đỏ trước\n\nBEARISH ENGULFING (SELL):\n• Sau uptrend\n• Nến đỏ nhấn chìm nến xanh trước\n\nENTRY: Khi nến engulfing đóng cửa\nSTOP: Đầu kia của nến engulfing" },
    { id: "p13", level: 2, code: "L2-03", cat: "Candle", title: "Inside Bar - Nến nằm trong", image: "", content: "HÌNH DẠNG: Nến hiện tại nằm GỌN trong range của nến trước (cả high và low).\n\nÝ NGHĨA: Thị trường đang nén lại, sắp breakout mạnh.\n\nENTRY: Đặt lệnh chờ ở break của nến mẹ\n• BUY stop trên high nến mẹ\n• SELL stop dưới low nến mẹ\nSTOP: Bên kia của nến mẹ" },
    { id: "p14", level: 2, code: "L2-04", cat: "Candle", title: "Doji - Nến do dự", image: "", content: "HÌNH DẠNG: Thân nến rất nhỏ (giá mở ≈ giá đóng), có thể có râu hai bên.\n\nÝ NGHĨA: Lưỡng lự — buyer và seller cân bằng. Thường xuất hiện trước reversal.\n\nÝ NGHĨA KHÁC NHAU TRONG NGỮ CẢNH:\n• Doji ở đỉnh sau uptrend dài → cảnh báo reversal\n• Doji ở support sau downtrend → cảnh báo bounce\n\nKHÔNG TỰ ĐỦ — cần xác nhận nến tiếp theo" },
    { id: "p15", level: 2, code: "L2-05", cat: "Candle", title: "Hammer - Nến búa", image: "", content: "HÌNH DẠNG: Thân nhỏ ở phía TRÊN, râu dài bên DƯỚI (gấp 2-3x thân).\n\nXUẤT HIỆN: Sau downtrend → tín hiệu reversal BUY\n\nENTRY: Vào BUY khi nến tiếp theo đóng cửa cao hơn high của hammer\nSTOP: Dưới đuôi hammer\n\nKẾT HỢP: Support + EMA50 + RSI < 30 = setup A+" },
    { id: "p16", level: 2, code: "L2-06", cat: "Candle", title: "Shooting Star - Sao băng", image: "", content: "HÌNH DẠNG: Thân nhỏ ở phía DƯỚI, râu dài bên TRÊN.\n\nXUẤT HIỆN: Sau uptrend → tín hiệu reversal SELL\n\nENTRY: SELL khi nến tiếp theo đóng cửa thấp hơn low của shooting star\nSTOP: Trên đỉnh râu\n\nĐỘ TIN CẬY: Cao tại resistance + EMA50 + RSI > 70" },
    { id: "p17", level: 2, code: "L2-07", cat: "Candle", title: "Marubozu - Nến không râu", image: "", content: "HÌNH DẠNG: Thân nến rất lớn, không có hoặc có rất ít râu.\n\nÝ NGHĨA: Một bên áp đảo hoàn toàn — momentum cực mạnh.\n\nỨNG DỤNG:\n• Marubozu xanh sau breakout = xác nhận trend mạnh\n• Đừng FADE marubozu — đi ngược cực rủi ro\n• Có thể vào CÙNG CHIỀU sau retest" },
    { id: "p18", level: 2, code: "L2-08", cat: "Candle", title: "Three White Soldiers - 3 chàng lính", image: "", content: "HÌNH DẠNG: 3 nến tăng liên tiếp, mỗi nến đóng cửa cao hơn nến trước, thân lớn dần.\n\nÝ NGHĨA: Đảo chiều mạnh sau downtrend.\n\nENTRY: SAU khi 3 nến hoàn thành, chờ pullback nhẹ rồi vào BUY\nSTOP: Dưới low nến đầu tiên\n\nLƯU Ý: Không vào ngay nến thứ 3 (đã đi xa) — chờ retest" },

    // LEVEL 3 — Chart Patterns
    { id: "p19", level: 3, code: "L3-01", cat: "Chart Pattern", title: "Double Top - Đỉnh đôi", image: "", content: "HÌNH DẠNG: 2 đỉnh gần bằng nhau với 1 đáy ở giữa (neckline).\n\nÝ NGHĨA: Đảo chiều từ uptrend sang downtrend.\n\nENTRY: SELL khi giá phá neckline (đóng cửa dưới)\nSTOP: Trên đỉnh thứ 2\nTARGET: Khoảng cách từ đỉnh đến neckline, projected từ điểm break\n\nKHỐI LƯỢNG: Volume ở đỉnh 2 thường thấp hơn đỉnh 1 — xác nhận yếu thế" },
    { id: "p20", level: 3, code: "L3-02", cat: "Chart Pattern", title: "Double Bottom - Đáy đôi", image: "", content: "HÌNH DẠNG: 2 đáy gần bằng nhau với 1 đỉnh ở giữa (neckline).\n\nÝ NGHĨA: Đảo chiều từ downtrend sang uptrend.\n\nENTRY: BUY khi giá phá neckline\nSTOP: Dưới đáy thứ 2\nTARGET: Khoảng cách đáy → neckline\n\nXÁC NHẬN: Volume ở đáy 2 cao + nến reversal mạnh" },
    { id: "p21", level: 3, code: "L3-03", cat: "Chart Pattern", title: "Head & Shoulders - Vai đầu vai", image: "", content: "HÌNH DẠNG: 3 đỉnh — đỉnh giữa cao nhất (đầu), 2 đỉnh hai bên thấp hơn (vai). Neckline nối 2 đáy.\n\nÝ NGHĨA: Đảo chiều mạnh từ uptrend sang downtrend.\n\nENTRY: SELL khi phá neckline\nSTOP: Trên vai phải\nTARGET: Khoảng cách đầu → neckline\n\nĐỘ TIN CẬY: Một trong những pattern tin cậy nhất TA" },
    { id: "p22", level: 3, code: "L3-04", cat: "Chart Pattern", title: "Flag - Cờ", image: "", content: "HÌNH DẠNG: Sau move mạnh (cán cờ), giá điều chỉnh trong channel hẹp ngược chiều (lá cờ).\n\nÝ NGHĨA: Tạm nghỉ trước khi tiếp diễn xu hướng.\n\nENTRY: Vào theo chiều move ban đầu khi giá break flag\nSTOP: Bên kia flag\nTARGET: Bằng độ dài cán cờ projected từ điểm break\n\nLƯU Ý: Flag chuẩn không quá 1/2 cán cờ về độ sâu retracement" },
    { id: "p23", level: 3, code: "L3-05", cat: "Chart Pattern", title: "Triangle - Tam giác", image: "", content: "3 LOẠI:\n\n• ASCENDING (tam giác tăng): đáy cao dần, đỉnh ngang → phần lớn break UP\n• DESCENDING (tam giác giảm): đỉnh thấp dần, đáy ngang → phần lớn break DOWN\n• SYMMETRICAL (cân): cả đỉnh và đáy hội tụ → break theo trend chính\n\nENTRY: Vào khi giá break + retest\nSTOP: Bên kia điểm break" },
    { id: "p24", level: 3, code: "L3-06", cat: "Chart Pattern", title: "Cup with Handle - Cốc tay cầm", image: "", content: "HÌNH DẠNG (William O'Neil):\n• Cốc: hình chữ U dài 7-65 tuần\n• Handle: pullback nhẹ 10-15% sau cốc\n\nXÁC NHẬN BUY: Volume tăng đột biến khi break điểm pivot (đỉnh handle)\nSTOP: Dưới đáy handle\nTARGET: Min 20-25%, có thể nhiều hơn\n\nĐÂY LÀ SETUP YÊU THÍCH NHẤT của các trader trend-following" },
    { id: "p25", level: 3, code: "L3-07", cat: "Chart Pattern", title: "VCP - Volatility Contraction Pattern", image: "", content: "VCP (Mark Minervini): Pattern mà biến động thu hẹp dần qua các đợt pullback.\n\nĐẶC ĐIỂM:\n• Pullback 1: 20-35%\n• Pullback 2: 12-20%\n• Pullback 3: 5-12%\n• Volume khô cạn dần\n\nENTRY: Khi break pivot point + volume bùng nổ\nSTOP: Dưới đáy pullback gần nhất\n\nWINRATE THỐNG KÊ: 70-80% trong bull market" },
    { id: "p26", level: 3, code: "L3-08", cat: "Chart Pattern", title: "Channel - Kênh giá", image: "", content: "HÌNH DẠNG: Giá dao động giữa 2 đường song song (trendline trên + dưới).\n\n3 LOẠI:\n• Ascending channel (kênh tăng)\n• Descending channel (kênh giảm)\n• Horizontal channel (sideway)\n\nENTRY:\n• BUY ở đáy kênh + nến rejection\n• SELL ở đỉnh kênh + nến rejection\n\nBREAKOUT: Phá kênh kèm volume = signal continuation hoặc reversal" },

    // LEVEL 4 — Advanced
    { id: "p27", level: 4, code: "L4-01", cat: "Advanced", title: "Liquidity Sweep - Quét thanh khoản", image: "", content: "KHÁI NIỆM (SMC): Smart money quét stop-loss của retail trader trước khi đẩy giá theo hướng thật.\n\nDẤU HIỆU:\n• Giá phá đỉnh/đáy quan trọng → quay lại ngay\n• Râu dài ở mức key level\n• Volume tăng đột biến rồi giảm\n\nENTRY: Vào ngược chiều fake breakout sau khi giá đóng cửa quay lại\nSTOP: Bên kia râu sweep\n\nR:R THƯỜNG: 3-5:1" },
    { id: "p28", level: 4, code: "L4-02", cat: "Advanced", title: "Order Block - Khối lệnh", image: "", content: "ĐỊNH NGHĨA (SMC): Vùng nến cuối trước một move mạnh — nơi smart money đặt lệnh lớn.\n\nXÁC ĐỊNH:\n• Bullish OB: nến đỏ cuối trước move tăng mạnh\n• Bearish OB: nến xanh cuối trước move giảm mạnh\n\nENTRY: Khi giá retest OB + có tín hiệu rejection\nSTOP: Bên kia OB\nTARGET: Liquidity gần nhất hoặc R:R 3:1" },
    { id: "p29", level: 4, code: "L4-03", cat: "Advanced", title: "Fair Value Gap - Khoảng trống giá trị", image: "", content: "ĐỊNH NGHĨA (SMC/ICT): Khoảng giá chưa được giao dịch, hình thành khi 3 nến tạo gap không overlap.\n\nÝ NGHĨA: Giá có xu hướng quay lại lấp đầy FVG.\n\nENTRY: Đặt lệnh limit ở vùng FVG\n• Bullish FVG → BUY limit\n• Bearish FVG → SELL limit\nSTOP: Bên ngoài FVG\n\nKẾT HỢP: FVG + Order Block = setup cực mạnh" },
    { id: "p30", level: 4, code: "L4-04", cat: "Advanced", title: "Break of Structure - Phá vỡ cấu trúc", image: "", content: "BOS = market phá vỡ cấu trúc (trend) hiện tại.\n\nBULLISH BOS: phá đỉnh gần nhất trong downtrend → có thể đảo trend\nBEARISH BOS: phá đáy gần nhất trong uptrend → có thể đảo trend\n\nXÁC NHẬN BOS:\n• Nến đóng cửa rõ ràng vượt mức\n• Volume tăng\n• Không phải fake breakout\n\nENTRY: Sau retest BOS level + tín hiệu xác nhận" }
];

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #4: PRINCIPLE CARDS — Quote → Action
// ═══════════════════════════════════════════════════════════════
const DEFAULT_QUOTE_POSTERS = [
    {
        id: "principle-01", theme: "emerald",
        title: "Kỷ luật trước lợi nhuận", author: "Paul Tudor Jones",
        quote: "Đừng tập trung vào việc kiếm tiền, hãy tập trung vào việc bảo vệ những gì bạn có.",
        principle: "PRINCIPLE #01 — CAPITAL PRESERVATION",
        whyTrue: "Vốn gốc là công cụ kiếm tiền. Mất vốn = mất khả năng kiếm tiền. Một lệnh -50% NAV cần +100% mới hồi phục.",
        actionList: [
            "Risk mỗi lệnh ≤ 1.5% NAV",
            "Tổng risk các lệnh mở ≤ 5% NAV",
            "Stop trading khi DD đạt -8% NAV"
        ],
        selfCheck: "Tuần này risk lớn nhất của bạn là bao nhiêu %?"
    },
    {
        id: "principle-02", theme: "blue",
        title: "Cắt lỗ là kỹ năng sinh tồn", author: "Stanley Druckenmiller",
        quote: "Điều quan trọng không phải là đúng hay sai, mà là bạn kiếm được bao nhiêu khi đúng và mất bao nhiêu khi sai.",
        principle: "PRINCIPLE #02 — STOP LOSS DISCIPLINE",
        whyTrue: "Bạn có thể đúng 70% mà vẫn lỗ nếu lệnh sai mất 3R còn lệnh đúng chỉ kiếm 1R. R:R quan trọng hơn winrate.",
        actionList: [
            "Luôn nhập SL trước khi vào lệnh",
            "Không bao giờ dời SL xa hơn",
            "R:R tối thiểu 1.5:1, ưu tiên 2:1"
        ],
        selfCheck: "Có lệnh nào đang mở mà chưa có stop-loss không?"
    },
    {
        id: "principle-03", theme: "amber",
        title: "Chờ thời điểm chất lượng", author: "Jesse Livermore",
        quote: "Tiền lớn không nằm ở việc mua bán liên tục, mà nằm ở việc ngồi yên đúng lúc.",
        principle: "PRINCIPLE #03 — PATIENCE OVER ACTIVITY",
        whyTrue: "Setup A+ chỉ xuất hiện 2-4 lần/tháng. Giao dịch setup B/C để 'lấp thời gian' = phá hủy edge.",
        actionList: [
            "Tối đa 2-3 lệnh chất lượng/tuần",
            "Nếu không có setup A+, ngồi yên",
            "Không giao dịch khi buồn chán"
        ],
        selfCheck: "Tuần qua bạn vào bao nhiêu lệnh? Có bao nhiêu lệnh A+?"
    }
];

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #5: DISCIPLINE MODULES — Real features
// ═══════════════════════════════════════════════════════════════
const TRADER_DISCIPLINE_MODULES = [
    { id: "pretrade", icon: "shield-check", title: "Pre-Trade Gate", priority: "Bắt buộc", desc: "Khoá lệnh nếu chưa đủ điều kiện: xu hướng, điểm mua, R:R, stop-loss, tâm lý.", build: "✓ ACTIVE: Checklist 10 tiêu chí + mood check trước khi vào lệnh.", status: "active" },
    { id: "setup-score", icon: "badge-check", title: "Trade Quality Score", priority: "Auto", desc: "Tự động chấm A+/A/B/C/D theo checklist, R:R, market regime.", build: "✓ ACTIVE: Score hiển thị ngay khi tick checklist.", status: "active" },
    { id: "risk-guard", icon: "lock-keyhole", title: "Risk Guardrail", priority: "Bắt buộc", desc: "Cảnh báo khi risk/lệnh quá cao, drawdown vượt giới hạn.", build: "✓ ACTIVE: Toast warning + xác nhận 2 lần khi risk > 2%.", status: "active" },
    { id: "loss-autopsy", icon: "activity", title: "Loss Autopsy", priority: "Sau LOSS", desc: "Mổ xẻ lệnh thua: lỗi setup, lỗi timing, lỗi tâm lý.", build: "✓ ACTIVE: Modal bắt buộc chọn nguyên nhân khi đánh dấu LOSS.", status: "active" },
    { id: "mood-check", icon: "heart-pulse", title: "Pre-Trade Mood Check", priority: "Bắt buộc", desc: "Đánh giá trạng thái tâm lý trước mỗi lệnh.", build: "✓ ACTIVE: 4 trạng thái — chặn vào lệnh khi cay cú + thua >2 lệnh.", status: "active" },
    { id: "market-regime", icon: "bar-chart-3", title: "Market Regime Filter", priority: "Daily", desc: "Xác định Uptrend / Sideway / Downtrend đầu phiên.", build: "✓ ACTIVE: Daily check-in xác định regime trước khi mở lệnh.", status: "active" },
    { id: "mistake-radar", icon: "flame", title: "Mistake Auto-Detect", priority: "Real-time", desc: "Tự phát hiện hành vi sai từ pattern journal.", build: "✓ ACTIVE: Scan journal real-time và cảnh báo khi gặp pattern lỗi.", status: "active" },
    { id: "weekly-review", icon: "calendar-check", title: "Weekly Review Auto", priority: "Cuối tuần", desc: "Tự động tổng kết tuần: PnL, lỗi lặp lại, setup tốt nhất.", build: "✓ ACTIVE: Tab Dashboard tự cập nhật stats hàng tuần.", status: "active" }
];

// Mood states with thresholds
const MOOD_STATES = {
    calm:    { label: "Bình tâm",       emoji: "🧘", color: "var(--green)",  riskMultiplier: 1.0,  block: false },
    fomo:    { label: "Hưng phấn/FOMO", emoji: "🔥", color: "var(--amber)",  riskMultiplier: 0.5,  block: false, warn: "Hưng phấn dễ dẫn đến FOMO. Risk được giảm 50% tự động." },
    fear:    { label: "Sợ hãi",         emoji: "😨", color: "var(--blue)",   riskMultiplier: 0.5,  block: false, warn: "Khi sợ hãi, hãy giảm size. Nếu không tin setup, BỎ QUA." },
    revenge: { label: "Cay cú",         emoji: "😡", color: "var(--red)",    riskMultiplier: 0.0,  block: true,  warn: "TRẠNG THÁI NGUY HIỂM. Hãy nghỉ ít nhất 1 giờ trước khi vào lệnh." }
};

// Daily principle (rotates by day)
function getDailyPrinciple() {
    const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const items = quotePostersData.length ? quotePostersData : DEFAULT_QUOTE_POSTERS;
    return items[day % items.length];
}

function safeSetText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; }

// --- CORE INIT ---
document.addEventListener('DOMContentLoaded', () => {
    if(typeof initTheme === 'function') initTheme();
    if(window.lucide) lucide.createIcons();
    startMarquee();
    const hardEnterBtn = document.getElementById('btn-enter-system');
    if (hardEnterBtn) hardEnterBtn.addEventListener('click', (e) => { e.preventDefault(); window.enterSystem(); });
    const landing = document.getElementById('landing-page');
    if(landing) {
        landing.classList.remove('hidden');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
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
            dailyMarketRegime = d.dailyMarketRegime || null;
        } else {
            await saveUserData();
        }

        const wSnap = await getDoc(doc(db, 'system', SYSTEM_MASTER_DOC.wiki));
        const wikiFallback = wSnap.exists() && Array.isArray(wSnap.data().items) ? wSnap.data().items : PATTERN_LIBRARY;
        wikiData = await loadSystemItems('wiki', wikiFallback);

        // Auto-seed pattern library nếu wiki trống
        if (wikiData.length === 0 || (wikiData.length === 1 && wikiData[0].id === "1")) {
            wikiData = PATTERN_LIBRARY.map(normalizeContentItem);
            if (isAdmin) {
                try { await saveSystemItems('wiki', wikiData); console.log("✓ Pattern Library seeded"); }
                catch(e) { console.warn("Could not seed pattern library:", e); }
            }
        }

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
        level: raw.level || 0,
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
        console.warn('Không đọc được item docs', error);
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
        image.onerror = () => reject(new Error('Không đọc được ảnh.'));
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
    if (output.length > MAX_IMAGE_DATA_URL_CHARS) throw new Error('Ảnh vẫn quá nặng sau nén.');
    return output;
}

async function saveUserData() {
    if(!window.currentUser) return;
    await setDoc(doc(db, "users", window.currentUser), {
        journal: sanitize(journalData),
        pairs: sanitize(pairsData),
        capital: initialCapital,
        dailyMarketRegime: dailyMarketRegime
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
    } catch(error) {
        alert("🚨 LỖI LƯU POSTER:\n" + error.message);
    }
}

async function saveWikiData() {
    if(!isAdmin) return;
    try { await saveSystemItems('wiki', wikiData); }
    catch (error) { alert('🚨 LỖI LƯU WIKI:\n' + error.message); throw error; }
}

async function saveLibraryData() {
    if(!isAdmin) return;
    try { await saveSystemItems('library', libraryData); }
    catch (error) { alert('🚨 LỖI LƯU THƯ VIỆN:\n' + error.message); throw error; }
}

function initUI() {
    renderDashboard();
    renderJournalList();
    populateStrategies();
    renderWikiGrid();
    renderLibraryGrid();
    renderPairSelects();
    renderQuotePosters();
    renderMistakesPreview();
    renderMistakeCharts();
    renderDisciplineModules();
    renderDisciplineGrid();
    renderDailyPrinciple();
    renderMistakeAlerts();
    checkDailyMarketRegime();

    const cap = document.getElementById('real-init-capital');
    if(cap) cap.value = initialCapital;
    updateCapitalCalc();

    // Render Checklist (used in analysis tab)
    const checklistContainer = document.getElementById('ana-checklist-container');
    if(checklistContainer) {
        checklistContainer.innerHTML = CRITERIA_LIST.map(c => `<label class="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition" style="background:var(--bg-raised);border:1px solid var(--border)"><input type="checkbox" style="accent-color:var(--green);width:16px;height:16px"><div><p style="font-size:.7rem;font-weight:700;color:var(--tx-hi)">${c.name}</p><p style="font-size:.6rem;color:var(--tx-lo)">${c.desc}</p></div></label>`).join('');
    }

    const btnCreate = document.querySelector('#tab-wiki button[onclick^="openWikiEditor"]');
    if(btnCreate) btnCreate.style.display = isAdmin ? 'flex' : 'none';
    const btnLib = document.querySelector('#tab-library button[onclick^="openWikiEditor"]');
    if(btnLib) btnLib.style.display = isAdmin ? 'flex' : 'none';
    if(window.lucide) lucide.createIcons();
    loadRandomTraining();
}

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #5: PRE-TRADE GATE (Mood + Checklist + Risk Guard)
// ═══════════════════════════════════════════════════════════════

window.openEntryModal = function() {
    // Show mood check first
    showMoodCheck();
};

function showMoodCheck() {
    const modal = document.getElementById('mood-check-modal');
    if (!modal) return;

    // Check if user thua >2 lệnh hôm nay
    const today = new Date().toLocaleDateString('vi-VN');
    const todayLosses = journalData.filter(t => t.date === today && t.status === 'LOSS').length;

    const warnEl = document.getElementById('mood-loss-warning');
    if (warnEl) {
        if (todayLosses >= 2) {
            warnEl.classList.remove('hidden');
            warnEl.innerHTML = `⚠️ Bạn đã thua ${todayLosses} lệnh hôm nay. Cân nhắc nghỉ giao dịch.`;
        } else {
            warnEl.classList.add('hidden');
        }
    }
    modal.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
}

window.selectMood = function(mood) {
    currentMood = mood;
    const state = MOOD_STATES[mood];

    if (state.block) {
        const today = new Date().toLocaleDateString('vi-VN');
        const todayLosses = journalData.filter(t => t.date === today && t.status === 'LOSS').length;
        if (todayLosses >= 2) {
            alert("🛑 CHẶN GIAO DỊCH\n\n" + state.warn + "\n\nBạn đã thua " + todayLosses + " lệnh hôm nay. Nghỉ ít nhất 1 giờ.\n\nHãy mở app sau, hoặc dùng bài thở 4-7-8 ở tab Tâm lý.");
            return;
        }
    }

    if (state.warn) {
        if (!confirm("⚠️ CẢNH BÁO TÂM LÝ\n\n" + state.warn + "\n\nVẫn muốn tiếp tục?")) return;
    }

    closeModal('mood-check-modal');
    proceedToEntryModal();
}

function proceedToEntryModal() {
    document.getElementById('entry-modal').classList.remove('hidden');
    const now = new Date();
    document.getElementById('inp-date').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().split('T')[0];

    if(!currentEntryImgBase64) {
        const prev = document.getElementById('entry-img-preview');
        const hint = document.getElementById('entry-upload-hint');
        if(prev) prev.classList.add('hidden');
        if(hint) hint.classList.remove('hidden');
    }

    // Render pre-trade checklist
    renderPreTradeChecklist();

    // Apply mood-based risk multiplier
    if (currentMood && MOOD_STATES[currentMood]) {
        const mult = MOOD_STATES[currentMood].riskMultiplier;
        const riskInput = document.getElementById('inp-risk');
        if (riskInput && mult < 1.0) {
            const adjustedRisk = (1.0 * mult).toFixed(2);
            riskInput.value = adjustedRisk;
            const note = document.getElementById('mood-risk-note');
            if (note) {
                note.classList.remove('hidden');
                note.innerHTML = `⚠️ Risk giảm còn ${(mult*100)}% do trạng thái ${MOOD_STATES[currentMood].label}`;
            }
        }
    } else {
        const note = document.getElementById('mood-risk-note');
        if(note) note.classList.add('hidden');
    }

    updateTradeQualityScore();
    if(window.lucide) lucide.createIcons();
}

function renderPreTradeChecklist() {
    const container = document.getElementById('pretrade-checklist');
    if (!container) return;
    container.innerHTML = CRITERIA_LIST.map((c, i) => `
        <label class="pretrade-check-item">
            <input type="checkbox" class="pretrade-check" data-weight="${c.weight}" onchange="updateTradeQualityScore()">
            <div>
                <p style="font-size:.72rem;font-weight:700;color:var(--tx-hi)">${c.name}</p>
                <span style="font-size:.6rem;color:var(--tx-lo)">${c.desc}</span>
            </div>
        </label>
    `).join('');
}

window.updateTradeQualityScore = function() {
    const checks = document.querySelectorAll('.pretrade-check');
    let score = 0, maxScore = 0;
    checks.forEach(c => {
        const w = parseInt(c.dataset.weight) || 1;
        maxScore += w;
        if (c.checked) score += w;
    });
    const pct = maxScore > 0 ? (score/maxScore*100) : 0;

    let grade, color;
    if (pct >= 90) { grade = 'A+'; color = '#00e5a0'; }
    else if (pct >= 75) { grade = 'A'; color = '#34d399'; }
    else if (pct >= 60) { grade = 'B'; color = '#60a5fa'; }
    else if (pct >= 45) { grade = 'C'; color = '#f59e0b'; }
    else { grade = 'D'; color = '#f43f5e'; }

    const gradeEl = document.getElementById('quality-grade');
    const pctEl = document.getElementById('quality-pct');
    const saveBtn = document.getElementById('save-entry-btn');

    if (gradeEl) { gradeEl.innerText = grade; gradeEl.style.color = color; }
    if (pctEl) { pctEl.innerText = Math.round(pct) + '%'; pctEl.style.color = color; }

    // Block save if score < 60% (< grade B)
    if (saveBtn) {
        if (pct < 60) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.4';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.title = 'Cần đạt tối thiểu Grade B (60%)';
        } else {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.title = '';
        }
    }
};

// Risk guardrail
window.calcRiskPreview = () => {
    const v = parseFloat(document.getElementById('inp-risk').value)||0;
    const mode = document.getElementById('inp-risk-mode').value;
    const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,'');
    const curBal = parseFloat(curBalText) || initialCapital;
    const r = mode==='%' ? curBal*(v/100) : v;

    const warn = document.getElementById('risk-guardrail-warn');
    if (!warn) return;

    const riskPct = mode === '%' ? v : (curBal > 0 ? (v/curBal)*100 : 0);
    if (riskPct > 2) {
        warn.classList.remove('hidden');
        warn.innerHTML = `🚨 RISK CAO (${riskPct.toFixed(2)}% > 2%) — Risk Guardrail khuyến nghị giảm xuống ≤ 1.5%`;
    } else {
        warn.classList.add('hidden');
    }
};

window.saveEntry = function() {
    const v = parseFloat(document.getElementById('inp-risk').value)||0;
    const mode = document.getElementById('inp-risk-mode').value;
    const curBalText = document.getElementById('dash-balance').innerText.replace('$','').replace(/,/g,'');
    const curBal = parseFloat(curBalText) || initialCapital;
    const riskPct = mode === '%' ? v : (curBal > 0 ? (v/curBal)*100 : 0);

    if (riskPct > 2) {
        if (!confirm(`⚠️ RISK CAO!\n\nLệnh này risk ${riskPct.toFixed(2)}% NAV (vượt ngưỡng 2%).\n\nBạn có CHẮC CHẮN muốn vào lệnh?`)) return;
    }

    const d = document.getElementById('inp-date').value.split('-');
    const dateStr = `${d[2]}/${d[1]}/${d[0]}`;
    const riskUSD = mode === '%' ? curBal * (v/100) : v;

    // Collect quality score
    const checks = document.querySelectorAll('.pretrade-check');
    let score = 0, maxScore = 0;
    checks.forEach(c => {
        const w = parseInt(c.dataset.weight) || 1;
        maxScore += w;
        if (c.checked) score += w;
    });
    const qualityPct = maxScore > 0 ? Math.round(score/maxScore*100) : 0;

    journalData.unshift({
        id: Date.now().toString(),
        date: dateStr,
        pair: document.getElementById('inp-pair').value,
        dir: document.getElementById('inp-dir').value,
        strategy: document.getElementById('inp-strategy').value,
        session: document.getElementById('inp-session').value,
        risk: riskUSD.toFixed(2),
        rr: document.getElementById('inp-rr').value,
        status: 'OPEN',
        pnl: 0,
        note: document.getElementById('inp-note').value,
        image: currentEntryImgBase64,
        mood: currentMood,
        qualityScore: qualityPct,
        marketRegime: dailyMarketRegime
    });

    saveUserData();
    renderJournalList();
    renderDashboard();
    renderMistakeAlerts();
    closeModal('entry-modal');
    currentEntryImgBase64 = null;
    currentMood = null;
};

// LOSS Autopsy — bắt buộc khi đánh dấu LOSS
window.updateEntryStatus = function(id, status) {
    const idx = journalData.findIndex(e => e.id.toString() === id.toString());
    if(idx === -1) return;

    if (status === 'LOSS') {
        showLossAutopsy(id);
        return; // sẽ update sau khi user submit autopsy
    }

    journalData[idx].status = status;
    const r = parseFloat(journalData[idx].risk);
    const rr = parseFloat(journalData[idx].rr);
    if(status === 'WIN') journalData[idx].pnl = r * rr;
    else if(status === 'LOSS') journalData[idx].pnl = -r;
    else journalData[idx].pnl = 0;

    saveUserData();
    renderJournalList();
    renderDashboard();
    renderMistakeAlerts();
};

function showLossAutopsy(entryId) {
    const modal = document.getElementById('loss-autopsy-modal');
    if (!modal) return;
    document.getElementById('autopsy-entry-id').value = entryId;

    const grid = document.getElementById('autopsy-mistake-grid');
    grid.innerHTML = TRADER_MISTAKES.map(m => `
        <label class="autopsy-mistake-card">
            <input type="radio" name="autopsy-mistake" value="${m.id}">
            <div>
                <b>${escapeHtml(m.name)}</b>
                <small>${escapeHtml(m.symptom)}</small>
            </div>
        </label>
    `).join('');

    modal.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
}

window.submitLossAutopsy = function() {
    const entryId = document.getElementById('autopsy-entry-id').value;
    const idx = journalData.findIndex(e => e.id.toString() === entryId.toString());
    if (idx === -1) return;

    const selected = document.querySelector('input[name="autopsy-mistake"]:checked');
    const lesson = document.getElementById('autopsy-lesson').value.trim();

    if (!selected) return alert('Hãy chọn ít nhất 1 nguyên nhân.');
    if (!lesson) return alert('Hãy ghi bài học để tránh lặp lại.');

    journalData[idx].status = 'LOSS';
    journalData[idx].mistakeId = selected.value;
    journalData[idx].lesson = lesson;
    const r = parseFloat(journalData[idx].risk);
    journalData[idx].pnl = -r;

    document.getElementById('autopsy-lesson').value = '';
    saveUserData();
    renderJournalList();
    renderDashboard();
    renderMistakeAlerts();
    closeModal('loss-autopsy-modal');
};

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #1: MISTAKE AUTO-DETECT
// ═══════════════════════════════════════════════════════════════
function detectMistakesFromJournal() {
    const alerts = [];
    const today = new Date().toLocaleDateString('vi-VN');
    const last24hLosses = journalData.filter(t => t.date === today && t.status === 'LOSS').length;
    const todayTrades = journalData.filter(t => t.date === today).length;

    if (last24hLosses >= 3) {
        alerts.push({ mistakeId: 'fomo', msg: `Hôm nay đã thua ${last24hLosses} lệnh — dấu hiệu FOMO/Revenge` });
    }
    if (todayTrades >= 5) {
        alerts.push({ mistakeId: 'overtrade', msg: `Hôm nay đã ${todayTrades} lệnh — vượt ngưỡng overtrade` });
    }

    // Check no SL (lệnh OPEN không note)
    const openNoNote = journalData.filter(t => t.status === 'OPEN' && (!t.note || t.note.trim().length < 5)).length;
    if (openNoNote >= 2) {
        alerts.push({ mistakeId: 'no-journal', msg: `${openNoNote} lệnh OPEN không có note phân tích` });
    }

    // Check high risk
    const highRiskCount = journalData.filter(t => {
        const r = parseFloat(t.risk) || 0;
        return curBalanceForRiskCheck() > 0 && (r / curBalanceForRiskCheck() * 100) > 2;
    }).length;
    if (highRiskCount >= 2) {
        alerts.push({ mistakeId: 'oversize', msg: `${highRiskCount} lệnh có risk > 2% NAV` });
    }

    return alerts;
}

function curBalanceForRiskCheck() {
    const closed = journalData.filter(t => t.status !== 'OPEN');
    let bal = initialCapital;
    closed.forEach(t => bal += parseFloat(t.pnl) || 0);
    return bal;
}

window.renderMistakeAlerts = function() {
    const container = document.getElementById('mistake-alerts-banner');
    if (!container) return;

    const alerts = detectMistakesFromJournal();
    if (alerts.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="width:32px;height:32px;border-radius:10px;background:rgba(244,63,94,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i data-lucide="alert-triangle" style="width:18px;height:18px;color:var(--red)"></i>
            </div>
            <div style="flex:1">
                <p style="font-family:var(--font-mono);font-size:.65rem;color:var(--red);font-weight:700;text-transform:uppercase;letter-spacing:.15em;margin-bottom:6px">⚡ MISTAKE RADAR — ${alerts.length} cảnh báo</p>
                ${alerts.map(a => `<p style="font-size:.78rem;color:var(--tx-hi);margin-top:4px">• ${escapeHtml(a.msg)} <button onclick="showMistakeDetail('${a.mistakeId}'); switchTab('mistakes')" style="color:var(--blue);text-decoration:underline;margin-left:6px;cursor:pointer;background:none;border:none;font-size:.72rem">Xem chi tiết</button></p>`).join('')}
            </div>
        </div>
    `;
    if(window.lucide) lucide.createIcons();
};

// Mistake detail with self-test
window.showMistakeDetail = function(id) {
    const m = TRADER_MISTAKES.find(x => x.id === id) || TRADER_MISTAKES[0];
    const panel = document.getElementById('mistake-detail-panel');
    if (!panel || !m) return;

    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
            <div style="width:42px;height:42px;border-radius:14px;background:rgba(244,63,94,.15);border:1px solid rgba(244,63,94,.3);display:flex;align-items:center;justify-content:center">
                <i data-lucide="alert-triangle" style="width:20px;height:20px;color:var(--red)"></i>
            </div>
            <div>
                <p style="font-family:var(--font-mono);font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.2em;color:var(--tx-lo)">Sai lầm cần sửa · Tần suất ${m.frequency}% · Tổn thất ~${Math.abs(m.impact)}%</p>
                <h3 style="font-family:var(--font-display);font-size:1.2rem;font-weight:800;color:var(--tx-hi);margin-top:2px">${escapeHtml(m.name)}</h3>
            </div>
        </div>

        <!-- Self-test -->
        <div class="mistake-section">
            <p class="mistake-section-label">🔍 TỰ CHẨN ĐOÁN — Bạn có mắc lỗi này không?</p>
            <div class="self-test-list">
                ${m.selfTest.map((q, i) => `
                    <label class="self-test-item">
                        <input type="checkbox" data-mistake="${m.id}" data-idx="${i}">
                        <span>${escapeHtml(q)}</span>
                    </label>
                `).join('')}
            </div>
            <div class="self-test-result" id="self-test-result-${m.id}"></div>
        </div>

        <!-- Wrong vs Right -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
            <div class="mistake-detail-box danger">
                <b>❌ Cách làm sai</b>
                <p>${escapeHtml(m.wrong)}</p>
            </div>
            <div class="mistake-detail-box success">
                <b>✅ Cách làm đúng</b>
                <p>${escapeHtml(m.right)}</p>
            </div>
        </div>

        <!-- Case study -->
        ${m.caseStudy ? `
        <div class="case-study-box">
            <p class="mistake-section-label" style="color:var(--amber)">📖 CASE STUDY THỰC TẾ</p>
            <h4 style="color:var(--tx-hi);font-weight:700;font-size:.88rem;margin-top:8px">${escapeHtml(m.caseStudy.title)}</h4>
            <p style="color:var(--tx-mid);font-size:.78rem;line-height:1.65;margin-top:8px">${escapeHtml(m.caseStudy.story)}</p>
        </div>` : ''}

        <!-- Action fix -->
        <div class="mistake-fix-box">
            <p class="mistake-section-label" style="color:var(--green)">🛠 HÀNH ĐỘNG SỬA NGAY</p>
            <p style="color:var(--tx-hi);font-size:.85rem;line-height:1.65;margin-top:8px;font-weight:500">${escapeHtml(m.fix)}</p>
        </div>
    `;

    // Bind self-test handler
    document.querySelectorAll(`input[data-mistake="${m.id}"]`).forEach(input => {
        input.addEventListener('change', () => updateSelfTestResult(m.id));
    });

    if (window.lucide) lucide.createIcons();
};

function updateSelfTestResult(mistakeId) {
    const checks = document.querySelectorAll(`input[data-mistake="${mistakeId}"]:checked`);
    const total = document.querySelectorAll(`input[data-mistake="${mistakeId}"]`).length;
    const ratio = checks.length / total;

    const resultEl = document.getElementById(`self-test-result-${mistakeId}`);
    if (!resultEl) return;

    if (checks.length === 0) { resultEl.innerHTML = ''; return; }

    let level, color, msg;
    if (ratio >= 0.66) { level = '🚨 NGUY CƠ CAO'; color = 'var(--red)'; msg = 'Bạn đang mắc lỗi này — xem ngay phần Case Study + Hành động sửa bên dưới'; }
    else if (ratio >= 0.33) { level = '⚠️ DẤU HIỆU CẢNH BÁO'; color = 'var(--amber)'; msg = 'Có dấu hiệu — cần điều chỉnh hành vi sớm'; }
    else { level = '✓ Ổn định'; color = 'var(--green)'; msg = 'Lỗi này không phải vấn đề chính của bạn hiện tại'; }

    resultEl.innerHTML = `
        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(96,165,250,.05);border:1px solid var(--border)">
            <p style="font-weight:700;color:${color};font-size:.78rem">${level} — ${checks.length}/${total} dấu hiệu</p>
            <p style="font-size:.72rem;color:var(--tx-mid);margin-top:4px">${msg}</p>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #4: PRINCIPLE CARDS — Daily principle on dashboard
// ═══════════════════════════════════════════════════════════════
function renderDailyPrinciple() {
    const container = document.getElementById('daily-principle');
    if (!container) return;
    const p = getDailyPrinciple();
    if (!p) return;

    container.innerHTML = `
        <div class="daily-principle-content">
            <div class="daily-principle-header">
                <span class="daily-principle-label">${escapeHtml(p.principle || 'PRINCIPLE OF THE DAY')}</span>
                <span class="daily-principle-author">— ${escapeHtml(p.author || 'Trader Legend')}</span>
            </div>
            <h3 class="daily-principle-quote">"${escapeHtml(p.quote || p.title || '')}"</h3>
            ${p.whyTrue ? `<p class="daily-principle-why"><b>Tại sao đúng:</b> ${escapeHtml(p.whyTrue)}</p>` : ''}
            ${p.actionList && p.actionList.length ? `
                <div class="daily-principle-actions">
                    <p class="daily-principle-actions-label">✓ ÁP DỤNG NGAY HÔM NAY</p>
                    <ul>${p.actionList.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
                </div>
            ` : ''}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// IMPROVEMENT #3: MARKET REGIME DAILY CHECK
// ═══════════════════════════════════════════════════════════════
function checkDailyMarketRegime() {
    const today = new Date().toLocaleDateString('vi-VN');
    const stored = localStorage.getItem('market_regime_date');
    if (stored !== today || !dailyMarketRegime) {
        showMarketRegimeModal();
    } else {
        updateMarketRegimeBadge();
    }
}

function showMarketRegimeModal() {
    const modal = document.getElementById('market-regime-modal');
    if (modal) modal.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
}

window.setMarketRegime = function(regime) {
    dailyMarketRegime = regime;
    localStorage.setItem('market_regime_date', new Date().toLocaleDateString('vi-VN'));
    saveUserData();
    updateMarketRegimeBadge();
    closeModal('market-regime-modal');
};

function updateMarketRegimeBadge() {
    const badge = document.getElementById('market-regime-badge');
    if (!badge) return;
    if (!dailyMarketRegime) { badge.classList.add('hidden'); return; }

    const styles = {
        up:   { label: '↗ UPTREND',   color: 'var(--green)', bg: 'rgba(0,229,160,.12)' },
        side: { label: '↔ SIDEWAY',   color: 'var(--amber)', bg: 'rgba(245,158,11,.12)' },
        down: { label: '↘ DOWNTREND', color: 'var(--red)',   bg: 'rgba(244,63,94,.12)' }
    };
    const s = styles[dailyMarketRegime] || styles.side;
    badge.classList.remove('hidden');
    badge.style.color = s.color;
    badge.style.background = s.bg;
    badge.style.borderColor = s.color;
    badge.innerText = s.label;
}

// ═══════════════════════════════════════════════════════════════
// QUOTE POSTERS RENDER (with principle support)
// ═══════════════════════════════════════════════════════════════
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
    if (!isAdmin) { alert('Chỉ Admin mới được chèn ảnh.'); if(input) input.value = ''; return; }
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
    ['poster-edit-id','poster-title','poster-author','poster-quote','poster-image-data','poster-why-true','poster-action-list','poster-self-check'].forEach(id => {
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
    if(!isAdmin) return alert('Chỉ Admin!');
    const editId = document.getElementById('poster-edit-id')?.value?.trim();
    const title = document.getElementById('poster-title')?.value?.trim() || 'Bài học giao dịch';
    const author = document.getElementById('poster-author')?.value?.trim() || 'Trader Legend';
    const quote = document.getElementById('poster-quote')?.value?.trim();
    const image = document.getElementById('poster-image-data')?.value || '';
    const whyTrue = document.getElementById('poster-why-true')?.value?.trim() || '';
    const actionListText = document.getElementById('poster-action-list')?.value?.trim() || '';
    const actionList = actionListText.split('\n').map(s => s.trim()).filter(Boolean);
    const selfCheck = document.getElementById('poster-self-check')?.value?.trim() || '';

    if (!quote && !image) return alert('Cần nhập câu nói hoặc ảnh.');

    const principleData = { title, author, quote, image, whyTrue, actionList, selfCheck };

    if(editId) {
        const idx = quotePostersData.findIndex(item => item.id === editId);
        if(idx !== -1) quotePostersData[idx] = { ...quotePostersData[idx], ...principleData, updated_at: new Date().toISOString() };
    } else {
        quotePostersData.unshift({ id: Date.now().toString(), ...principleData, principle: `PRINCIPLE #${String(quotePostersData.length + 1).padStart(2, '0')}`, theme: 'custom', created_at: new Date().toISOString() });
    }
    saveQuotePostersData();
    renderQuotePosters();
    renderDailyPrinciple();
    window.resetPosterForm();
};

window.editQuotePoster = function(id) {
    if(!isAdmin) return alert('Chỉ Admin!');
    const item = quotePostersData.find(x => x.id === id);
    if(!item) return;
    const setVal = (field, value) => { const el = document.getElementById(field); if(el) el.value = value || ''; };
    setVal('poster-edit-id', item.id);
    setVal('poster-title', item.title);
    setVal('poster-author', item.author);
    setVal('poster-quote', item.quote);
    setVal('poster-image-data', item.image);
    setVal('poster-why-true', item.whyTrue);
    setVal('poster-action-list', Array.isArray(item.actionList) ? item.actionList.join('\n') : '');
    setVal('poster-self-check', item.selfCheck);

    const preview = document.getElementById('poster-image-preview');
    const hint = document.getElementById('poster-upload-hint');
    const saveBtn = document.getElementById('poster-save-btn');
    const cancelBtn = document.getElementById('poster-cancel-edit');
    if(item.image && preview) { preview.src = item.image; preview.classList.remove('hidden'); if(hint) hint.classList.add('hidden'); }
    else { if(preview) preview.classList.add('hidden'); if(hint) hint.classList.remove('hidden'); }
    if(saveBtn) saveBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Cập nhật';
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    const panel = document.getElementById('poster-admin-panel');
    if(panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if(window.lucide) lucide.createIcons();
};

window.deleteQuotePoster = function(id) {
    if(!isAdmin) return alert('Chỉ Admin!');
    if (!confirm('Xóa poster này?')) return;
    quotePostersData = quotePostersData.filter(item => item.id !== id);
    saveQuotePostersData();
    renderQuotePosters();
    renderDailyPrinciple();
    window.resetPosterForm();
};

function renderQuotePosters() {
    updatePosterAccessUI();
    const grid = document.getElementById('quote-poster-grid');
    if (!grid) return;
    const items = quotePostersData && quotePostersData.length ? quotePostersData : DEFAULT_QUOTE_POSTERS;
    grid.innerHTML = items.map(item => `
        <article class="poster-card group" onclick="showPrincipleDetail('${item.id}')">
            ${item.image ? `<img src="${item.image}" class="poster-card-img">` : `<div class="poster-card-placeholder"><i data-lucide="quote" style="width:36px;height:36px"></i></div>`}
            <div class="poster-card-overlay">
                <p class="poster-label">${escapeHtml(item.principle || item.title || 'PRINCIPLE')}</p>
                <h4>"${escapeHtml((item.quote || item.title || '').slice(0, 100))}"</h4>
                <div class="poster-footer">
                    <span>— ${escapeHtml(item.author || 'Legend')}</span>
                    ${isAdmin ? `<div class="poster-actions">
                        <button onclick="event.stopPropagation(); editQuotePoster('${item.id}')" class="poster-edit"><i data-lucide="pencil" class="w-3 h-3"></i></button>
                        <button onclick="event.stopPropagation(); deleteQuotePoster('${item.id}')" class="poster-delete"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
                    </div>` : ``}
                </div>
            </div>
        </article>
    `).join('');
    if (window.lucide) lucide.createIcons();
}

window.showPrincipleDetail = function(id) {
    const items = quotePostersData && quotePostersData.length ? quotePostersData : DEFAULT_QUOTE_POSTERS;
    const p = items.find(x => x.id === id);
    if (!p) return;
    const modal = document.getElementById('principle-detail-modal');
    if (!modal) return;

    document.getElementById('principle-modal-content').innerHTML = `
        <p class="principle-modal-label">${escapeHtml(p.principle || 'PRINCIPLE')}</p>
        <h2 class="principle-modal-title">${escapeHtml(p.title || '')}</h2>
        <p class="principle-modal-author">— ${escapeHtml(p.author || 'Trader Legend')}</p>
        <div class="principle-modal-quote">
            <i data-lucide="quote" style="width:20px;height:20px;color:var(--green);opacity:.5"></i>
            <p>"${escapeHtml(p.quote || '')}"</p>
        </div>
        ${p.whyTrue ? `
        <div class="principle-modal-section">
            <p class="principle-modal-section-label">📖 TẠI SAO ĐÚNG</p>
            <p>${escapeHtml(p.whyTrue)}</p>
        </div>` : ''}
        ${p.actionList && p.actionList.length ? `
        <div class="principle-modal-section">
            <p class="principle-modal-section-label" style="color:var(--green)">✓ ÁP DỤNG NGAY HÔM NAY</p>
            <ul class="principle-action-list">${p.actionList.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
        </div>` : ''}
        ${p.selfCheck ? `
        <div class="principle-modal-section">
            <p class="principle-modal-section-label" style="color:var(--amber)">🔍 KIỂM TRA BẢN THÂN</p>
            <p style="font-style:italic">${escapeHtml(p.selfCheck)}</p>
        </div>` : ''}
    `;
    modal.classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
};

// ═══════════════════════════════════════════════════════════════
// MISTAKES PREVIEW & CHARTS
// ═══════════════════════════════════════════════════════════════
function renderMistakesPreview() {
    const list = document.getElementById('mistakes-preview-list');
    if (list) {
        list.innerHTML = TRADER_MISTAKES.slice(0, 4).map((m, i) => `
            <button onclick="switchTab('mistakes'); showMistakeDetail('${m.id}')" class="mistake-mini-card">
                <span class="mistake-rank">${i + 1}</span>
                <span class="flex-1 text-left"><b>${escapeHtml(m.name)}</b><small>${escapeHtml(m.symptom)}</small></span>
                <span class="font-mono" style="color:var(--red)">${m.impact}%</span>
            </button>
        `).join('');
    }

    const grid = document.getElementById('mistake-card-grid');
    if (grid) {
        grid.innerHTML = TRADER_MISTAKES.map(m => `
            <button onclick="showMistakeDetail('${m.id}')" class="mistake-card-pro">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px">
                    <h3>${escapeHtml(m.name)}</h3>
                    <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--tx-lo)">${m.frequency}%</span>
                </div>
                <p>${escapeHtml(m.symptom)}</p>
                <div style="margin-top:14px;height:5px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden">
                    <div style="height:100%;background:linear-gradient(90deg,var(--red),#ff8896);width:${m.frequency}%"></div>
                </div>
            </button>
        `).join('');
    }

    const body = document.getElementById('mistake-comparison-body');
    if (body) {
        body.innerHTML = TRADER_MISTAKES.map(m => `
            <tr>
                <td class="p-3" style="font-weight:700;color:var(--tx-hi)">${escapeHtml(m.name)}</td>
                <td class="p-3" style="color:#fda4af">${escapeHtml(m.wrong)}</td>
                <td class="p-3" style="color:#6ee7b7">${escapeHtml(m.right)}</td>
                <td class="p-3" style="color:var(--tx-mid)">${escapeHtml(m.fix)}</td>
            </tr>
        `).join('');
    }
    if (window.lucide) lucide.createIcons();
}

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
    const commonOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { ticks: { color: '#8da5c4', font:{size:10} }, grid: { color: 'rgba(96,165,250,.06)' } },
            y: { ticks: { color: '#8da5c4', font:{size:10} }, grid: { color: 'rgba(96,165,250,.06)' } }
        }
    };

    makeChart('chart-mistake-preview', 'mistakePreview', {
        type: 'bar',
        data: { labels: TRADER_MISTAKES.slice(0,4).map(m => m.name), datasets: [{ data: TRADER_MISTAKES.slice(0,4).map(m => Math.abs(m.impact)), borderRadius: 8, backgroundColor: 'rgba(244,63,94,.6)' }] },
        options: { ...commonOptions, indexAxis: 'y' }
    });
    makeChart('chart-mistake-freq', 'mistakeFreq', {
        type: 'bar',
        data: { labels, datasets: [{ data: frequency, borderRadius: 8, backgroundColor: 'rgba(245,158,11,.6)' }] },
        options: commonOptions
    });
    makeChart('chart-mistake-impact', 'mistakeImpact', {
        type: 'line',
        data: { labels, datasets: [{ data: impact, tension: .35, borderColor: 'rgba(244,63,94,.95)', backgroundColor: 'rgba(244,63,94,.10)', fill: true, pointRadius: 4 }] },
        options: commonOptions
    });
    window.showMistakeDetail('fomo');
}

// ═══════════════════════════════════════════════════════════════
// DISCIPLINE MODULES
// ═══════════════════════════════════════════════════════════════
function renderDisciplineModules() {
    const grid = document.getElementById('discipline-module-grid');
    if(!grid) return;
    grid.innerHTML = TRADER_DISCIPLINE_MODULES.map((m, idx) => `
        <article class="discipline-card">
            <div class="discipline-icon"><i data-lucide="${m.icon}" style="width:18px;height:18px"></i></div>
            <div class="discipline-content">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h3>${escapeHtml(m.title)}</h3><span>${idx + 1}</span></div>
                <p>${escapeHtml(m.desc)}</p>
                <div class="discipline-meta"><b>${escapeHtml(m.priority)}</b></div>
                <small>${escapeHtml(m.build)}</small>
            </div>
        </article>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

function renderDisciplineGrid() {
    const grid = document.getElementById('discipline-grid-full');
    if(!grid) return;
    grid.innerHTML = TRADER_DISCIPLINE_MODULES.map((m, idx) => `
        <article class="discipline-card">
            <div class="discipline-icon"><i data-lucide="${m.icon}" style="width:20px;height:20px"></i></div>
            <div class="discipline-content">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h3>${escapeHtml(m.title)}</h3><span>${idx + 1}</span></div>
                <p>${escapeHtml(m.desc)}</p>
                <div class="discipline-meta"><b>${escapeHtml(m.priority)}</b></div>
                <small style="color:var(--green) !important;font-weight:600">${escapeHtml(m.build)}</small>
            </div>
        </article>
    `).join('');
    if(window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// FILTERS, GRIDS
// ═══════════════════════════════════════════════════════════════
window.filterWiki = function() {
    const q = (document.getElementById('wiki-search')?.value || '').toLowerCase();
    const grid = document.getElementById('wiki-grid');
    if (!grid) return;
    grid.innerHTML = wikiData.filter(i => [i.title, i.code, i.cat, i.content].join(' ').toLowerCase().includes(q)).map(i => renderWikiCardHTML(i)).join('');
    if(window.lucide) lucide.createIcons();
};

window.filterLibrary = function() {
    const q = (document.getElementById('library-search')?.value || '').toLowerCase();
    const grid = document.getElementById('library-grid');
    if (!grid) return;
    grid.innerHTML = libraryData.filter(i => [i.title, i.code, i.cat, i.content].join(' ').toLowerCase().includes(q)).map(i => renderLibraryCardHTML(i)).join('');
    if(window.lucide) lucide.createIcons();
};

function renderWikiCardHTML(i) {
    const levelBadge = i.level ? `<span style="position:absolute;top:8px;right:8px;background:rgba(0,229,160,.85);color:#022a1e;font-size:.55rem;font-weight:800;padding:2px 6px;border-radius:6px">L${i.level}</span>` : '';
    return `<div class="wiki-card" onclick="viewWikiDetail('${i.id}', 'wiki')">
        <div class="wiki-card-thumb">
            ${levelBadge}
            ${i.image ? `<img src="${i.image}" onerror="this.outerHTML='<div class=&quot;wiki-card-placeholder&quot;><i data-lucide=&quot;image-off&quot; style=&quot;width:24px;height:24px&quot;></i></div>'">` : `<div class="wiki-card-placeholder"><i data-lucide="layout-template" style="width:24px;height:24px"></i></div>`}
        </div>
        <div class="wiki-card-body">
            <h4>${escapeHtml(i.title)}</h4>
            <div class="wiki-card-meta">
                <span class="wiki-code">${escapeHtml(i.code)}</span>
                ${i.cat ? `<span class="wiki-cat">${escapeHtml(i.cat)}</span>` : ''}
            </div>
        </div>
    </div>`;
}

function renderLibraryCardHTML(i) {
    return `<div class="wiki-card library" onclick="viewWikiDetail('${i.id}', 'library')">
        <div class="wiki-card-thumb">
            ${i.image ? `<img src="${i.image}" onerror="this.outerHTML='<div class=&quot;wiki-card-placeholder&quot;><i data-lucide=&quot;image-off&quot; style=&quot;width:24px;height:24px&quot;></i></div>'">` : `<div class="wiki-card-placeholder"><i data-lucide="book-open" style="width:24px;height:24px"></i></div>`}
        </div>
        <div class="wiki-card-body">
            <h4 style="color:#bfdbfe">${escapeHtml(i.title)}</h4>
            <div class="wiki-card-meta">
                <span class="wiki-code" style="background:rgba(96,165,250,.18);color:#bfdbfe">${escapeHtml(i.cat || i.code)}</span>
            </div>
        </div>
    </div>`;
}

window.renderWikiGrid = function() {
    const grid = document.getElementById('wiki-grid');
    if(!grid) return;
    grid.innerHTML = wikiData.map(renderWikiCardHTML).join('');
    if(window.lucide) lucide.createIcons();
}

window.renderLibraryGrid = function() {
    const grid = document.getElementById('library-grid');
    if(!grid) return;
    grid.innerHTML = libraryData.map(renderLibraryCardHTML).join('');
    if(window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// PSYCHOLOGY ADVICE + BREATHING TIMER (real)
// ═══════════════════════════════════════════════════════════════
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

// Breathing timer 4-7-8
window.startBreathing = function() {
    if (breathingActive) return;
    breathingActive = true;
    const phases = [
        { name: 'HÍT VÀO', sub: '(Phình bụng)', sec: 4, color: '#22d3ee' },
        { name: 'GIỮ',     sub: '(Nín thở)',    sec: 7, color: '#a78bfa' },
        { name: 'THỞ RA',  sub: '(Hóp bụng)',   sec: 8, color: '#34d399' }
    ];
    let cycle = 0, phaseIdx = 0, secLeft = phases[0].sec;
    const totalCycles = 4;
    const txt = document.getElementById('breathing-text');
    const sub = document.getElementById('breathing-sub');
    const counter = document.getElementById('breathing-counter');
    const startBtn = document.getElementById('breathing-start-btn');

    if (startBtn) startBtn.innerText = 'Đang chạy...';

    const tick = () => {
        if (!breathingActive) return;
        const p = phases[phaseIdx];
        if (txt) { txt.innerText = p.name; txt.style.color = p.color; }
        if (sub) sub.innerText = p.sub;
        if (counter) counter.innerText = `${secLeft}s · Chu kỳ ${cycle+1}/${totalCycles}`;
        secLeft--;
        if (secLeft < 0) {
            phaseIdx++;
            if (phaseIdx >= phases.length) {
                phaseIdx = 0;
                cycle++;
                if (cycle >= totalCycles) {
                    breathingActive = false;
                    if (txt) { txt.innerText = '✓ HOÀN THÀNH'; txt.style.color = 'var(--green)'; }
                    if (sub) sub.innerText = 'Sẵn sàng giao dịch';
                    if (counter) counter.innerText = '4 chu kỳ ✓';
                    if (startBtn) startBtn.innerText = 'Bắt đầu lại';
                    return;
                }
            }
            secLeft = phases[phaseIdx].sec;
        }
        setTimeout(tick, 1000);
    };
    tick();
};

// ═══════════════════════════════════════════════════════════════
// AUTH (giữ nguyên logic gốc)
// ═══════════════════════════════════════════════════════════════
window.__appLoaded = true;
window.enterSystem = function() {
    const landing = document.getElementById('landing-page');
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-container');
    if (landing) { landing.classList.add('hidden'); landing.style.display = 'none'; landing.style.pointerEvents = 'none'; }
    if (app) { app.classList.add('hidden'); app.classList.remove('flex'); app.style.display = 'none'; }
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
function showAppAfterLogin(username) {
    window.currentUser = username;
    localStorage.setItem('min_sys_current_user', username);
    const landing = document.getElementById('landing-page');
    const auth = document.getElementById('auth-screen');
    const app = document.getElementById('app-container');
    if (landing) { landing.classList.add('hidden'); landing.style.display = 'none'; landing.style.pointerEvents = 'none'; }
    if (auth) { auth.classList.add('hidden'); auth.classList.remove('fade-in'); auth.style.display = 'none'; auth.style.opacity = '0'; auth.style.pointerEvents = 'none'; }
    if (app) { app.classList.remove('hidden'); app.classList.add('flex'); app.style.display = 'flex'; app.style.opacity = '1'; app.style.pointerEvents = 'auto'; }
}

window.authLogin = async function() {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    if(!u || !p) return alert('Thiếu thông tin!');
    const loginBtn = document.querySelector('#login-form button[onclick="authLogin()"]');
    const oldBtnText = loginBtn ? loginBtn.innerHTML : '';
    if (loginBtn) { loginBtn.disabled = true; loginBtn.innerHTML = 'ĐANG ĐĂNG NHẬP...'; }
    try {
        const userDocRef = doc(db, 'users', u);
        const snap = await getDoc(userDocRef);
        if(!snap.exists()) {
            if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) {
                await setDoc(userDocRef, { username:u, password:p, email:'admin@sys', status:'approved', journal:[], pairs:DEFAULT_PAIRS, capital:20000, created_at:new Date().toISOString() }, { merge: true });
                showAppAfterLogin(u);
                await window.loadData();
                return;
            }
            return alert('Chưa có tài khoản!');
        }
        const d = snap.data();
        let passValid = (String(d.password || '') === p);
        if(ADMIN_LIST.includes(u) && p === ADMIN_MASTER_PASS) passValid = true;
        if(!passValid) return alert('Sai mật khẩu!');
        if(d.status === 'pending' && !ADMIN_LIST.includes(u)) return alert('Tài khoản chờ duyệt!');
        showAppAfterLogin(u);
        await window.loadData();
    } catch(e) {
        alert('Lỗi đăng nhập: ' + e.message);
    } finally {
        if (loginBtn) { loginBtn.disabled = false; loginBtn.innerHTML = oldBtnText || 'VÀO HỆ THỐNG'; }
    }
}
window.authRegister = async function() { const u = document.getElementById('reg-user').value.trim(); const p = document.getElementById('reg-pass').value.trim(); const e = document.getElementById('reg-email').value.trim(); if(!u || !p) return; try { const snap = await getDoc(doc(db, "users", u)); if(snap.exists()) return alert("Tên tồn tại!"); await setDoc(doc(db, "users", u), { username:u, password:p, email:e, status: ADMIN_LIST.includes(u) ? 'approved':'pending', journal:[], pairs:DEFAULT_PAIRS, capital:20000, created_at:new Date().toISOString() }); alert("Đăng ký thành công!"); window.toggleAuth(); } catch(e) { alert("Lỗi: "+e.message); } }
window.toggleAuth = () => { document.getElementById('login-form').classList.toggle('hidden'); document.getElementById('register-form').classList.toggle('hidden'); }
window.authLogout = () => { localStorage.removeItem('min_sys_current_user'); location.reload(); }

// ═══════════════════════════════════════════════════════════════
// DASHBOARD RENDER
// ═══════════════════════════════════════════════════════════════
window.renderDashboard = function() {
    if(!journalData) return;
    const closed = journalData.filter(t=>t.status!=='OPEN');
    let wins=0, pnl=0, maxDD=0, peak=initialCapital, bal=initialCapital, monthStats = {}, patternStats = {};
    closed.forEach(t=>{
        const v = parseFloat(t.pnl);
        pnl+=v; bal+=v;
        if(t.status==='WIN') wins++;
        if(bal > peak) peak = bal;
        const dd = peak > 0 ? (peak - bal)/peak : 0;
        if(dd > maxDD) maxDD = dd;
        const parts = t.date.split('/');
        if(parts.length === 3) {
            const mKey = `${parts[1]}/${parts[2]}`;
            if(!monthStats[mKey]) monthStats[mKey] = {total:0, win:0, loss:0, pnl:0};
            monthStats[mKey].total++;
            monthStats[mKey].pnl += v;
            if(t.status==='WIN') monthStats[mKey].win++;
            else if(t.status==='LOSS') monthStats[mKey].loss++;
        }
        const strat = t.strategy || "Unknown";
        if(!patternStats[strat]) patternStats[strat] = {pnl:0, win:0, total:0};
        patternStats[strat].pnl += v;
        patternStats[strat].total++;
        if(t.status==='WIN') patternStats[strat].win++;
    });
    safeSetText('dash-balance', `$${bal.toLocaleString()}`);
    safeSetText('dash-pnl', `$${pnl.toLocaleString()}`);
    safeSetText('dash-winrate', `${closed.length ? Math.round((wins/closed.length)*100) : 0}%`);
    safeSetText('dash-dd', `${(maxDD*100).toFixed(2)}%`);
    const mBody = document.getElementById('stats-monthly-body');
    if(mBody) mBody.innerHTML = Object.entries(monthStats).sort((a,b) => { const [m1, y1] = a[0].split('/'); const [m2, y2] = b[0].split('/'); return new Date(y2, m2) - new Date(y1, m1); }).map(([k,v]) => `<tr><td class="p-2" style="font-weight:600;color:var(--tx-mid);font-size:.75rem">${k}</td><td class="p-2 text-center" style="font-size:.78rem">${v.total}</td><td class="p-2 text-center" style="color:var(--green);font-weight:700;font-size:.78rem">${v.win}</td><td class="p-2 text-center" style="color:var(--red);font-weight:700;font-size:.78rem">${v.loss}</td><td class="p-2 text-right font-bold" style="color:${v.pnl>=0?'var(--green)':'var(--red)'};font-size:.78rem">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="5" class="p-3 text-center" style="color:var(--tx-lo);font-size:.75rem">Chưa có dữ liệu</td></tr>';
    const pBody = document.getElementById('stats-pattern-body');
    if(pBody) pBody.innerHTML = Object.entries(patternStats).sort((a,b) => b[1].pnl - a[1].pnl).map(([k,v], i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px"><div style="display:flex;align-items:center;gap:10px"><span style="width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:800;background:${i===0?'var(--amber)':'var(--bg-hover)'};color:${i===0?'#000':'var(--tx-mid)'}">${i+1}</span><div><p style="font-size:.78rem;font-weight:700;color:var(--tx-hi)">${escapeHtml(k)}</p><p style="font-size:.65rem;color:var(--tx-lo)">${v.win}/${v.total} wins</p></div></div><span style="font-family:var(--font-mono);font-weight:700;color:${v.pnl>=0?'var(--green)':'var(--red)'};font-size:.82rem">${v.pnl>=0?'+':''}$${v.pnl.toLocaleString()}</span></div>`).join('') || '<div style="text-align:center;color:var(--tx-lo);font-size:.78rem;padding:20px">Chưa có dữ liệu</div>';
    renderCharts(closed, initialCapital);
    renderQuotePosters();
    renderMistakesPreview();
    renderMistakeCharts();
    renderDisciplineModules();
    renderDailyPrinciple();
    renderMistakeAlerts();
}

window.renderCharts = function(data, start) {
    const ctx1=document.getElementById('chart-equity');
    const ctx2=document.getElementById('chart-winloss');
    if(chartInst.eq) { chartInst.eq.destroy(); chartInst.eq = null; }
    if(chartInst.wl) { chartInst.wl.destroy(); chartInst.wl = null; }
    if(ctx1 && window.Chart) {
        let b = start;
        const pts = [start, ...data.map(t=>b+=parseFloat(t.pnl))];
        chartInst.eq = new Chart(ctx1, {type:'line', data:{labels:pts.map((_,i)=>i), datasets:[{data:pts, borderColor:'#00e5a0', fill:true, backgroundColor:'rgba(0,229,160,0.08)', tension:0.4, borderWidth:2, pointRadius:0}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:false}, scales:{x:{display:false}, y:{ticks:{color:'#8da5c4',font:{size:10}}, grid:{color:'rgba(96,165,250,.06)'}}}}});
    }
    if(ctx2 && window.Chart) {
        let w=0, l=0;
        data.forEach(t=>t.status==='WIN'?w++:l++);
        chartInst.wl = new Chart(ctx2, {type:'doughnut', data:{labels:['Win','Loss'], datasets:[{data:[w,l], backgroundColor:['#00e5a0','#f43f5e'], borderWidth:0}]}, options:{responsive:true,maintainAspectRatio:false,cutout:'70%', plugins:{legend:{position:'bottom', labels:{color:'#8da5c4',font:{size:11}}}}}});
    }
}

// ═══════════════════════════════════════════════════════════════
// WIKI EDITOR / VIEW
// ═══════════════════════════════════════════════════════════════
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
            uploadHint.innerHTML = `<p style="font-size:.78rem;font-weight:700;color:var(--amber)">Đang nén ảnh...</p>`;
        }
        const dataUrl = await compressImageFile(file);
        document.getElementById('edit-image-url').value = dataUrl;
        imgPreview.src = dataUrl;
        imgPreview.classList.remove('hidden');
        if(uploadHint) {
            uploadHint.classList.add('hidden');
            uploadHint.innerHTML = `<i data-lucide="image-plus" style="width:28px;height:28px;color:var(--green);margin-bottom:6px"></i><p style="font-size:.78rem;font-weight:700;color:var(--tx-mid)">Bấm để chọn ảnh</p>`;
        }
        if(window.lucide) lucide.createIcons();
    } catch (error) {
        alert('Không xử lý được ảnh:\n' + error.message);
    } finally {
        wikiImageProcessing = false;
        input.value = '';
    }
}

window.saveWiki = async function() {
    if (!isAdmin) return alert('Chỉ Admin!');
    if (wikiImageProcessing) return alert('Ảnh đang nén. Đợi vài giây.');
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
    } catch (error) {
        alert('🚨 LỖI:\n' + error.message);
    }
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
            } catch(error) { alert('Không xóa được:\n' + error.message); }
        };
    } else {
        btnEdit.style.display='none';
        btnDel.style.display='none';
    }
    document.getElementById('wiki-detail-modal').classList.remove('hidden');
    if(window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════
// TRAINING (giữ nguyên)
// ═══════════════════════════════════════════════════════════════
let currentQuizCorrectItem = null;

window.loadRandomTraining = function() {
    let allData = [...libraryData];
    const filterEl = document.getElementById('training-filter');
    const filterCat = filterEl ? filterEl.value : 'all';
    if(filterCat !== 'all') {
        allData = allData.filter(item => item.cat && item.cat.toLowerCase().includes(filterCat.toLowerCase()));
    }
    if(allData.length === 0) {
        const tImg = document.getElementById('training-image');
        if(tImg) tImg.classList.add('hidden');
        const tEmp = document.getElementById('training-empty');
        if(tEmp) tEmp.classList.remove('hidden');
        const tInt = document.getElementById('quiz-interface');
        if(tInt) tInt.classList.add('hidden');
        return;
    }
    const randomIndex = Math.floor(Math.random() * allData.length);
    currentQuizCorrectItem = allData[randomIndex];
    let wrongOptions = allData.filter(i => i.id !== currentQuizCorrectItem.id);
    while (wrongOptions.length < 3) { wrongOptions.push({title: "Không xác định", id: "dummy"}); if (wrongOptions.length >= 3) break; }
    wrongOptions = wrongOptions.sort(() => 0.5 - Math.random()).slice(0, 3);
    let quizOptions = [currentQuizCorrectItem, ...wrongOptions];
    quizOptions = quizOptions.sort(() => 0.5 - Math.random());
    const empty = document.getElementById('training-empty');
    if (empty) empty.classList.add('hidden');
    const tImg = document.getElementById('training-image');
    if (tImg) { tImg.src = currentQuizCorrectItem.image; tImg.classList.remove('hidden'); }
    document.getElementById('quiz-result-panel').classList.add('hidden');
    document.getElementById('quiz-interface').classList.remove('hidden');
    const grid = document.getElementById('quiz-options-grid');
    grid.innerHTML = quizOptions.map(opt => `<button onclick="checkQuizAnswer('${opt.id}')" style="background:var(--bg-hover);border:1px solid var(--border);color:var(--tx-mid);border-radius:10px;padding:8px;font-size:.72rem;font-weight:700;transition:.15s ease;cursor:pointer" onmouseover="this.style.borderColor='var(--amber)';this.style.color='var(--tx-hi)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--tx-mid)'">${escapeHtml(opt.title || "Lựa chọn khác")}</button>`).join('');
}

window.checkQuizAnswer = function(selectedId) {
    const resultPanel = document.getElementById('quiz-result-panel');
    const statusTitle = document.getElementById('result-status');
    const contentText = document.getElementById('result-content');
    const titleText = document.getElementById('result-title');
    resultPanel.classList.remove('hidden');
    if (selectedId === currentQuizCorrectItem.id) {
        statusTitle.innerHTML = `<span style="color:var(--green)">CHÍNH XÁC! 🎉</span>`;
    } else {
        statusTitle.innerHTML = `<span style="color:var(--red)">SAI RỒI! 😅</span>`;
    }
    titleText.innerText = currentQuizCorrectItem.title;
    contentText.innerHTML = currentQuizCorrectItem.content
        ? currentQuizCorrectItem.content
        : "<i style='color:var(--tx-lo)'>Chưa có nội dung giải thích.</i>";
}

// ═══════════════════════════════════════════════════════════════
// JOURNAL & MISC
// ═══════════════════════════════════════════════════════════════
window.openAdminPanel = async () => { document.getElementById('admin-modal').classList.remove('hidden'); const tb = document.getElementById('admin-user-list'); tb.innerHTML = 'Loading...'; const s = await getDocs(collection(db, "users")); let h = ''; s.forEach(d => { const u = d.data(); const delBtn = u.username===window.currentUser ? '' : `<button onclick="deleteUser('${u.username}')" style="color:var(--red);margin-left:8px;cursor:pointer;background:none;border:none"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>`; const appBtn = u.status==='pending' ? `<button onclick="approveUser('${u.username}')" style="background:var(--green);color:#022a1e;padding:4px 10px;border-radius:6px;font-size:.7rem;font-weight:700;cursor:pointer;border:none">Duyệt</button>` : `<span style="color:var(--green);font-size:.72rem">Đã duyệt</span>`; h += `<tr><td class="p-3" style="color:var(--tx-hi);font-weight:600">${escapeHtml(u.username)}</td><td class="p-3 text-right">${appBtn} ${delBtn}</td></tr>`; }); tb.innerHTML = h || 'Trống'; if(window.lucide) lucide.createIcons(); }
window.approveUser = async (u) => { if(confirm("Duyệt?")) { await updateDoc(doc(db,"users",u),{status:'approved'}); window.openAdminPanel(); } }
window.deleteUser = async (u) => { if(confirm("Xóa vĩnh viễn?")) { await deleteDoc(doc(db,"users",u)); window.openAdminPanel(); } }

window.selectAnalysisStrategy = function(id) {
    const item = wikiData.find(x=>x.id==id);
    if(item) {
        selectedAnalysisStrategy=item;
        document.getElementById('current-setup-name').innerText=item.title;
        document.getElementById('ana-theory-img').src=item.image;
        document.getElementById('ana-theory-content').innerText=item.content;
        document.getElementById('analysis-empty-state').classList.add('hidden');
    }
}
window.handleAnalysisUpload = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('ana-real-img').src=e.target.result; document.getElementById('ana-real-img').classList.remove('hidden'); currentAnalysisTabImg=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.transferAnalysisToJournal = function() { if(!selectedAnalysisStrategy) return alert("Chọn Setup trước!"); window.switchTab('journal'); window.openEntryModal(); if(currentAnalysisTabImg) { currentEntryImgBase64=currentAnalysisTabImg; document.getElementById('entry-img-preview').src=currentAnalysisTabImg; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); } }

window.handleEntryImage = function(inp) { if(inp.files[0]) { const r = new FileReader(); r.onload=(e)=>{ document.getElementById('entry-img-preview').src=e.target.result; document.getElementById('entry-img-preview').classList.remove('hidden'); document.getElementById('entry-upload-hint').classList.add('hidden'); currentEntryImgBase64=e.target.result; }; r.readAsDataURL(inp.files[0]); } }
window.deleteEntry = (id) => { if(confirm('Xóa?')) { journalData=journalData.filter(x=>x.id!=id); saveUserData(); renderJournalList(); renderDashboard(); renderMistakeAlerts(); } }

window.populateStrategies = () => {
    const list = document.getElementById('strategy-list-container');
    if(list) list.innerHTML = wikiData.map(w=>`<div style="padding:10px 12px;border-radius:8px;cursor:pointer;transition:.15s ease;background:var(--bg-raised);border:1px solid var(--border)" onmouseover="this.style.background='var(--bg-hover)';this.style.borderColor='var(--green)'" onmouseout="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'" onclick="selectAnalysisStrategy('${w.id}')"><p style="font-weight:700;font-size:.78rem;color:var(--tx-hi)">${escapeHtml(w.code)}</p><p style="font-size:.7rem;color:var(--tx-lo);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(w.title)}</p></div>`).join('');
    const sel = document.getElementById('inp-strategy');
    if(sel) sel.innerHTML = wikiData.map(w=>`<option value="${w.code}">${w.code} - ${w.title}</option>`).join('');
};

window.viewImageFull = (src) => { document.getElementById('image-viewer-img').src=src; document.getElementById('image-viewer-modal').classList.remove('hidden'); }
window.saveInitialCapital = () => { initialCapital = parseFloat(document.getElementById('real-init-capital').value)||20000; saveUserData(); renderDashboard(); alert("Đã lưu!"); };

window.updateCapitalCalc = () => {
    const start = parseFloat(document.getElementById('cap-sim-start')?.value)||0;
    const pct = parseFloat(document.getElementById('cap-risk-pct')?.value)||1;
    const rr = parseFloat(document.getElementById('cap-rr')?.value)||2;
    const n = parseInt(document.getElementById('cap-sim-count')?.value)||20;
    let bal = start, html = '';
    for(let i=1; i<=n; i++) {
        const risk = bal*(pct/100);
        const profit = risk*rr;
        const end = bal+profit;
        html += `<tr><td class="p-2 text-center">${i}</td><td class="p-2 text-right">$${Math.round(bal).toLocaleString()}</td><td class="p-2 text-right" style="color:var(--red)">-$${Math.round(risk).toLocaleString()}</td><td class="p-2 text-right" style="color:var(--green);font-weight:700">+$${Math.round(profit).toLocaleString()}</td><td class="p-2 text-right" style="font-weight:700;color:var(--tx-hi)">$${Math.round(end).toLocaleString()}</td></tr>`;
        bal = end;
    }
    const list = document.getElementById('cap-projection-list');
    if(list) list.innerHTML = html;
}

window.updateDailyPnL = function() {
    const today = new Date().toLocaleDateString('vi-VN');
    const pnl = journalData.filter(t => t.date === today).reduce((sum, t) => sum + parseFloat(t.pnl), 0);
    safeSetText('journal-pnl-today', (pnl >= 0 ? '+' : '') + `$${pnl.toLocaleString()}`);
}

window.renderJournalList = function() {
    const list = document.getElementById('journal-list');
    if (!list) return;
    list.innerHTML = journalData.map(t => {
        const moodIcon = t.mood && MOOD_STATES[t.mood] ? MOOD_STATES[t.mood].emoji : '';
        const qualityBadge = t.qualityScore ? `<span style="font-family:var(--font-mono);font-size:.6rem;background:var(--bg-hover);padding:2px 5px;border-radius:4px;color:var(--tx-mid)">${t.qualityScore}%</span>` : '';
        return `<tr style="border-bottom:1px solid var(--border)">
            <td class="p-3"><div style="font-weight:700;color:var(--tx-hi);font-size:.78rem">${escapeHtml(t.date)}</div><div style="font-size:.6rem;text-transform:uppercase;color:var(--tx-lo);font-weight:700;letter-spacing:.08em">${escapeHtml(t.session || 'SESSION')}</div></td>
            <td class="p-3" style="font-size:.82rem"><span style="font-weight:700;color:${t.dir === 'BUY' ? 'var(--green)' : 'var(--red)'}">${escapeHtml(t.dir)}</span> <span style="color:var(--tx-hi);font-weight:600">${escapeHtml(t.pair)}</span> ${moodIcon}</td>
            <td class="p-3 text-center">${t.image ? `<div style="width:36px;height:36px;border-radius:8px;overflow:hidden;margin:0 auto;border:1px solid var(--border);cursor:zoom-in" onclick="viewImageFull('${t.image}')"><img src="${t.image}" style="width:100%;height:100%;object-fit:cover"></div>` : '<span style="color:var(--tx-lo);font-size:.7rem">-</span>'}</td>
            <td class="p-3" style="font-size:.72rem;color:var(--tx-mid)">${escapeHtml(t.strategy)} ${qualityBadge}</td>
            <td class="p-3 text-center" style="font-family:var(--font-mono);font-size:.72rem;color:var(--tx-lo)">1:${escapeHtml(t.rr)}</td>
            <td class="p-3 text-center"><select onchange="updateEntryStatus('${t.id}', this.value)" style="background:transparent;font-size:.7rem;font-weight:700;outline:none;cursor:pointer;border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:${t.status === 'WIN' ? 'var(--green)' : t.status === 'LOSS' ? 'var(--red)' : 'var(--blue)'}"><option value="OPEN" ${t.status === 'OPEN' ? 'selected' : ''}>OPEN</option><option value="WIN" ${t.status === 'WIN' ? 'selected' : ''}>WIN</option><option value="LOSS" ${t.status === 'LOSS' ? 'selected' : ''}>LOSS</option></select></td>
            <td class="p-3 text-right" style="font-family:var(--font-mono);font-weight:700;color:${parseFloat(t.pnl) > 0 ? 'var(--green)' : parseFloat(t.pnl) < 0 ? 'var(--red)' : 'var(--tx-lo)'}">${parseFloat(t.pnl) > 0 ? '+' : ''}$${parseFloat(t.pnl).toLocaleString()}</td>
            <td class="p-3 text-center"><button onclick="deleteEntry('${t.id}')" style="padding:6px;border-radius:6px;color:var(--tx-lo);cursor:pointer;background:none;border:none;transition:.15s ease" onmouseover="this.style.color='var(--red)';this.style.background='rgba(244,63,94,.1)'" onmouseout="this.style.color='var(--tx-lo)';this.style.background='none'"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button></td>
        </tr>`;
    }).join('');
    updateDailyPnL();
    if(window.lucide) lucide.createIcons();
}

window.renderPairSelects = function() {
    const h = pairsData.map(p=>`<option value="${p}">${p}</option>`).join('');
    const inpSel = document.getElementById('inp-pair');
    if(inpSel) inpSel.innerHTML=h;
}

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════
window.openBgModal = () => {};
window.setBackground = () => {
    const isDark = document.documentElement.classList.contains('dark');
    document.body.className = `text-slate-200 min-h-screen flex flex-col overflow-hidden`;
};

window.initTheme = () => {
    const isDark = localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if(isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    const btn = document.getElementById('theme-toggle-btn');
    if(btn) btn.innerHTML = isDark ? `<i data-lucide="sun" style="width:16px;height:16px;color:var(--amber)"></i>` : `<i data-lucide="moon" style="width:16px;height:16px;color:var(--tx-mid)"></i>`;
    if(window.lucide) lucide.createIcons();
};

window.closeModal = (id) => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); };

window.switchTab = (id) => {
    document.querySelectorAll('main > div[id^="tab-"]').forEach(e=>e.classList.add('hidden'));
    const tab = document.getElementById('tab-'+id);
    if(tab) tab.classList.remove('hidden');
    document.querySelectorAll('[data-tab-btn]').forEach(btn => btn.classList.toggle('active', btn.dataset.tabBtn === id));
    if(id==='dashboard') renderDashboard();
    if(id==='mistakes') { renderMistakesPreview(); setTimeout(renderMistakeCharts, 50); }
    if(id==='discipline') { renderDisciplineModules(); renderDisciplineGrid(); }
    if(window.lucide) lucide.createIcons();
};

window.toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.theme = isDark ? 'dark' : 'light';
    const btn = document.getElementById('theme-toggle-btn');
    if(btn) btn.innerHTML = isDark ? `<i data-lucide="sun" style="width:16px;height:16px;color:var(--amber)"></i>` : `<i data-lucide="moon" style="width:16px;height:16px;color:var(--tx-mid)"></i>`;
    if(window.lucide) lucide.createIcons();
    if (typeof renderCharts === 'function' && typeof journalData !== 'undefined') {
        renderCharts(journalData.filter(t=>t.status!=='OPEN'), initialCapital);
        renderMistakeCharts();
    }
};
