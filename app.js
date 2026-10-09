document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let currentSessionResults = []; // 今回セッションの結果一時保存
    let dictionary = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let selectedProgressYear = 'ALL';
    let currentCalDate = new Date();

    const screens = {
        home: document.getElementById('home-screen'),
        progress: document.getElementById('progress-screen'),
        record: document.getElementById('record-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
        dict: document.getElementById('dictionary-screen')
    };

    const bottomNav = document.getElementById('bottom-nav');

    // データロード & 自動クレンジング
    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('dictionary.json').then(res => res.json())
    ]).then(([questionsData, dictData]) => {
        // などの不要なAIタグを除去してサニタイズ
        allQuestions = questionsData.map(q => ({
            ...q,
            question: sanitizeText(q.question),
            explanation: sanitizeText(q.explanation)
        }));
        dictionary = dictData;

        // UI初期化
        updateHeroCount();
        renderDictionary();
        setupNavigation();
        setupHomeActions();
        updateHomeSummary();
        updateProgressView();
        setupShareButton();
    }).catch(err => {
        console.error("データ読み込みエラー:", err);
        alert("問題データの読み込みに失敗しました。再読み込みをお試しください。");
    });

    updateStreakDisplay();

    function sanitizeText(str) {
        if (!str) return '';
        return str.replace(/\[cite:\s*[\d,\s]+\]/g, '').trim();
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

        // 進捗ピルボタン
        document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                selectedProgressYear = e.currentTarget.getAttribute('data-year');
                updateProgressView();
            });
        });

        // カレンダー月送り
        const prevBtn = document.getElementById('prev-month-btn');
        const nextBtn = document.getElementById('next-month-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() - 1); renderCalendar(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { currentCalDate.setMonth(currentCalDate.getMonth() + 1); renderCalendar(); });
    }

    function updateHeroCount() {
        const heroCount = document.getElementById('hero-total-count');
        if (heroCount) heroCount.innerText = `収録 ${allQuestions.length}問`;
    }

    function setupHomeActions() {
        // 今日の5問ボタン
        const startTodayBtn = document.getElementById('start-today-btn');
        if (startTodayBtn) {
            startTodayBtn.addEventListener('click', () => startTodayQuiz());
        }

        // ホーム要復習ボタン
        const homeReviewBtn = document.getElementById('home-review-btn');
        if (homeReviewBtn) {
            homeReviewBtn.addEventListener('click', () => startReviewQuiz());
        }

        // コース別演習ボタン
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.getAttribute('data-category');
                const limit = parseInt(e.currentTarget.getAttribute('data-limit'));
                const yearSelect = document.getElementById('course-year-select');
                const selectedYear = yearSelect ? yearSelect.value : 'ALL';
                
                if (category === 'REVIEW') {
                    startReviewQuiz();
                } else {
                    startCustomQuiz(category, selectedYear, limit);
                }
            });
        });

        // 用語集 & クレジット
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
            creditModal.addEventListener('click', (e) => { if (e.target === creditModal) creditModal.classList.remove('show'); });
        }

        // 結果画面アクション
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

    // 学習進捗の集計
    function getProgressStats(scopeQuestions) {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');

        let seenTotal = 0;
        let latestCorrectTotal = 0;
        let firstCorrectTotal = 0;
        let stratSeen = 0, stratCorrect = 0;
        let mgmtSeen = 0, mgmtCorrect = 0;
        let techSeen = 0, techCorrect = 0;

        scopeQuestions.forEach(q => {
            const stat = progressData[q.id];
            if (stat && stat.seen) {
                seenTotal++;
                if (stat.lastResult === 'correct') latestCorrectTotal++;
                if (stat.firstResult === 'correct') firstCorrectTotal++;

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
            }
        });

        const totalCount = scopeQuestions.length || 1;
        const wrongInScope = scopeQuestions.filter(q => wrongIds.includes(q.id)).length;

        return {
            totalCount,
            seenTotal,
            progressRate: Math.round((seenTotal / totalCount) * 100),
            latestRate: seenTotal > 0 ? Math.round((latestCorrectTotal / seenTotal) * 100) : 0,
            firstRate: seenTotal > 0 ? Math.round((firstCorrectTotal / seenTotal) * 100) : 0,
            wrongCount: wrongInScope,
            stratSeen, stratCorrect,
            mgmtSeen, mgmtCorrect,
            techSeen, techCorrect
        };
    }

    function updateHomeSummary() {
        const stats = getProgressStats(allQuestions);
        const homeProgRate = document.getElementById('home-progress-rate');
        const homeProgCount = document.getElementById('home-progress-count');
        const homeAccRate = document.getElementById('home-accuracy-rate');
        const homeFirstRate = document.getElementById('home-first-rate');
        const homeWrongCount = document.getElementById('home-wrong-count');

        if (homeProgRate) homeProgRate.innerText = `${stats.progressRate}%`;
        if (homeProgCount) homeProgCount.innerText = `${stats.seenTotal}/${stats.totalCount}問`;
        if (homeAccRate) homeAccRate.innerText = `${stats.latestRate}%`;
        if (homeFirstRate) homeFirstRate.innerText = `初回: ${stats.firstRate}%`;
        if (homeWrongCount) homeWrongCount.innerText = `${stats.wrongCount}問`;
    }

    function updateProgressView() {
        let questionsScope = allQuestions;
        if (selectedProgressYear !== 'ALL') {
            questionsScope = allQuestions.filter(q => q.year === selectedProgressYear);
        }

        const stats = getProgressStats(questionsScope);

        const elProgressRate = document.getElementById('progress-rate');
        const elAccuracyRate = document.getElementById('accuracy-rate');
        const elFirstAccuracyRate = document.getElementById('first-accuracy-rate');
        const elSeenCountText = document.getElementById('seen-count-text');
        const elDashboardProgressFill = document.getElementById('dashboard-progress-fill');
        const elScopeTotalTitle = document.getElementById('scope-total-title');
        const elProgressWrongTotal = document.getElementById('progress-wrong-total');

        if (elProgressRate) elProgressRate.innerText = `${stats.progressRate}%`;
        if (elAccuracyRate) elAccuracyRate.innerText = `${stats.latestRate}%`;
        if (elFirstAccuracyRate) elFirstAccuracyRate.innerText = `${stats.firstRate}%`;
        if (elSeenCountText) elSeenCountText.innerText = `${stats.seenTotal} /${stats.totalCount}問`;
        if (elDashboardProgressFill) elDashboardProgressFill.style.width = `${stats.progressRate}%`;
        if (elScopeTotalTitle) elScopeTotalTitle.innerText = selectedProgressYear === 'ALL' ? '総進捗' : `${selectedProgressYear}の進捗`;
        if (elProgressWrongTotal) elProgressWrongTotal.innerText = `${stats.wrongCount}問`;

        // 分野別
        const stratTotal = questionsScope.filter(q => q.category === 'ストラテジ系').length || 1;
        const mgmtTotal = questionsScope.filter(q => q.category === 'マネジメント系').length || 1;
        const techTotal = questionsScope.filter(q => q.category === 'テクノロジ系').length || 1;

        const stratAcc = stats.stratSeen > 0 ? Math.round((stats.stratCorrect / stats.stratSeen) * 100) : 0;
        const mgmtAcc = stats.mgmtSeen > 0 ? Math.round((stats.mgmtCorrect / stats.mgmtSeen) * 100) : 0;
        const techAcc = stats.techSeen > 0 ? Math.round((stats.techCorrect / stats.techSeen) * 100) : 0;

        const elStratStat = document.getElementById('strat-stat');
        const elStratBar = document.getElementById('strat-bar');
        const elMgmtStat = document.getElementById('mgmt-stat');
        const elMgmtBar = document.getElementById('mgmt-bar');
        const elTechStat = document.getElementById('tech-stat');
        const elTechBar = document.getElementById('tech-bar');

        if (elStratStat) elStratStat.innerText = `${stats.stratSeen}/${stratTotal}問 (正答率: ${stratAcc}%)`;
        if (elStratBar) elStratBar.style.width = `${Math.round((stats.stratSeen / stratTotal) * 100)}%`;
        if (elMgmtStat) elMgmtStat.innerText = `${stats.mgmtSeen}/${mgmtTotal}問 (正答率: ${mgmtAcc}%)`;
        if (elMgmtBar) elMgmtBar.style.width = `${Math.round((stats.mgmtSeen / mgmtTotal) * 100)}%`;
        if (elTechStat) elTechStat.innerText = `${stats.techSeen}/${techTotal}問 (正答率: ${techAcc}%)`;
        if (elTechBar) elTechBar.style.width = `${Math.round((stats.techSeen / techTotal) * 100)}%`;
    }

    // 「今日の5問」出題アルゴリズム
    function startTodayQuiz() {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');

        // 1. 要復習問題から最優先
        let wrongPool = allQuestions.filter(q => wrongIds.includes(q.id)).sort(() => Math.random() - 0.5);

        // 2. 未回答問題から補充
        let unseenPool = allQuestions.filter(q => !progressData[q.id] || !progressData[q.id].seen).sort(() => Math.random() - 0.5);

        // 3. すでに正解した問題から補充
        let seenPool = allQuestions.filter(q => progressData[q.id] && progressData[q.id].seen && !wrongIds.includes(q.id)).sort(() => Math.random() - 0.5);

        let selected = [];
        // 最大2問を要復習から
        selected.push(...wrongPool.slice(0, 2));

        // 残りを未回答から
        const remaining = 5 - selected.length;
        selected.push(...unseenPool.slice(0, remaining));

        // それでも足りなければ正解済みから補充
        if (selected.length < 5) {
            const needMore = 5 - selected.length;
            selected.push(...seenPool.slice(0, needMore));
        }

        // 重複を除去
        currentQuizSet = Array.from(new Set(selected)).sort(() => Math.random() - 0.5);

        if (currentQuizSet.length === 0) {
            alert("出題可能な問題がありません。");
            return;
        }

        initQuizSession();
    }

    function startReviewQuiz() {
        const wrongIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        if (wrongIds.length === 0) {
            alert("現在、要復習に登録されている問題はありません！🎉\n素晴らしい達成状況です。");
            return;
        }
        const reviewPool = allQuestions.filter(q => wrongIds.includes(q.id)).sort(() => Math.random() - 0.5);
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

        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        // 未回答優先
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
        const wrongIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        const isWrong = wrongIds.includes(q.id);

        const elQuestionText = document.getElementById('question-text');
        if (elQuestionText) elQuestionText.innerText = `【問${q.id}】\n${q.question}`;

        let chipHtml = `<span class="chip" style="background-color: #E3F2FD; color: #1565C0;">${q.year || '令和8年度'}</span>`;
        chipHtml += `<span class="chip" style="margin-left: 6px;">${q.category}</span>`;
        if (isWrong) {
            chipHtml += `<span class="chip" style="background-color: #FFEBEE; color: #C62828; margin-left: 6px;">⚠️ 要復習</span>`;
        }
        const chipContainer = document.querySelector('.chip-container');
        if (chipContainer) chipContainer.innerHTML = chipHtml;

        const countLabel = document.getElementById('question-count-label');
        if (countLabel) countLabel.innerText = `${currentQuestionIndex + 1}/${currentQuizSet.length}`;

        const progressFill = document.getElementById('progress-fill');
        if (progressFill) progressFill.style.width = `${(currentQuestionIndex / currentQuizSet.length) * 100}%`;

        const optionsContainer = document.getElementById('options-container');
        if (!optionsContainer) return;
        optionsContainer.innerHTML = '';

        q.options.forEach((optText, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = optText;
            btn.onclick = () => checkAnswer(index, q.answer, q);
            optionsContainer.appendChild(btn);
        });
    }

    function checkAnswer(selectedIndex, correctIndex, questionObj) {
        // 二重クリック防止
        const btns = document.querySelectorAll('.option-btn');
        btns.forEach(b => b.disabled = true);

        const isCorrect = (selectedIndex === correctIndex);
        if (isCorrect) score++;

        // 記録保存
        recordQuestionResult(questionObj.id, isCorrect);
        currentSessionResults.push({
            question: questionObj,
            isCorrect: isCorrect,
            selectedOption: questionObj.options[selectedIndex],
            correctOption: questionObj.options[correctIndex]
        });

        // シート表示
        const sheet = document.getElementById('explanation-sheet');
        const overlay = document.getElementById('overlay');
        const judgeText = document.getElementById('judgement-text');
        const expText = document.getElementById('explanation-text');

        if (judgeText) {
            judgeText.innerText = isCorrect ? "正解！ 🎉" : "不正解... 😢";
            judgeText.className = `judgement ${isCorrect ? 'correct' : 'incorrect'}`;
        }

        if (expText) {
            expText.innerHTML = `
                <div style="background: var(--md-primary-container); color: var(--md-on-primary-container); padding: 10px 12px; border-radius: 8px; margin-bottom: 10px; font-weight: bold; font-size: 13px;">
                    💡 正解：${questionObj.options[correctIndex]}
                </div>
                <div style="font-size: 13px; line-height: 1.6;">${questionObj.explanation}</div>
            `;
        }

        if (sheet) sheet.classList.add('show');
        if (overlay) overlay.classList.add('show');
    }

    function recordQuestionResult(qId, isCorrect) {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        let wrongIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');

        const currentStat = progressData[qId] || { attempts: 0, correctCount: 0 };

        progressData[qId] = {
            seen: true,
            firstResult: currentStat.firstResult !== undefined ? currentStat.firstResult : (isCorrect ? 'correct' : 'incorrect'),
            lastResult: isCorrect ? 'correct' : 'incorrect',
            attempts: currentStat.attempts + 1,
            correctCount: currentStat.correctCount + (isCorrect ? 1 : 0),
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('progressData', JSON.stringify(progressData));

        if (!isCorrect) {
            if (!wrongIds.includes(qId)) wrongIds.push(qId);
        } else {
            // 正解したら要復習リストから除外
            wrongIds = wrongIds.filter(id => id !== qId);
        }
        localStorage.setItem('wrongQuestionIds', JSON.stringify(wrongIds));
    }

    // 次の問題へ
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

        if (scoreText) scoreText.innerText = `${score} /${currentQuizSet.length} 問 正解`;
        if (scorePercentText) scorePercentText.innerText = `今回の正答率: ${percent}%`;

        // 間違えた問題の展開
        const wrongList = currentSessionResults.filter(r => !r.isCorrect);
        const wrongSectionTitle = document.getElementById('result-wrong-section-title');
        const wrongContainer = document.getElementById('result-wrong-list');

        if (wrongContainer) {
            wrongContainer.innerHTML = '';
            if (wrongList.length > 0) {
                if (wrongSectionTitle) wrongSectionTitle.style.display = 'block';
                wrongList.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'wrong-review-item';
                    div.innerHTML = `
                        <div class="wrong-q-title">【問${item.question.id}】${item.question.question.substring(0, 50)}...</div>
                        <div class="wrong-q-ans">正解：${item.correctOption}</div>
                        <div class="wrong-q-exp">${item.question.explanation}</div>
                    `;
                    wrongContainer.appendChild(div);
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
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        studyLog[todayStr] = (studyLog[todayStr] || 0) + 1;
        localStorage.setItem('studyLog', JSON.stringify(studyLog));
    }

    function updateStreakDisplay() {
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        let total = 0;
        for (let d in studyLog) total += studyLog[d];
        const streakEl = document.getElementById('streak-count');
        if (streakEl) streakEl.innerText = `累計 ${total}回`;
    }

    function updateShareBanner() {
        const todayStr = getTodayStr();
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        const todayCount = studyLog[todayStr] || 0;
        const elTodayText = document.getElementById('today-study-text');
        if (elTodayText) elTodayText.innerText = `本日の学習: ${todayCount}セッション完了 🔥`;
    }

    function setupShareButton() {
        const shareBtn = document.getElementById('share-x-btn');
        if (!shareBtn) return;
        shareBtn.addEventListener('click', () => {
            const todayStr = getTodayStr();
            const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
            const todayCount = studyLog[todayStr] || 0;
            const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
            const seenCount = Object.keys(progressData).length;

            const text = encodeURIComponent(
                `【ITパスポート過去問トレーニング】\n本日 ${todayCount} セッション完了！\n累計消化数: ${seenCount}/300問\n隙間時間で一発合格を目指して勉強中✍️🔥\n\n#ITパスポート #今日の積み上げ #資格勉強`
            );
            const url = encodeURIComponent(window.location.href);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
        });
    }

    function getTodayStr() {
        const now = new Date();
        const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        return jstNow.toISOString().split('T')[0];
    }

    function renderCalendar() {
        const year = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();
        const elMonthTitle = document.getElementById('calendar-month-title');
        if (elMonthTitle) elMonthTitle.innerText = `${year}年${month + 1}月`;

        const grid = document.getElementById('calendar-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        const todayStr = getTodayStr();

        for (let i = 0; i < firstDay; i++) {
            const blank = document.createElement('div');
            blank.className = 'cal-day empty';
            grid.appendChild(blank);
        }

        for (let d = 1; d <= lastDate; d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day';
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (dateStr === todayStr) cell.classList.add('today');

            cell.innerHTML = `<span>${d}</span>`;
            const count = studyLog[dateStr] || 0;
            if (count > 0) {
                cell.innerHTML += `
                    <span class="material-icons cal-stamp">local_fire_department</span>
                    <span class="cal-count">${count}回</span>
                `;
            }
            grid.appendChild(cell);
        }
    }

    function renderDictionary() {
        const list = document.getElementById('dictionary-list');
        if (!list) return;
        list.innerHTML = '';

        const indexOrder = ['A〜Z', 'あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'];

        indexOrder.forEach(idx => {
            const items = dictionary.filter(item => item.index === idx);
            if (items.length > 0) {
                const header = document.createElement('div');
                header.className = 'dict-index-header';
                header.innerHTML = `<span class="material-icons" style="font-size: 16px; margin-right: 6px;">menu_book</span>${idx}`;
                list.appendChild(header);

                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'dict-item';
                    const yomiHtml = item.yomi ? `<div class="yomi">（${item.yomi}）</div>` : '';
                    div.innerHTML = `<h4>${item.term}</h4>${yomiHtml}<p class="desc">${item.description}</p>`;
                    list.appendChild(div);
                });
            }
        });
    }
});
