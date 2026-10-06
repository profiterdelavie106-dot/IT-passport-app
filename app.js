document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let currentQuestionIndex = 0;
    let score = 0;
    
    const screens = {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen')
    };

    // 問題データの読み込み
    fetch('questions.json')
        .then(response => response.json())
        .then(data => {
            allQuestions = data;
            setupCategoryButtons();
        });

    updateStreakDisplay();

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // 各ボタンのクリックイベントを設定
    function setupCategoryButtons() {
        const homeCard = document.querySelector('#home-screen .card');
        
        // カテゴリ別ボタンをホーム画面に動的生成
        homeCard.innerHTML = `
            <h3>5分間道場（5問ランダム）</h3>
            <p>学習したいコースを選んでください</p>
            <button class="btn-primary mode-btn" data-category="ALL" style="margin-bottom:8px;">🎲 全分野からランダム（5問）</button>
            <button class="btn-secondary mode-btn" data-category="ストラテジ系" style="margin-bottom:8px;">📊 ストラテジ系（5問）</button>
            <button class="btn-secondary mode-btn" data-category="マネジメント系" style="margin-bottom:8px;">👥 マネジメント系（5問）</button>
            <button class="btn-secondary mode-btn" data-category="テクノロジ系" style="margin-bottom:8px;">💻 テクノロジ系（5問）</button>
        `;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                startQuiz(category);
            });
        });
    }

    // 5問をランダム抽出してクイズを開始
    function startQuiz(category) {
        let pool = [];
        if (category === 'ALL') {
            pool = [...allQuestions];
        } else {
            pool = allQuestions.filter(q => q.category === category);
        }

        // Fisher-Yates シャッフルで完全ランダム化
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        // 5問だけを抽出（5問未満の場合はプール全体）
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
