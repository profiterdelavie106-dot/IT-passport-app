document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
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

    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('dictionary.json').then(res => res.json())
    ]).then(([questionsData, dictData]) => {
        allQuestions = questionsData;
        dictionary = dictData;
        setupCategoryButtons();
        renderDictionary();
        setupNavigation();
        updateProgressView();
        setupShareButton();
    }).catch(err => {
        console.error("データの読み込みに失敗しました:", err);
    });

    updateStreakDisplay();

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
        window.scrollTo(0, 0);

        if (screenName === 'quiz' || screenName === 'dict' || screenName === 'result') {
            bottomNav.classList.add('hide');
        } else {
            bottomNav.classList.remove('hide');
        }

        if (screenName === 'progress') {
            updateProgressView();
        } else if (screenName === 'record') {
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
                const targetScreen = targetTab.getAttribute('data-target');
                showScreen(targetScreen.replace('-screen', ''));
            });
        });

        // 進捗の年度ピルボタン切り替え
        document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#progress-year-tabs .pill-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                selectedProgressYear = e.currentTarget.getAttribute('data-year');
                updateProgressView();
            });
        });

        document.getElementById('prev-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('next-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderCalendar();
        });
    }

    function setupCategoryButtons() {
        const container = document.getElementById('course-buttons-container');
        container.innerHTML = `
            <div style="margin-bottom: 20px; text-align: left;">
                <label for="year-select" style="font-size: 13px; color: var(--md-secondary); font-weight: bold; display: block; margin-bottom: 8px;">出題年度の絞り込み</label>
                <select id="year-select" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--md-outline); font-family: inherit; font-size: 15px; background-color: var(--md-surface); outline: none;">
                    <option value="ALL">すべての年度（令和6年〜8年）</option>
                    <option value="令和8年度">令和8年度 のみ</option>
                    <option value="令和7年度">令和7年度 のみ</option>
                    <option value="令和6年度">令和6年度 のみ</option>
                </select>
            </div>

            <button class="md-btn md-btn-primary mode-btn" data-category="ALL" data-limit="15">
                <span class="material-icons">casino</span> 全分野からランダム（15問）
            </button>
            <button class="md-btn md-btn-secondary mode-btn" data-category="ストラテジ系" data-limit="5">
                <span class="material-icons">bar_chart</span> ストラテジ系（5問）
            </button>
            <button class="md-btn md-btn-secondary mode-btn" data-category="マネジメント系" data-limit="5">
                <span class="material-icons">people</span> マネジメント系（5問）
            </button>
            <button class="md-btn md-btn-secondary mode-btn" data-category="テクノロジ系" data-limit="5">
                <span class="material-icons">computer</span> テクノロジ系（5問）
            </button>
            
            <button class="md-btn mode-btn" data-category="REVIEW" data-limit="5" style="margin-top: 16px; background-color: #FFF3E0; color: #E65100;">
                <span class="material-icons">assignment_late</span> 要復習の問題を解く
            </button>
            
            <div style="margin: 24px 0 12px 0; border-top: 1px solid var(--md-outline); opacity: 0.3;"></div>
            
            <button id="open-dict-btn" class="md-btn md-btn-outline">
                <span class="material-icons">menu_book</span> 過去問用語集を開く
            </button>

            <div style="text-align: center; margin-top: 24px;">
                <button id="open-credit-btn" style="background: none; border: none; color: var(--md-secondary); font-size: 12px; text-decoration: underline; cursor: pointer;">
                    出典・利用について
                </button>
            </div>
        `;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                startQuiz(target.getAttribute('data-category'), parseInt(target.getAttribute('data-limit')));
            });
        });

        document.getElementById('open-dict-btn').addEventListener('click', () => showScreen('dict'));

        const creditModal = document.getElementById('credit-modal');
        if (creditModal) {
            document.getElementById('open-credit-btn').addEventListener('click', () => creditModal.classList.add('show'));
            document.getElementById('close-credit-btn').addEventListener('click', () => creditModal.classList.remove('show'));
            creditModal.addEventListener('click', (e) => {
                if (e.target === creditModal) creditModal.classList.remove('show');
            });
        }
    }

    // 全体 / 年度別の進捗計算ロジック
    function updateProgressView() {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');

        let questionsScope = allQuestions;
        if (selectedProgressYear !== 'ALL') {
            questionsScope = allQuestions.filter(q => q.year === selectedProgressYear);
        }

        const totalInScope = questionsScope.length || 1;
        let seenTotal = 0;
        let correctTotal = 0;
        let stratSeen = 0, mgmtSeen = 0, techSeen = 0;

        questionsScope.forEach(q => {
            const stat = progressData[q.id];
            if (stat && stat.seen) {
                seenTotal++;
                if (stat.lastResult === 'correct') correctTotal++;
                if (q.category === 'ストラテジ系') stratSeen++;
                if (q.category === 'マネジメント系') mgmtSeen++;
                if (q.category === 'テクノロジ系') techSeen++;
            }
        });

        const scopeWrong = questionsScope.filter(q => wrongQuestionIds.includes(q.id)).length;
        const progressPercent = Math.round((seenTotal / totalInScope) * 100);
        const accuracyPercent = seenTotal > 0 ? Math.round((correctTotal / seenTotal) * 100) : 0;

        document.getElementById('progress-rate').innerText = `${progressPercent}%`;
        document.getElementById('accuracy-rate').innerText = `${accuracyPercent}%`;
        document.getElementById('wrong-count').innerText = `${scopeWrong}問`;
        document.getElementById('seen-count-text').innerText = `${seenTotal} / ${totalInScope}問`;
        document.getElementById('dashboard-progress-fill').style.width = `${progressPercent}%`;

        document.getElementById('scope-total-title').innerText = selectedProgressYear === 'ALL' ? '総進捗' : `${selectedProgressYear}の進捗`;

        const stratTotal = questionsScope.filter(q => q.category === 'ストラテジ系').length || 1;
        const mgmtTotal = questionsScope.filter(q => q.category === 'マネジメント系').length || 1;
        const techTotal = questionsScope.filter(q => q.category === 'テクノロジ系').length || 1;

        document.getElementById('strat-stat').innerText = `${stratSeen}/${stratTotal}問`;
        document.getElementById('strat-bar').style.width = `${Math.round((stratSeen / stratTotal) * 100)}%`;
        document.getElementById('mgmt-stat').innerText = `${mgmtSeen}/${mgmtTotal}問`;
        document.getElementById('mgmt-bar').style.width = `${Math.round((mgmtSeen / mgmtTotal) * 100)}%`;
        document.getElementById('tech-stat').innerText = `${techSeen}/${techTotal}問`;
        document.getElementById('tech-bar').style.width = `${Math.round((techSeen / techTotal) * 100)}%`;
    }

    // Xシェアバナーの更新
    function updateShareBanner() {
        const todayStr = getTodayStr();
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        const todayCount = studyLog[todayStr] || 0;
        document.getElementById('today-study-text').innerText = `本日の学習: ${todayCount}セッション完了 🔥`;
    }

    // X投稿リンクの生成
    function setupShareButton() {
        document.getElementById('share-x-btn').addEventListener('click', () => {
            const todayStr = getTodayStr();
            const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
            const todayCount = studyLog[todayStr] || 0;
            const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
            const seenCount = Object.keys(progressData).length;

            const text = encodeURIComponent(
                `【ITパスポート学習記録】\n本日${todayCount}セッション完了！\n累計消化数: ${seenCount}/300問\n毎日コツコツ一発合格目指して勉強中✍️🔥\n\n#ITパスポート #今日の積み上げ #資格勉強`
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
        document.getElementById('calendar-month-title').innerText = `${year}年${month + 1}月`;

        const grid = document.getElementById('calendar-grid');
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
            const termsForIndex = dictionary.filter(item => item.index === idx);

            if (termsForIndex.length > 0) {
                const header = document.createElement('div');
                header.className = 'dict-index-header';
                header.innerHTML = `<span class="material-icons" style="font-size: 18px; margin-right: 6px;">menu_book</span>${idx}`;
                list.appendChild(header);

                termsForIndex.forEach(item => {
                    const termName = item.term || '用語名なし';
                    const yomiText = item.yomi || '';
                    const descText = item.description || '解説はありません。';
                    
                    const div = document.createElement('div');
                    div.className = 'dict-item';
                    
                    let yomiHtml = '';
                    if (yomiText && yomiText !== termName) {
                        yomiHtml = `<div class="yomi">（${yomiText}）</div>`;
                    }
                    
                    div.innerHTML = `<h4>${termName}</h4>${yomiHtml}<p class="desc">${descText}</p>`;
                    list.appendChild(div);
                });
            }
        });
    }

    document.getElementById('close-dict-btn').addEventListener('click', () => showScreen('home'));

    document.getElementById('exit-quiz-btn').addEventListener('click', () => {
        if (confirm("クイズを終了してホームに戻りますか？\n（ここまでの正解は記録されません）")) {
            showScreen('home');
        }
    });

    function startQuiz(category, limit) {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        
        const yearSelectEl = document.getElementById('year-select');
        const selectedYear = yearSelectEl ? yearSelectEl.value : 'ALL';
        
        let filteredQuestions = allQuestions;
        if (selectedYear !== 'ALL') {
            filteredQuestions = allQuestions.filter(q => q.year === selectedYear);
        }

        let pool = [];

        if (category === 'REVIEW') {
            pool = filteredQuestions.filter(q => wrongQuestionIds.includes(q.id));
            if (pool.length === 0) {
                alert("選択した年度において、復習が必要な問題はありません！");
                return;
            }
            pool.sort(() => Math.random() - 0.5);
        } else {
            let basePool = category === 'ALL' ? [...filteredQuestions] : filteredQuestions.filter(q => q.category === category);
            
            if (basePool.length === 0) {
                alert("該当する問題データがありません。");
                return;
            }

            let unseenPool = basePool.filter(q => !progressData[q.id] || !progressData[q.id].seen);
            let seenPool = basePool.filter(q => progressData[q.id] && progressData[q.id].seen);

            unseenPool.sort(() => Math.random() - 0.5);
            seenPool.sort(() => Math.random() - 0.5);

            pool = [...unseenPool, ...seenPool];
        }

        currentQuizSet = pool.slice(0, limit);
        currentQuestionIndex = 0;
        score = 0;
        loadQuestion();
        showScreen('quiz');
    }

    function loadQuestion() {
        const q = currentQuizSet[currentQuestionIndex];
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        const isWrongBefore = wrongQuestionIds.includes(q.id);

        document.getElementById('question-text').innerText = `【問${q.id}】\n${q.question}`;
        
        let chipHtml = `<span class="chip" style="background-color: #E3F2FD; color: #1565C0;">${q.year || '令和8年度'}</span>`;
        chipHtml += `<span class="chip" style="margin-left: 8px;">${q.category}</span>`;
        
        if (isWrongBefore) {
            chipHtml += `<span class="chip" style="background-color: #FFEBEE; color: #C62828; margin-left: 8px;">⚠️ 前回間違えた問題</span>`;
        }
        document.querySelector('.chip-container').innerHTML = chipHtml;

        document.getElementById('question-count-label').innerText = `${currentQuestionIndex + 1}/${currentQuizSet.length}`;
        
        const progressPercent = ((currentQuestionIndex) / currentQuizSet.length) * 100;
        document.getElementById('progress-fill').style.width = `${progressPercent}%`;

        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        q.options.forEach((optText, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = optText;
            btn.onclick = () => checkAnswer(index, q.answer, q.explanation);
            optionsContainer.appendChild(btn);
        });
    }

    function checkAnswer(selectedIndex, correctIndex, explanation) {
        const sheet = document.getElementById('explanation-sheet');
        const overlay = document.getElementById('overlay');
        const judgeText = document.getElementById('judgement-text');
        const expText = document.getElementById('explanation-text');
        const q = currentQuizSet[currentQuestionIndex];

        const isCorrect = (selectedIndex === correctIndex);

        recordQuestionResult(q.id, isCorrect);

        if (isCorrect) {
            judgeText.innerText = "正解！ 🎉";
            judgeText.className = "correct";
            score++;
        } else {
            judgeText.innerText = "不正解... 😢";
            judgeText.className = "incorrect";
        }
        
        const correctOptionText = q.options[correctIndex];
        expText.innerHTML = `
            <div style="background: var(--md-primary-container); color: var(--md-on-primary-container); padding: 12px; border-radius: 8px; margin-bottom: 12px; font-weight: bold; font-size: 14px;">
                💡 正解：${correctOptionText}
            </div>
            <div style="font-size: 15px; line-height: 1.6;">${explanation}</div>
        `;
        sheet.classList.add('show');
        overlay.classList.add('show');
    }

    function recordQuestionResult(qId, isCorrect) {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        let wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');

        progressData[qId] = {
            seen: true,
            lastResult: isCorrect ? 'correct' : 'incorrect',
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('progressData', JSON.stringify(progressData));

        if (!isCorrect) {
            if (!wrongQuestionIds.includes(qId)) wrongQuestionIds.push(qId);
        } else {
            wrongQuestionIds = wrongQuestionIds.filter(id => id !== qId);
        }
        localStorage.setItem('wrongQuestionIds', JSON.stringify(wrongQuestionIds));
    }

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentQuizSet.length === 0) return; 

        document.getElementById('explanation-sheet').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < currentQuizSet.length) {
                loadQuestion();
            } else {
                showResult();
            }
        }, 300);
    });

    function showResult() {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('score-text').innerText = `${score} / ${currentQuizSet.length} 問 正解`;
        
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

    document.getElementById('home-btn').addEventListener('click', () => showScreen('home'));

    function updateStreakDisplay() {
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        let totalCount = 0;
        for (let date in studyLog) totalCount += studyLog[date];
        document.getElementById('streak-count').innerText = `累計 ${totalCount}回`;
    }
});
