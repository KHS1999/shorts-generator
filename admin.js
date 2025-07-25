document.addEventListener('DOMContentLoaded', () => {
    const adminSecretInput = document.getElementById('admin-secret-input');
    const userEmailInput = document.getElementById('user-email-input');
    const premiumStatusSelect = document.getElementById('premium-status-select');
    const updateBtn = document.getElementById('update-btn');
    const adminMessage = document.getElementById('admin-message');

    updateBtn.addEventListener('click', async () => {
        const adminSecret = adminSecretInput.value;
        const email = userEmailInput.value;
        const isPremium = parseInt(premiumStatusSelect.value);

        if (!adminSecret || !email) {
            adminMessage.textContent = '관리자 비밀 키와 사용자 이메일을 입력해주세요.';
            adminMessage.style.color = 'red';
            return;
        }

        try {
            const response = await fetch('/admin/update-premium', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ adminSecret, email, isPremium }),
            });
            const data = await response.json();

            if (response.ok) {
                adminMessage.textContent = data.message;
                adminMessage.style.color = 'green';
            } else {
                adminMessage.textContent = data.error || '상태 업데이트 실패';
                adminMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Admin update error:', error);
            adminMessage.textContent = '서버 오류 발생';
            adminMessage.style.color = 'red';
        }
    });
});