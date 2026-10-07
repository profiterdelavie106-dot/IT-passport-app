document.addEventListener("DOMContentLoaded", () => {
    let allQuestions = [];
    let currentQuizSet = [];
    let dictionary = [];
    let currentQuestionIndex = 0;
    let score = 0;
    let isReviewMode = false;
    
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

    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        window.scrollTo(0, 0);

        if (screenName === 'quiz' || screenName === 'dict' || screenName === 'result') {
            bottomNav.classList.add('hide');
        } else {
            bottomNav.classList.remove('hide');
        }

        if (screenName === 'home') {
            setupCategoryButtons(); // 復習問数の更新
        }
        if (screenName === 'dashboard') {
            updateDashboard();
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

        document.getElementById('prev-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('next-month-btn').addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderCalendar();
        });
    }

    // コース選択ボタンの生成
    function setupCategoryButtons() {
        const container = document.getElementById('course-buttons-container');
        const wrongQuestionIds = JSON.parse(localStorage.getItem('wrongQuestionIds') || '[]');
        const wrongCount = wrongQuestionIds.length;

        let reviewBtnHtml = '';
        if (wrongCount > 0) {
            reviewBtnHtml = `
                <button id="review-mode-btn" class="md-btn md-btn-warning">
                    <span class="material-icons">repeat</span> 間違えた問題を復習 (${wrongCount}問)
                </button>
                <div style="margin: 12px 0; border-top: 1px dashed var(--md-outline); opacity: 0.3;"></div>
            `;
        }

        container.innerHTML = `
            ${reviewBtnHtml}
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
