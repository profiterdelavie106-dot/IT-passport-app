document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let dictionary = [];
    let currentQuestionIndex = 0;
    let score = 0;
    
    const screens = {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen'),
        dict: document.getElementById('dictionary-screen')
    };

    // データ読み込み
    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('dictionary.json').then(res => res.json())
    ]).then(([questionsData, dictData]) => {
        allQuestions = questionsData;
        dictionary = dictData;
        setupCategoryButtons();
        renderDictionary();
    }).catch(err => {
        console.error("データの読み込みに失敗しました:", err);
    });

    updateStreakDisplay();

    // 画面切り替え関数
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        window.scrollTo(0, 0); // 画面遷移時に上へスクロール
    }

    // メニューボタンの生成
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
            
            <div style="margin: 24px 0 12px 0; border-top: 1px solid var(--md-outline); opacity: 0.3;"></div>
            
            <button id="open-dict-btn" class="md-btn md-btn-outline">
                <span class="material-icons">menu_book</span> 令和8年度 過去問用語集
            </button>
        `;

        // クイズ開始イベント
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const category = target.getAttribute('data-category');
                const limit = parseInt(target.getAttribute('data-limit'));
                startQuiz(category, limit);
            });
        });

        // 用語集を開くイベント
        document.getElementById('open-dict-btn').addEventListener('click', () => {
            showScreen('dict');
        });
    }

   // 用語集のレンダリング
    function renderDictionary() {
        const list = document.getElementById('dictionary-list');
        list.innerHTML = '';
        dictionary.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dict-item';
            
            let termHtml = `<h4>${item.term}</h4>`;
            if (item.yomi) {
                termHtml += `<div class="yomi">（${item.yomi}）</div>`;
            }
            
            div.innerHTML = `${termHtml}<p class="desc">${item.description}</p>`;
            list.appendChild(div);
        });
    }

    // 用語集からホームへ戻るイベント
    document.getElementById('close-dict-btn').addEventListener('click', () => {
        showScreen('home');
    });

    // クイズの途中で退出するイベント
    document.getElementById('exit-quiz-btn').addEventListener('click', () => {
        if (confirm("クイズを終了してホームに戻りますか？\n（ここまでの正解は記録されません）")) {
            showScreen('home');
        }
    });

    // クイズ開始処理
    function startQuiz(category, limit) {
        let pool = [];
        if (category === 'ALL') {
            pool = [...allQuestions];
        } else {
            pool = allQuestions.filter(q => q.category === category);
        }

        // Fisher-Yates シャッフル
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // 指定された問題数（15問 or 5問）を抽出
        currentQuizSet = pool.slice(0, limit);
        currentQuestionIndex = 0;
        score = 0;
        
        loadQuestion();
        showScreen('quiz');
    }

    // 問題の読み込みと表示
    function loadQuestion() {
        const q = currentQuizSet[currentQuestionIndex];
        document.getElementById('question-text').innerText = `【問${q.id}】\n${q.question}`;
        document.getElementById('category-label').innerText = q.category;
        document.getElementById('question-count-label').innerText = `${currentQuestionIndex + 1}/${currentQuizSet.length}`;
        
        // プログレスバーの更新
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

    // 正誤判定
    function checkAnswer(selectedIndex, correctIndex, explanation) {
        const sheet = document.getElementById('explanation-sheet');
        const overlay = document.getElementById('overlay');
        const judgeText = document.getElementById('judgement-text');
        const expText = document.getElementById('explanation-text');

        if (selectedIndex === correctIndex) {
            judgeText.innerText = "正解！ 🎉";
            judgeText.className = "correct";
            score++;
        } else {
            judgeText.innerText = "不正解... 😢";
            judgeText.className = "incorrect";
        }
        
        expText.innerText = explanation;
        sheet.classList.add('show');
        overlay.classList.add('show');
    }

    // 次の問題へ
    document.getElementById('next-btn').addEventListener('click', () => {
        document.getElementById('explanation-sheet').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
        
        // シートが下がるアニメーションを待つ
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex < currentQuizSet.length) {
                loadQuestion();
            } else {
                showResult();
            }
        }, 300);
    });

    // 結果画面表示
    function showResult() {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('score-text').innerText = `${score} / ${currentQuizSet.length} 問 正解`;
        incrementStreak();
        showScreen('result');
    }

    // 結果画面からホームへ戻る
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
    });

    // 連続記録（ストリーク）の管理
    function updateStreakDisplay() {
        const streak = localStorage.getItem('streak') || 0;
        document.getElementById('streak-count').innerText = `${streak}日連続`;
    }

    function incrementStreak() {
        let streak = parseInt(localStorage.getItem('streak') || '0');
        streak++;
        localStorage.setItem('streak', streak);
        updateStreakDisplay();
    }
});
