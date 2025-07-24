document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const topicInput = document.getElementById('topic-input');
    const toneSelect = document.getElementById('tone-select');
    const scriptOutput = document.getElementById('script-output');
    const resultContainer = document.getElementById('result-container');
    const copyBtn = document.getElementById('copy-btn');

    // Auth elements
    const authModal = document.getElementById('auth-modal');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const authMessage = document.getElementById('auth-message');

    let userToken = localStorage.getItem('userToken');

    // Show modal if not logged in
    if (!userToken) {
        authModal.style.display = 'flex';
    } else {
        authModal.style.display = 'none';
    }

    // Register button click
    registerBtn.addEventListener('click', async () => {
        const email = authEmailInput.value;
        const password = authPasswordInput.value;

        if (!email || !password) {
            authMessage.textContent = '이메일과 비밀번호를 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                authMessage.textContent = data.message + ' 이제 로그인해주세요.';
                authMessage.style.color = 'green';
            } else {
                authMessage.textContent = data.error || '회원가입 실패';
                authMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Registration error:', error);
            authMessage.textContent = '서버 오류 발생';
            authMessage.style.color = 'red';
        }
    });

    // Login button click
    loginBtn.addEventListener('click', async () => {
        const email = authEmailInput.value;
        const password = authPasswordInput.value;

        if (!email || !password) {
            authMessage.textContent = '이메일과 비밀번호를 입력해주세요.';
            return;
        }

        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('userToken', data.token);
                userToken = data.token;
                authModal.style.display = 'none';
                authMessage.textContent = '';
            } else {
                authMessage.textContent = data.error || '로그인 실패';
                authMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Login error:', error);
            authMessage.textContent = '서버 오류 발생';
            authMessage.style.color = 'red';
        }
    });

    generateBtn.addEventListener('click', () => {
        const topic = topicInput.value;
        const tone = toneSelect.value;

        if (!topic) {
            alert('주제를 입력해주세요!');
            return;
        }

        // Show the result container and a loading message
        resultContainer.style.display = 'block';
        scriptOutput.innerHTML = 'AI가 대본을 생성하고 있습니다...';

                // --- Real AI Script Generation ---
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` // Add token to header
            },
            body: JSON.stringify({ topic, tone }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            scriptOutput.innerText = data.script;
        })
        .catch(error => {
            console.error('Error:', error);
            scriptOutput.innerText = `대본 생성에 실패했습니다. 오류: ${error.message}`;
        });
    });

    copyBtn.addEventListener('click', () => {
        if (navigator.clipboard && scriptOutput.innerText) {
            navigator.clipboard.writeText(scriptOutput.innerText).then(() => {
                // Visual feedback
                const originalText = copyBtn.innerText;
                copyBtn.innerText = '복사 완료!';
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Copy failed', err);
            });
        } else {
            alert("복사할 내용이 없거나 브라우저가 지원하지 않습니다.");
        }
    });
});
