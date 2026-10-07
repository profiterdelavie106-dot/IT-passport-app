document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let dictionary = [];
    let currentQuestionIndex = 0;
    let score = 0;
    
    // カレンダー表示用年月
    let currentCalDate = new Date();

    const screens = {
        home: document.getElementById('home-screen'),
        dashboard: document.getElementById('dashboard-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
        dict: document.getElementById('dictionary-screen')
    };

    const bottomNav = document.getElementById('bottom-nav');

    // データ読み込み
    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('dictionary.json').then(res => res.json())
    ]).then(([questionsData, dictData]) => {
        allQuestions = questionsData;
        dictionary = dictData;
        setupCategoryButtons();
        renderDictionary();
        setupNavigation();
        updateDashboard();
    }).catch(err => {
        console.error("データの読み込みに失敗しました:", err);
    });

    updateStreakDisplay();

    // 画面切り替え関数
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        window.scrollTo(0, 0);

        if (screenName === 'quiz' || screenName === 'dict' || screenName === 'result') {
            bottomNav.classList.add('hide');
        } else {
            bottomNav.classList.remove('hide');
        }

        if (screenName === 'dashboard') {
            updateDashboard();
        }
    }

    // ボトムナビ設定
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

        document.getElementById('prev-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('next-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // メニューボタンの生成（復習ボタン追加）
    function setupCategoryButtons() {
        const container = document.getElementById('course-buttons-container');
        container.innerHTML = `
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
                <span class="material-icons">menu_book</span> 令和8年度 過去問用語集
            </button>
        `;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const category = target.getAttribute('data-category');
                const limit = parseInt(target.getAttribute('data-limit'));
                startQuiz(category, limit);
            });
        });

        document.getElementById('open-dict-btn').addEventListener('click', () => {
            showScreen('dict');
        });
    }

    // ダッシュボード更新
    function updateDashboard() {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        
        let seenTotal = 0;
        let correctTotal = 0;
        let stratSeen = 0, mgmtSeen = 0, techSeen = 0;

        allQuestions.forEach(q => {
            const stat = progressData[q.id];
            if (stat && stat.seen) {
                seenTotal++;
                if (stat.lastResult === 'correct') correctTotal++;
                if (q.category === 'ストラテジ系') stratSeen++;
                if (q.category === 'マネジメント系') mgmtSeen++;
                if (q.category === 'テクノロジ系') techSeen++;
            }
        });

        const progressPercent = Math.round((seenTotal / (allQuestions.length || 100)) * 100);
        const accuracyPercent = seenTotal > 0 ? Math.round((correctTotal / seenTotal) * 100) : 0;

        document.getElementById('progress-rate').innerText = `${progressPercent}%`;
        document.getElementById('accuracy-rate').innerText = `${accuracyPercent}%`;
        document.getElementById('wrong-count').innerText = `${wrongQuestionIds.length}問`;
        document.getElementById('seen-count-text').innerText = `${seenTotal} / ${allQuestions.length}問`;
        document.getElementById('dashboard-progress-fill').style.width = `${progressPercent}%`;

        document.getElementById('strat-stat').innerText = `${stratSeen}/34問`;
        document.getElementById('strat-bar').style.width = `${Math.round((stratSeen / 34) * 100)}%`;
        document.getElementById('mgmt-stat').innerText = `${mgmtSeen}/20問`;
        document.getElementById('mgmt-bar').style.width = `${Math.round((mgmtSeen / 20) * 100)}%`;
        document.getElementById('tech-stat').innerText = `${techSeen}/46問`;
        document.getElementById('tech-bar').style.width = `${Math.round((techSeen / 46) * 100)}%`;

        renderCalendar();
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
        const todayStr = new Date().toISOString().split('T')[0];

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

    // 用語集
    function renderDictionary() {
        const list = document.getElementById('dictionary-list');
        if (!list) return;
        list.innerHTML = '';
        
        dictionary.forEach(item => {
            const termName = item.term || item.name || item.word || '用語名なし';
            const yomiText = item.yomi || item.reading || '';
            const descText = item.description || item.desc || item.explanation || '解説はありません。';
            
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

    document.getElementById('close-dict-btn').addEventListener('click', () => {
        showScreen('home');
    });

    document.getElementById('exit-quiz-btn').addEventListener('click', () => {
        if (confirm("クイズを終了してホームに戻りますか？\n（ここまでの正解は記録されません）")) {
            showScreen('home');
        }
    });

    // ★クイズ開始（未出題優先・復習モード対応）★
    function startQuiz(category, limit) {
        const progressData = JSON.parse(localStorage.getItem('progressData') || '{}');
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        let pool = [];

        if (category === 'REVIEW') {
            pool = allQuestions.filter(q => wrongQuestionIds.includes(q.id));
            if (pool.length === 0) {
                alert("現在、復習が必要な問題はありません！素晴らしいです。");
                return;
            }
        } else {
            let basePool = category === 'ALL' ? [...allQuestions] : allQuestions.filter(q => q.category === category);
            
            // 未出題と既出題に分ける
            let unseenPool = basePool.filter(q => !progressData[q.id] || !progressData[q.id].seen);
            let seenPool = basePool.filter(q => progressData[q.id] && progressData[q.id].seen);

            // それぞれシャッフル
            unseenPool.sort(() => Math.random() - 0.5);
            seenPool.sort(() => Math.random() - 0.5);

            // 未出題を優先して結合
            pool = [...unseenPool, ...seenPool];
        }

        // さらに全体をシャッフル（復習モード用など）
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        currentQuizSet = pool.slice(0, limit);
        currentQuestionIndex = 0;
        score = 0;
        loadQuestion();
        showScreen('quiz');
    }

    // ★問題表示（前回間違えた問題バッジ対応）★
    function loadQuestion() {
        const q = currentQuizSet[currentQuestionIndex];
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        const isWrongBefore = wrongQuestionIds.includes(q.id);

        document.getElementById('question-text').innerText = `【問${q.id}】\n${q.question}`;
        
        let chipHtml = `<span class="chip">${q.category}</span>`;
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

        // ★進捗と復習リストの更新★
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
            if (!wrongQuestionIds.includes(qId)) {
                wrongQuestionIds.push(qId);
            }
        } else {
            // 正解したら復習リストから削除
            wrongQuestionIds = wrongQuestionIds.filter(id => id !== qId);
        }
        localStorage.setItem('wrongQuestionIds', JSON.stringify(wrongQuestionIds));
    }

    document.getElementById('next-btn').addEventListener('click', () => {
        // 出題データがない場合の誤作動を完全に防止
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
        incrementStreak();
        recordStudySession();
        showScreen('result');
    }

    function recordStudySession() {
        const now = new Date();
        const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const todayStr = jstNow.toISOString().split('T')[0];
        
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        studyLog[todayStr] = (studyLog[todayStr] || 0) + 1;
        localStorage.setItem('studyLog', JSON.stringify(studyLog));
    }

    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
    });

    function updateStreakDisplay() {
        const studyLog = JSON.parse(localStorage.getItem('studyLog') || '{}');
        let totalCount = 0;
        
        // 記録されている全ての日付の学習回数を合算する
        for (let date in studyLog) {
            totalCount += studyLog[date];
        }
        
        document.getElementById('streak-count').innerText = `累計 ${totalCount}回`;
    }
