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

    // 過去問データと用語集データの読み込み
    Promise.all([
        fetch('questions.json').then(res => res.json()),
        fetch('dictionary.json').then(res => res.json())
    ]).then(([questionsData, dictData]) => {
        allQuestions = questionsData;
        dictionary = dictData;
        setupCategoryButtons();
        renderDictionary();
    });

    updateStreakDisplay();

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // コース選択ボタンの生成（令和8年度・令和7年度の枠組み）
    function setupCategoryButtons() {
        const homeCard = document.querySelector('#home-screen .card');
        
        homeCard.innerHTML = `
            <div class="course-group">
                <h4 style="margin-bottom: 12px; color: var(--primary);">【令和8年度 過去問】</h4>
                <button class="btn-primary mode-btn" data-category="ALL" style="margin-bottom:8px;">🎲 全分野からランダム（5問）</button>
                <button class="btn-secondary mode-btn" data-category="ストラテジ系" style="margin-bottom:8px;">📊 ストラテジ系（5問）</button>
                <button class="btn-secondary mode-btn" data-category="マネジメント系" style="margin-bottom:8px;">👥 マネジメント系（5問）</button>
                <button class="btn-secondary mode-btn" data-category="テクノロジ系" style="margin-bottom:16px;">💻 テクノロジ系（5問）</button>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;">
            
            <div class="course-group" style="opacity: 0.6;">
                <h4 style="margin-bottom: 12px; color: #757575;">【令和7年度 過去問】</h4>
                <button class="btn-secondary" disabled style="margin-bottom:8px; cursor:not-allowed;">🚧 準備中（近日公開）</button>
            </div>
        `;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                startQuiz(category);
            });
        });
    }

    // 用語集のレンダリング
    function renderDictionary() {
        const list = document.getElementById('dictionary-list');
        list.innerHTML = '';
        dictionary.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dict-item';
            div.innerHTML = `<h4>${item.term}</h4><p>${item.description}</p>`;
            list.appendChild(div);
        });
    }

    // 辞書画面の開閉イベント
    document.getElementById('open-dict-btn').addEventListener('click', () => {
        showScreen('dict');
    });
    document.getElementById('close-dict-btn').addEventListener('click', () => {
        showScreen('home');
    });

    function startQuiz(category) {
        let pool = [];
        if (category === 'ALL') {
            pool = [...allQuestions];
        } else {
            pool = allQuestions.filter(q => q.category === category);
        }

        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        currentQuizSet = pool.slice(0, 5);
        currentQuestionIndex = 0;
        score = 0;
        loadQuestion();
        showScreen('quiz');
    }

    function loadQuestion() {
        const q = currentQuizSet[currentQuestionIndex];
        document.getElementById('question-text').innerText = `【問${q.id}】\n` + q.question;
        document.getElementById('category-label').innerText = q.category;
        document.getElementById('question-count-label').innerText = `${currentQuestionIndex + 1} / ${currentQuizSet.length}`;
        document.getElementById('progress-fill').style.width = `${((currentQuestionIndex) / currentQuizSet.length) * 100}%`;

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

        if (selectedIndex === correctIndex) {
            judgeText.innerText = "正解！";
            judgeText.className = "correct";
            score++;
        } else {
            judgeText.innerText = "不正解...";
            judgeText.className = "incorrect";
        }
        
        expText.innerText = explanation;
        sheet.classList.add('show');
        overlay.classList.add('show');
    }

    document.getElementById('next-btn').addEventListener('click', () => {
        document.getElementById('explanation-sheet').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
        
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuizSet.length) {
            loadQuestion();
        } else {
            showResult();
        }
    });

    function showResult() {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('score-text').innerText = `${score} / ${currentQuizSet.length} 問 正解`;
        incrementStreak();
        showScreen('result');
    }

    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
    });

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
