document.addEventListener("DOMContentLoaded", () => {
    let questions = [];
    let currentQuestionIndex = 0;
    let score = 0;
    
    // UI要素の取得
    const screens = {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        result: document.getElementById('result-screen')
    };
    
    // データ読み込みと初期化
    fetch('questions.json')
        .then(response => response.json())
        .then(data => {
            questions = data;
        });

    updateStreak();

    // 画面遷移関数
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // スタートボタン
    document.getElementById('start-btn').addEventListener('click', () => {
        currentQuestionIndex = 0;
        score = 0;
        // 本来はランダムシャッフルしますが、MVPとしてそのまま出題します
        loadQuestion();
        showScreen('quiz');
    });

    // 問題の読み込み
    function loadQuestion() {
        const q = questions[currentQuestionIndex];
        document.getElementById('question-text').innerText = q.question;
        document.getElementById('category-label').innerText = q.category;
        document.getElementById('question-count-label').innerText = `${currentQuestionIndex + 1} / ${questions.length}`;
        document.getElementById('progress-fill').style.width = `${((currentQuestionIndex) / questions.length) * 100}%`;

        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = ''; // 選択肢をクリア

        q.options.forEach((optionText, index) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = optionText;
            btn.onclick = () => checkAnswer(index, q.answer, q.explanation);
            optionsContainer.appendChild(btn);
        });
    }

    // 正誤判定と解説表示
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

    // 次の問題へ
    document.getElementById('next-btn').addEventListener('click', () => {
        document.getElementById('explanation-sheet').classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
        
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            loadQuestion();
        } else {
            showResult();
        }
    });

    // 結果画面
    function showResult() {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('score-text').innerText = `${score} / ${questions.length} 問 正解`;
        incrementStreak();
        showScreen('result');
    }

    // ホームへ戻る
    document.getElementById('home-btn').addEventListener('click', () => {
        showScreen('home');
    });

    // ストリーク（連続記録）の管理（LocalStorage利用）
    function updateStreak() {
        const streak = localStorage.getItem('streak') || 0;
        document.getElementById('streak-count').innerText = `${streak}日連続`;
    }

    function incrementStreak() {
        let streak = parseInt(localStorage.getItem('streak') || '0');
        // MVP用：1セットクリアするごとに単純にストリークを増やします
        streak++; 
        localStorage.setItem('streak', streak);
        updateStreak();
    }
});