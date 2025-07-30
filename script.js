document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const topicInput = document.getElementById('topic-input');
    const keywordInput = document.getElementById('keyword-input');
    const scriptLengthSelect = document.getElementById('script-length-select');
    const platformSelect = document.getElementById('platform-select');
    const numVariationsSelect = document.getElementById('num-variations-select');
    const targetAudienceSelect = document.getElementById('target-audience-select'); // New target audience select
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
    const upgradeBtn = document.getElementById('upgrade-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userEmailSpan = document.getElementById('user-email');
    const premiumStatusSpan = document.getElementById('premium-status');
    const logoutBtn = document.getElementById('logout-btn');

    let userToken = localStorage.getItem('userToken');

    // Function to update UI based on login status
    const updateUI = async () => {
        if (userToken) {
            authModal.style.display = 'none';
            userInfoDiv.style.display = 'block';
            try {
                const response = await fetch('/user-info', {
                    headers: {
                        'Authorization': `Bearer ${userToken}`
                    }
                });
                const data = await response.json();
                if (response.ok) {
                    userEmailSpan.textContent = data.email;
                    premiumStatusSpan.textContent = data.is_premium ? '프리미엄 사용자' : '무료 사용자';
                    if (data.is_premium) {
                        upgradeBtn.style.display = 'none';
                        keywordInput.disabled = false; // Enable keyword input for premium users
                        keywordInput.placeholder = "포함할 키워드 (선택 사항)";
                        scriptLengthSelect.disabled = false; // Enable script length select for premium users
                        numVariationsSelect.disabled = false; // Enable num variations select for premium users
                        targetAudienceSelect.disabled = false; // Enable target audience select for premium users
                    } else {
                        upgradeBtn.style.display = 'inline-block';
                        keywordInput.disabled = true; // Disable keyword input for free users
                        keywordInput.placeholder = "프리미엄: 포함할 키워드 (선택 사항)";
                        scriptLengthSelect.disabled = true; // Disable script length select for free users
                        scriptLengthSelect.value = "1"; // Reset to 1 minute for free users
                        numVariationsSelect.disabled = true; // Disable num variations select for free users
                        numVariationsSelect.value = "1"; // Reset to 1 variation for free users
                        targetAudienceSelect.disabled = true; // Disable target audience select for free users
                        targetAudienceSelect.value = "general"; // Reset to general for free users
                    }
                } else {
                    console.error('Failed to fetch user info:', data.error);
                    // If token is invalid, clear it and show login modal
                    localStorage.removeItem('userToken');
                    userToken = null;
                    authModal.style.display = 'flex';
                    userInfoDiv.style.display = 'none';
                }
            } catch (error) {
                console.error('Error fetching user info:', error);
                // If network error, clear token and show login modal
                localStorage.removeItem('userToken');
                userToken = null;
                authModal.style.display = 'flex';
                userInfoDiv.style.display = 'none';
            }
        } else {
            authModal.style.display = 'flex';
            userInfoDiv.style.display = 'none';
        }
    };

    // Initial UI update
    updateUI();

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
                updateUI(); // Update UI after successful login
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

    // Logout button click
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userToken');
        userToken = null;
        updateUI(); // Update UI after logout
        alert('로그아웃되었습니다.');
    });

    // Upgrade button click
    upgradeBtn.addEventListener('click', () => {
        // Replace this with your actual PayPal.me link or other payment link
        const paymentLink = "https://paypal.me/yourusername/9.99"; // Example: PayPal.me link for $9.99
        window.open(paymentLink, '_blank'); // Open in new tab
        alert("결제 완료 후, 이메일(your_email@example.com)로 결제 완료 사실과 회원가입 이메일을 보내주시면 프리미엄으로 전환해 드립니다.");
    });

    generateBtn.addEventListener('click', () => {
        const topic = topicInput.value;
        const tone = toneSelect.value;
        const keyword = keywordInput.value;
        const scriptLength = scriptLengthSelect.value;
        const platform = platformSelect.value;
        const numVariations = numVariationsSelect.value;
        const targetAudience = targetAudienceSelect.value; // Get target audience value

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
            body: JSON.stringify({ topic, tone, keyword, scriptLength, platform, numVariations, targetAudience }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            // Display multiple scripts
            let allScriptsHtml = '';
            let scriptsToDisplay = [];

            if (Array.isArray(data.script)) {
                // If server already sent an array (e.g., for multiple variations)
                scriptsToDisplay = data.script;
            } else if (typeof data.script === 'string' && data.script.includes('---SCRIPT_SEPARATOR---')) {
                // If server sent a single string with separators
                scriptsToDisplay = data.script.split('---SCRIPT_SEPARATOR---').map(s => s.trim()).filter(s => s.length > 0);
            } else {
                // Single script case
                scriptsToDisplay = [data.script];
            }

            if (scriptsToDisplay.length === 0) {
                allScriptsHtml = '<p>생성된 대본이 없습니다. 다시 시도해주세요.</p>';
            } else {
                scriptsToDisplay.forEach((script, index) => {
                    allScriptsHtml += `
                        <div class="script-variation">
                            <h3>대본 #${index + 1}</h3>
                            <div class="generated-script-content">${script}</div>
                            <div class="script-actions">
                                <button class="copy-single-script-btn" data-script="${script}">이 대본 복사</button>
                            </div>
                        </div>
                    `;
                });
            }
            scriptOutput.innerHTML = allScriptsHtml;

            // Add event listeners for new copy buttons
            document.querySelectorAll('.copy-single-script-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const scriptToCopy = event.target.dataset.script;
                    if (navigator.clipboard && scriptToCopy) {
                        navigator.clipboard.writeText(scriptToCopy).then(() => {
                            const originalText = event.target.innerText;
                            event.target.innerText = '복사 완료!';
                            setTimeout(() => {
                                event.target.innerText = originalText;
                            }, 2000);
                        }).catch(err => {
                            console.error('Copy failed', err);
                        });
                    }
                });
            });

        })
        .catch(error => {
            console.error('Error:', error);
            scriptOutput.innerHTML = `대본 생성에 실패했습니다. 오류: ${error.message}`;
        });
    });

    // Main copy button now copies all scripts
    copyBtn.addEventListener('click', () => {
        let allScriptsContent = '';
        document.querySelectorAll('.generated-script-content').forEach(div => {
            allScriptsContent += div.innerText + '\n\n---\n\n';
        });

        if (navigator.clipboard && allScriptsContent) {
            navigator.clipboard.writeText(allScriptsContent).then(() => {
                // Visual feedback
                const originalText = copyBtn.innerText;
                copyBtn.innerText = '모두 복사 완료!';
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
