/* ボトムシート（解説表示）の固定と隠蔽 */
.bottom-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0 auto;
    max-width: 480px;
    background: #ffffff; /* 環境に合わせてvar(--md-surface)等に変更可 */
    border-radius: 24px 24px 0 0;
    padding: 24px;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
    transform: translateY(100%); /* 画面下部に完全に隠す */
    visibility: hidden; /* 非表示状態にする */
    transition: transform 0.3s ease-out, visibility 0.3s;
    z-index: 100;
}

.bottom-sheet.show {
    transform: translateY(0);
    visibility: visible;
}

#overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none; /* 非表示時はクリックを貫通させる */
    transition: opacity 0.3s;
    z-index: 90;
}

#overlay.show {
    opacity: 1;
    pointer-events: auto;
}
