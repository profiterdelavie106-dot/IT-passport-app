document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let currentSessionResults = [];
    let dictionary = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let selectedProgressYear = 'ALL';
    let currentCalDate = new Date();
    let isDataLoaded = false;

    const screens = {
        home: document.getElementById('home-screen'),
        progress: document.getElementById('progress-screen'),
        record: document.getElementById('record-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
        dict: document.getElementById('dictionary-screen')
    };

    const bottomNav = document.getElementById('bottom-nav');

    // データ読み込み & 自動サニタイズ
    Promise.all([
        fetch('questions.json').then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        }),
        fetch('dictionary.json').then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
    ]).then(([questionsData, dictData]) => {
        allQuestions = questionsData.map(q => ({
            ...q,
            question: sanitizeCiteTag(q.question),
            explanation: sanitizeCiteTag(q.explanation)
        }));
        dictionary = dictData;
        isDataLoaded = true;

        updateHeroCount();
        renderDictionary();
        setupNavigation();
        setupHomeActions();
        updateHomeSummary();
        updateProgressView();
        setupShareButton();
    }).catch(err => {
        console.error("データ読み込みエラー:", err);
        showGlobalError("問題データの読み込みに失敗しました。インターネット接続を確認し、再読み込みしてください。");
    });

    updateStreakDisplay();

    // 引用記号 の安全な除去
    function sanitizeCiteTag(str) {
        if (!str) return '';
        return String(str).replace(/\[cite:\s*[\d,\s]+\]/g, '').trim();
    }

    // P0対応：ホワイトリスト方式による解説HTMLの安全な描画処理
    // 許可タグ：<b>, <strong>, <br>, <p> のみ。属性やスクリプトは一切排除。
    function renderSafeExplanation(container, rawText) {
        if (!container) return;
        container.replaceChildren();
        if (!rawText) return;

        const cleanText = sanitizeCiteTag(rawText);
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${cleanText}</div>`, 'text/html');
        const root = doc.body.firstElementChild || doc.body;

        function sanitizeNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(node.textContent);
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (tagName === 'br') {
                    return document.createElement('br');
                }
                if (tagName === 'b' || tagName === 'strong' || tagName === 'p') {
                    const el = document.createElement(tagName);
                    // 属性（onclick等）は一切継承しない
                    Array.from(node.childNodes).forEach(child => {
                        const cleanChild = sanitizeNode(child);
                        if (cleanChild) el.appendChild(cleanChild);
                    });
                    return el;
                }
                // 未許可タグは外枠を剥がして子要素のテキストのみ抽出
                const fragment = document.createDocumentFragment();
                Array.from(node.childNodes).forEach(child => {
                    const cleanChild = sanitizeNode(child);
                    if (cleanChild) fragment.appendChild(cleanChild);
                });
                return fragment;
            }
            return null;
        }

        const fragment = document.createDocumentFragment();
        Array.from(root.childNodes).forEach(child => {
            const clean = sanitizeNode(child);
            if (clean) fragment.appendChild(clean);
        });
        container.appendChild(fragment);
    }

    // localStorage への安全な書き込み（QuotaExceededError防御）
    function safeSetStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn(`localStorage書き込み制限またはエラー [${key}]:`, e);
            return false;
        }
    }

    function safeGetStorage(key, defaultValue) {
        try {
            const val = localStorage.getItem(key);
            if (val === null) return defaultValue;
            return JSON.parse(val);
        } catch (e) {
            console.warn(`localStorage読み込みエラー [${key}]:`, e);
            return defaultValue;
        }
    }

    // 日本時間（Asia/Tokyo）の安全な日付取得
    function getTodayStr() {
        try {
            const formatter = new Intl.DateTimeFormat('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const parts = formatter.formatToParts(new Date());
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            return `${year}-${month}-${day}`;
        } catch (e) {
            const now = new Date();
            const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
            return jstNow.toISOString().split('T')[0];
        }
    }

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
        window.scrollTo(0, 0);

        if (['quiz', 'dict', 'result'].includes(screenName)) {
            if (bottomNav) bottomNav.classList.add('hide');
        } else {
            if (bottomNav) bottomNav.classList.remove('hide');
        }

        if (screenName === 'home') updateHomeSummary();
        if (screenName === 'progress') updateProgressView();
        if (screenName === 'record') {
            renderCalendar();
            updateShareBanner();
        }
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                const targetTab = e.currentTarget;
                targetTab.classList.add('active');
                showScreen(targetTab.getAttribute('data-target').replace('-screen', ''));
            });
        });

        document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                selectedProgressYear = e.currentTarget.getAttribute('data-year');
                updateProgressView();
            });
        });

        const prevBtn = document.getElementById('prev-month-btn');
        const nextBtn = document.getElementById('next-month-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentCalDate.setDate(1);
                currentCalDate.setMonth(currentCalDate.getMonth() - 1);
                renderCalendar();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentCalDate.setDate(1);
                currentCalDate.setMonth(currentCalDate.getMonth() + 1);
                renderCalendar();
            });
        }
    }

    function updateHeroCount() {
        const heroCount = document.getElementById('hero-total-count');
        if (heroCount) heroCount.textContent = `収録 ${allQuestions.length}問`;
    }

    function setupHomeActions() {
        const startTodayBtn = document.getElementById('start-today-btn');
        if (startTodayBtn) {
            startTodayBtn.addEventListener('click', () => {
                if (!isDataLoaded) return;
                startTodayQuiz();
            });
        }

        const homeReviewBtn = document.getElementById('home-review-btn');
        if (homeReviewBtn) {
            homeReviewBtn.addEventListener('click', () => {
                if (!isDataLoaded) return;
                startReviewQuiz();
            });
        }

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!isDataLoaded) return;
                const category = e.currentTarget.getAttribute('data-category');
                const limit = parseInt(e.currentTarget.getAttribute('data-limit'), 10) || 5;
                const yearSelect = document.getElementById('course-year-select');
                const selectedYear = yearSelect ? yearSelect.value : 'ALL';

                if (category === 'REVIEW') {
                    startReviewQuiz();
                } else {
                    startCustomQuiz(category, selectedYear, limit);
                }
            });
        });

        const openDictBtn = document.getElementById('open-dict-btn');
        if (openDictBtn) openDictBtn.addEventListener('click', () => showScreen('dict'));

        const closeDictBtn = document.getElementById('close-dict-btn');
        if (closeDictBtn) closeDictBtn.addEventListener('click', () => showScreen('home'));

        const creditModal = document.getElementById('credit-modal');
        const openCreditBtn = document.getElementById('open-credit-btn');
        const closeCreditBtn = document.getElementById('close-credit-btn');
        if (creditModal && openCreditBtn && closeCreditBtn) {
            openCreditBtn.addEventListener('click', () => creditModal.classList.add('show'));
            closeCreditBtn.addEventListener('click', () => creditModal.classList.remove('show'));
            creditModal.addEventListener('click', (e) => {
                if (e.target === creditModal) creditModal.classList.remove('show');
            });
        }

        const resultReviewBtn = document.getElementById('result-review-btn');
        if (resultReviewBtn) resultReviewBtn.addEventListener('click', () => startReviewQuiz());

        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) homeBtn.addEventListener('click', () => showScreen('home'));

        const exitQuizBtn = document.getElementById('exit-quiz-btn');
        if (exitQuizBtn) {
            exitQuizBtn.addEventListener('click', () => {
                if (confirm("演習を中断してホームに戻りますか？\n（現在の演習進捗は保存されません）")) {
                    showScreen('home');
                }
            });
        }
    }

    // 学習進捗の厳密な集計ロジック
    function getProgressStats(scopeQuestions) {
        const progressData = safeGetStorage('progressData', {});
        const wrongIds = safeGetStorage('wrongQuestionIds', []);

        const validQuestionIds = new Set(allQuestions.map(q => q.id));
        const filteredWrongIds = new Set(Array.isArray(wrongIds) ? wrongIds.filter(id => validQuestionIds.has(id)) : []);

        let seenTotal = 0;
        let latestCorrectTotal = 0;
        let firstCorrectTotal = 0;

        let unseenCount = 0;
        let wrongCount = 0;
        let masteredCount = 0;

        let stratSeen = 0, stratCorrect = 0;
        let mgmtSeen = 0, mgmtCorrect = 0;
        let techSeen = 0, techCorrect = 0;

        scopeQuestions.forEach(q => {
            const stat = progressData[q.id];
            if (stat && stat.seen) {
                seenTotal++;

                const firstRes = stat.firstResult !== undefined ? stat.firstResult : stat.lastResult;
                if (firstRes === 'correct') {
                    firstCorrectTotal++;
                }

                if (stat.lastResult === 'correct') {
                    latestCorrectTotal++;
                    masteredCount++;
                } else {
                    wrongCount++;
                }

                if (q.category === 'ストラテジ系') {
                    stratSeen++;
                    if (stat.lastResult === 'correct') stratCorrect++;
                } else if (q.category === 'マネジメント系') {
                    mgmtSeen++;
                    if (stat.lastResult === 'correct') mgmtCorrect++;
                } else if (q.category === 'テクノロジ系') {
                    techSeen++;
                    if (stat.lastResult === 'correct') techCorrect++;
                }
            } else {
                unseenCount++;
            }
        });

        const totalCount = scopeQuestions.length || 1;
        const progressRate = Math.round((seenTotal / totalCount) * 100);

        const latestRate = seenTotal > 0 ? Math.round((latestCorrectTotal / seenTotal) * 100) : null;
        const firstRate = seenTotal > 0 ? Math.round((firstCorrectTotal / seenTotal) * 100) : null;

        const stratRate = stratSeen > 0 ? Math.round((stratCorrect / stratSeen) * 100) : null;
        const mgmtRate = mgmtSeen > 0 ? Math.round((mgmtCorrect / mgmtSeen) * 100) : null;
        const techRate = techSeen > 0 ? Math.round((techCorrect / techSeen) * 100) : null;

        const scopeWrongCount = scopeQuestions.filter(q => filteredWrongIds.has(q.id)).length;

        return {
            totalCount,
            seenTotal,
            unseenCount,
            wrongCount: scopeWrongCount,
            masteredCount,
            progressRate,
            latestRate,
            firstRate,
            stratSeen, stratRate,
            mgmtSeen, mgmtRate,
            techSeen, techRate
        };
    }

    function updateHomeSummary() {
        const stats = getProgressStats(allQuestions);
        const homeProgRate = document.getElementById('home-progress-rate');
        const homeProgCount = document.getElementById('home-progress-count');
        const homeAccRate = document.getElementById('home-accuracy-rate');
        const homeWrongCount = document.getElementById('home-wrong-count');

        if (homeProgRate) homeProgRate.textContent = `${stats.progressRate}%`;
        if (homeProgCount) homeProgCount.textContent = `${stats.seenTotal}/${stats.totalCount}問`;
        if (homeAccRate) homeAccRate.textContent = stats.latestRate !== null ? `${stats.latestRate}%` : '—';
        if (homeWrongCount) homeWrongCount.textContent = `${stats.wrongCount}問`;
    }

    function updateProgressView() {
        let questionsScope = allQuestions;
        if (selectedProgressYear !== 'ALL') {
            questionsScope = allQuestions.filter(q => q.year === selectedProgressYear);
        }

        const stats = getProgressStats(questionsScope);

        const elFirstAccuracyRate = document.getElementById('first-accuracy-rate');
        const elAccuracyRate = document.getElementById('accuracy-rate');
        const elGrowthDiff = document.getElementById('growth-diff-text');

        if (elFirstAccuracyRate) elFirstAccuracyRate.textContent = stats.firstRate !== null ? `${stats.firstRate}%` : '—';
        if (elAccuracyRate) elAccuracyRate.textContent = stats.latestRate !== null ? `${stats.latestRate}%` : '—';
        if (elGrowthDiff) {
            if (stats.latestRate !== null && stats.firstRate !== null) {
                const diff = stats.latestRate - stats.firstRate;
                const sign = diff >= 0 ? '+' : '';
                elGrowthDiff.textContent = `成長幅: ${sign}${diff}%（初回 ${stats.firstRate}% → 最新 ${stats.latestRate}%）`;
            } else {
                elGrowthDiff.textContent = '成長幅: —（未回答）';
            }
        }

        const elCountUnseen = document.getElementById('count-unseen');
        const elCountWrong = document.getElementById('count-wrong');
        const elCountMastered = document.getElementById('count-mastered');
        if (elCountUnseen) elCountUnseen.textContent = `${stats.unseenCount}問`;
        if (elCountWrong) elCountWrong.textContent = `${stats.wrongCount}問`;
        if (elCountMastered) elCountMastered.textContent = `${stats.masteredCount}問`;

        const elProgressRate = document.getElementById('progress-rate');
        const elSeenCountText = document.getElementById('seen-count-text');
        const elDashboardProgressFill = document.getElementById('dashboard-progress-fill');
        const elScopeTotalTitle = document.getElementById('scope-total-title');
        const elProgressWrongTotal = document.getElementById('progress-wrong-total');

        if (elProgressRate) elProgressRate.textContent = `${stats.progressRate}%`;
        if (elSeenCountText) elSeenCountText.textContent = `${stats.seenTotal} / ${stats.totalCount}問`;
        if (elDashboardProgressFill) elDashboardProgressFill.style.width = `${stats.progressRate}%`;
        if (elScopeTotalTitle) {
            elScopeTotalTitle.textContent = selectedProgressYear === 'ALL' ? '総進捗' : `${selectedProgressYear}の進捗`;
        }
        if (elProgressWrongTotal) elProgressWrongTotal.textContent = `${stats.wrongCount}問`;

        const stratTotal = questionsScope.filter(q => q.category === 'ストラテジ系').length || 1;
        const mgmtTotal = questionsScope.filter(q => q.category === 'マネジメント系').length || 1;
        const techTotal = questionsScope.filter(q => q.category === 'テクノロジ系').length || 1;

        const elStratStat = document.getElementById('strat-stat');
        const elStratBar = document.getElementById('strat-bar');
        const elMgmtStat = document.getElementById('mgmt-stat');
        const elMgmtBar = document.getElementById('mgmt-bar');
        const elTechStat = document.getElementById('tech-stat');
        const elTechBar = document.getElementById('tech-bar');

        const stratRateText = stats.stratRate !== null ? `${stats.stratRate}%` : '—';
        const mgmtRateText = stats.mgmtRate !== null ? `${stats.mgmtRate}%` : '—';
        const techRateText = stats.techRate !== null ? `${stats.techRate}%` : '—';

        if (elStratStat) elStratStat.textContent = `${stats.stratSeen}/${stratTotal}問 (最新: ${stratRateText})`;
        if (elStratBar) elStratBar.style.width = `${Math.round((stats.stratSeen / stratTotal) * 100)}%`;
        if (elMgmtStat) elMgmtStat.textContent = `${stats.mgmtSeen}/${mgmtTotal}問 (最新: ${mgmtRateText})`;
        if (elMgmtBar) elMgmtBar.style.width = `${Math.round((stats.mgmtSeen / mgmtTotal) * 100)}%`;
        if (elTechStat) elTechStat.textContent = `${stats.techSeen}/${techTotal}問 (最新: ${techRateText})`;
        if (elTechBar) elTechBar.style.width = `${Math.round((stats.techSeen / techTotal) * 100)}%`;
    }

    function getSafeWrongIds() {
        const wrongIds = safeGetStorage('wrongQuestionIds', []);
        const validQuestionIds = new Set(allQuestions.map(q => q.id));
        return Array.isArray(wrongIds) ? wrongIds.filter(id => validQuestionIds.has(id)) : [];
    }

    // 「今日の5問」出題アルゴリズム
    function startTodayQuiz() {
        if (!allQuestions || allQuestions.length === 0) {
            alert("問題データが読み込まれていません。");
            return;
        }

        const targetCount = Math.min(5, allQuestions.length);
        const progressData = safeGetStorage('progressData', {});
        const validWrongIds = new Set(getSafeWrongIds());

        let wrongPool = allQuestions
            .filter(q => validWrongIds.has(q.id))
            .sort(() => Math.random() - 0.5);

        let unseenPool = allQuestions
            .filter(q => !progressData[q.id] || !progressData[q.id].seen)
            .sort(() => Math.random() - 0.5);

        let masteredPool = allQuestions
            .filter(q => progressData[q.id] && progressData[q.id].seen && !validWrongIds.has(q.id))
            .sort(() => Math.random() - 0.5);

        const selectedMap = new Map();

        function addQuestions(pool, maxLimit) {
            let added = 0;
            for (const q of pool) {
                if (selectedMap.size >= targetCount) break;
                if (added >= maxLimit) break;
                if (!selectedMap.has(q.id)) {
                    selectedMap.set(q.id, q);
                    added++;
                }
            }
        }

        // 優先順位：要復習(最大2) → 未回答 → 残りの要復習 → 習得済み
        addQuestions(wrongPool, 2);
        addQuestions(unseenPool, targetCount - selectedMap.size);

        if (selectedMap.size < targetCount) {
            addQuestions(wrongPool, targetCount - selectedMap.size);
        }

        if (selectedMap.size < targetCount) {
            addQuestions(masteredPool, targetCount - selectedMap.size);
        }

        currentQuizSet = Array.from(selectedMap.values()).sort(() => Math.random() - 0.5);

        if (currentQuizSet.length === 0) {
            alert("出題可能な問題がありません。");
            return;
        }

        initQuizSession();
    }

    function startReviewQuiz() {
        const validWrongIds = getSafeWrongIds();
        if (validWrongIds.length === 0) {
            alert("現在、要復習に登録されている問題はありません！🎉\nすべて「習得済み（直近正解）」または未回答です。");
            return;
        }
        const reviewPool = allQuestions.filter(q => validWrongIds.includes(q.id)).sort(() => Math.random() - 0.5);
        currentQuizSet = reviewPool.slice(0, 10);
        initQuizSession();
    }

    function startCustomQuiz(category, year, limit) {
        let pool = allQuestions;
        if (year !== 'ALL') {
            pool = pool.filter(q => q.year === year);
        }
        if (category !== 'ALL') {
            pool = pool.filter(q => q.category === category);
        }

        if (pool.length === 0) {
            alert("条件に該当する問題が見つかりませんでした。");
            return;
        }

        const progressData = safeGetStorage('progressData', {});
        let unseen = pool.filter(q => !progressData[q.id] || !progressData[q.id].seen).sort(() => Math.random() - 0.5);
        let seen = pool.filter(q => progressData[q.id] && progressData[q.id].seen).sort(() => Math.random() - 0.5);

        currentQuizSet = [...unseen, ...seen].slice(0, limit);
        initQuizSession();
    }

    function initQuizSession() {
        currentQuestionIndex = 0;
        score = 0;
        currentSessionResults = [];
        loadQuestion();
        showScreen('quiz');
    }

    function loadQuestion() {
        const q = currentQuizSet[currentQuestionIndex];
        const validWrongIds = new Set(getSafeWrongIds());
        const isWrong = validWrongIds.has(q.id);

        const elQuestionText = document.getElementById('question-text');
        if (elQuestionText) {
            elQuestionText.textContent = `【問${q.id}】\n${q.question}`;
        }

        const chipContainer = document.querySelector('.chip-container');
        if (chipContainer) {
            chipContainer.replaceChildren();

            const yearChip = document.createElement('span');
            yearChip.className = 'chip';
            yearChip.style.backgroundColor = '#E3F2FD';
            yearChip.style.color = '#1565C0';
            yearChip.textContent = q.year || '令和8年度';
            chipContainer.appendChild(yearChip);

            const catChip = document.createElement('span');
            catChip.className = 'chip';
            catChip.style.marginLeft = '6px';
            catChip.textContent = q.category;
            chipContainer.appendChild(catChip);

            if (isWrong) {
                const wrongChip = document.createElement('span');
                wrongChip.className = 'chip';
                wrongChip.style.backgroundColor = '#FFEBEE';
                wrongChip.style.color = '#C62828';
                wrongChip.style.marginLeft = '6px';
                wrongChip.textContent = '⚠️ 要復習';
                chipContainer.appendChild(wrongChip);
            }
        }

        const countLabel = document.getElementById('question-count-label');
        if (countLabel) {
            countLabel.textContent = `${currentQuestionIndex + 1}/${currentQuizSet.length}`;
        }

        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${(currentQuestionIndex / currentQuizSet.length) * 100}%`;
        }

        const optionsContainer = document.getElementById('options-container');
        if (optionsContainer) {
            optionsContainer.replaceChildren();

            q.options.forEach((optText, index) => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.textContent = optText;
                btn.onclick = () => checkAnswer(index, q.answer, q);
                optionsContainer.appendChild(btn);
            });
        }
    }

    function checkAnswer(selectedIndex, correctIndex, questionObj) {
        // 二重タップ防止
        const btns = document.querySelectorAll('.option-btn');
        btns.forEach(b => { b.disabled = true; });

        const isCorrect = (selectedIndex === correctIndex);
        if (isCorrect) score++;

        recordQuestionResult(questionObj.id, isCorrect);
        currentSessionResults.push({
            question: questionObj,
            isCorrect: isCorrect,
            selectedOption: questionObj.options[selectedIndex],
            correctOption: questionObj.options[correctIndex]
        });

        const sheet = document.getElementById('explanation-sheet');
        const overlay = document.getElementById('overlay');
        const judgeText = document.getElementById('judgement-text');
        const expText = document.getElementById('explanation-text');

        if (judgeText) {
            judgeText.textContent = isCorrect ? "正解！ 🎉" : "不正解... 😢";
            judgeText.className = `judgement ${isCorrect ? 'correct' : 'incorrect'}`;
        }

        if (expText) {
            expText.replaceChildren();

            const ansBox = document.createElement('div');
            ansBox.style.background = 'var(--md-primary-container)';
            ansBox.style.color = 'var(--md-on-primary-container)';
            ansBox.style.padding = '10px 12px';
            ansBox.style.borderRadius = '8px';
            ansBox.style.marginBottom = '10px';
            ansBox.style.fontWeight = 'bold';
            ansBox.style.fontSize = '13px';
            ansBox.textContent = `💡 正解：${questionObj.options[correctIndex]}`;

            const descBox = document.createElement('div');
            descBox.style.fontSize = '13px';
            descBox.style.lineHeight = '1.6';
            // 安全なHTMLパーサーで太字・改行を維持して描画
            renderSafeExplanation(descBox, questionObj.explanation);

            expText.appendChild(ansBox);
            expText.appendChild(descBox);
        }

        if (sheet) sheet.classList.add('show');
        if (overlay) overlay.classList.add('show');
    }

    function recordQuestionResult(qId, isCorrect) {
        const progressData = safeGetStorage('progressData', {});
        let wrongIds = getSafeWrongIds();

        const currentStat = progressData[qId] || {};
        const safeAttempts = (typeof currentStat.attempts === 'number' && !isNaN(currentStat.attempts)) ? currentStat.attempts : 0;
        const safeCorrectCount = (typeof currentStat.correctCount === 'number' && !isNaN(currentStat.correctCount)) ? currentStat.correctCount : 0;

        const firstResultValue = currentStat.firstResult !== undefined ? currentStat.firstResult : (isCorrect ? 'correct' : 'incorrect');

        progressData[qId] = {
            seen: true,
            firstResult: firstResultValue,
            lastResult: isCorrect ? 'correct' : 'incorrect',
            attempts: safeAttempts + 1,
            correctCount: safeCorrectCount + (isCorrect ? 1 : 0),
            updatedAt: new Date().toISOString()
        };
        safeSetStorage('progressData', progressData);

        if (!isCorrect) {
            if (!wrongIds.includes(qId)) wrongIds.push(qId);
        } else {
            wrongIds = wrongIds.filter(id => id !== qId);
        }
        safeSetStorage('wrongQuestionIds', wrongIds);
    }

    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const sheet = document.getElementById('explanation-sheet');
            const overlay = document.getElementById('overlay');
            if (sheet) sheet.classList.remove('show');
            if (overlay) overlay.classList.remove('show');

            setTimeout(() => {
                currentQuestionIndex++;
                if (currentQuestionIndex < currentQuizSet.length) {
                    loadQuestion();
                } else {
                    showResult();
                }
            }, 200);
        });
    }

    function showResult() {
        const scoreText = document.getElementById('score-text');
        const scorePercentText = document.getElementById('score-percent-text');
        const percent = Math.round((score / currentQuizSet.length) * 100);

        if (scoreText) scoreText.textContent = `${score} / ${currentQuizSet.length} 問 正解`;
        if (scorePercentText) scorePercentText.textContent = `今回の正答率: ${percent}%`;

        const wrongList = currentSessionResults.filter(r => !r.isCorrect);
        const wrongSectionTitle = document.getElementById('result-wrong-section-title');
        const wrongContainer = document.getElementById('result-wrong-list');

        if (wrongContainer) {
            wrongContainer.replaceChildren();

            if (wrongList.length > 0) {
                if (wrongSectionTitle) wrongSectionTitle.style.display = 'block';

                wrongList.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'wrong-review-item';

                    const qTitle = document.createElement('div');
                    qTitle.className = 'wrong-q-title';
                    const snippet = item.question.question.length > 50 ? `${item.question.question.substring(0, 50)}...` : item.question.question;
                    qTitle.textContent = `【問${item.question.id}】${snippet}`;

                    const qAns = document.createElement('div');
                    qAns.className = 'wrong-q-ans';
                    qAns.textContent = `正解：${item.correctOption}`;

                    const qExp = document.createElement('div');
                    qExp.className = 'wrong-q-exp';
                    renderSafeExplanation(qExp, item.question.explanation);

                    card.appendChild(qTitle);
                    card.appendChild(qAns);
                    card.appendChild(qExp);
                    wrongContainer.appendChild(card);
                });
            } else {
                if (wrongSectionTitle) wrongSectionTitle.style.display = 'none';
            }
        }

        recordStudySession();
        updateStreakDisplay();
        showScreen('result');
    }

    function recordStudySession() {
        const todayStr = getTodayStr();
        const studyLog = safeGetStorage('studyLog', {});
        studyLog[todayStr] = (studyLog[todayStr] || 0) + 1;
        safeSetStorage('studyLog', studyLog);
    }

    function updateStreakDisplay() {
        const studyLog = safeGetStorage('studyLog', {});
        let total = 0;
        for (let d in studyLog) {
            if (typeof studyLog[d] === 'number') total += studyLog[d];
        }
        const streakEl = document.getElementById('streak-count');
        if (streakEl) streakEl.textContent = `累計 ${total}回`;
    }

    function updateShareBanner() {
        const todayStr = getTodayStr();
        const studyLog = safeGetStorage('studyLog', {});
        const todayCount = studyLog[todayStr] || 0;
        const elTodayText = document.getElementById('today-study-text');
        if (elTodayText) {
            elTodayText.textContent = `本日の学習: ${todayCount}セッション完了 🔥`;
        }
    }

    function setupShareButton() {
        const shareBtn = document.getElementById('share-x-btn');
        if (!shareBtn) return;
        shareBtn.addEventListener('click', () => {
            const todayStr = getTodayStr();
            const studyLog = safeGetStorage('studyLog', {});
            const todayCount = studyLog[todayStr] || 0;
            const progressData = safeGetStorage('progressData', {});
            const seenCount = Object.keys(progressData).length;
            const totalQ = allQuestions.length || 300;

            const text = encodeURIComponent(
                `【ITパスポート過去問トレーニング】\n本日 ${todayCount} セッション完了！\n累計消化数: ${seenCount}/${totalQ}問\n隙間時間で合格を目指して学習中✍️🔥\n\n#ITパスポート #今日の積み上げ #資格勉強`
            );
            const url = encodeURIComponent(window.location.href);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
        });
    }

    function renderCalendar() {
        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const elMonthTitle = document.getElementById('calendar-month-title');
        if (elMonthTitle) elMonthTitle.textContent = `${year}年${month + 1}月`;

        const grid = document.getElementById('calendar-grid');
        if (!grid) return;
        grid.replaceChildren();

        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const studyLog = safeGetStorage('studyLog', {});
        const todayStr = getTodayStr();

        for (let i = 0; i < firstDay; i++) {
            const blank = document.createElement('div');
            blank.className = 'cal-day empty';
            grid.appendChild(blank);
        }

        for (let d = 1; d <= lastDate; d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day';
            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            const dateStr = `${year}-${mStr}-${dStr}`;
            if (dateStr === todayStr) cell.classList.add('today');

            const dayNum = document.createElement('span');
            dayNum.textContent = d;
            cell.appendChild(dayNum);

            const count = studyLog[dateStr] || 0;
            if (count > 0) {
                const icon = document.createElement('span');
                icon.className = 'material-icons cal-stamp';
                icon.textContent = 'local_fire_department';
                cell.appendChild(icon);

                const countBadge = document.createElement('span');
                countBadge.className = 'cal-count';
                countBadge.textContent = `${count}回`;
                cell.appendChild(countBadge);
            }
            grid.appendChild(cell);
        }
    }

    function renderDictionary() {
        const list = document.getElementById('dictionary-list');
        if (!list) return;
        list.replaceChildren();

        const indexOrder = ['A〜Z', 'あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];

        indexOrder.forEach(idx => {
            const items = dictionary.filter(item => item.index === idx);
            if (items.length > 0) {
                const header = document.createElement('div');
                header.className = 'dict-index-header';

                const icon = document.createElement('span');
                icon.className = 'material-icons';
                icon.style.fontSize = '16px';
                icon.style.marginRight = '6px';
                icon.textContent = 'menu_book';

                const headerText = document.createTextNode(idx);
                header.appendChild(icon);
                header.appendChild(headerText);
                list.appendChild(header);

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'dict-item';

                    const termEl = document.createElement('h4');
                    termEl.textContent = item.term;
                    card.appendChild(termEl);

                    if (item.yomi) {
                        const yomiEl = document.createElement('div');
                        yomiEl.className = 'yomi';
                        yomiEl.textContent = `（${item.yomi}）`;
                        card.appendChild(yomiEl);
                    }

                    const descEl = document.createElement('p');
                    descEl.className = 'desc';
                    descEl.textContent = item.description;
                    card.appendChild(descEl);

                    list.appendChild(card);
                });
            }
        });
    }

    function showGlobalError(msg) {
        const main = document.querySelector('.main-content');
        if (main) {
            const errBox = document.createElement('div');
            errBox.style.cssText = 'background: #FFEBEE; color: #C62828; padding: 16px; border-radius: 12px; margin: 20px 0; font-size: 13px; line-height: 1.6; border: 1px solid #FFCDD2;';
            errBox.textContent = msg;
            main.prepend(errBox);
        }
    }
});
