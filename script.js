document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const topicInput = document.getElementById('topic-input');
    const toneSelect = document.getElementById('tone-select');
    const scriptOutput = document.getElementById('script-output');
    const resultContainer = document.getElementById('result-container');
    const copyBtn = document.getElementById('copy-btn');

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
