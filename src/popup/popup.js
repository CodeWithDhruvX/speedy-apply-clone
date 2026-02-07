document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('profileForm');
    const status = document.getElementById('status');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 1. Tab Switching Logic
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked
            tab.classList.add('active');
            const targetId = tab.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 2. Load Data from Chrome Storage
    try {
        const data = await chrome.storage.local.get('profile');
        if (data.profile) {
            populateForm(data.profile);
        }
    } catch (e) {
        console.error('Error loading data:', e);
    }

    // 3. Save Data
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const profile = {
            personal: {},
            links: {},
            work: {}
        };

        // Convert flat "section.key" names into nested object
        for (let [name, value] of formData.entries()) {
            const [section, key] = name.split('.');
            if (section && key) {
                if (!profile[section]) profile[section] = {};
                profile[section][key] = value.trim();
            }
        }

        try {
            await chrome.storage.local.set({ profile });
            showStatus('Profile saved successfully!', 'success');
        } catch (e) {
            showStatus('Error saving profile.', 'error');
            console.error(e);
        }
    });

    // 4. Manual Fill Trigger
    const fillBtn = document.getElementById('fillBtn');
    if (fillBtn) {
        fillBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { action: "fill" });
                    showStatus('Fill command sent!', 'success');
                } catch (e) {
                    showStatus('Could not send command. Refresh page?', 'error');
                }
            }
        });
    }

    function populateForm(profile) {
        for (const section in profile) {
            for (const key in profile[section]) {
                const inputName = `${section}.${key}`;
                const input = form.querySelector(`[name="${inputName}"]`);
                if (input) {
                    input.value = profile[section][key];
                }
            }
        }
    }

    function showStatus(msg, type) {
        status.textContent = msg;
        status.style.color = type === 'success' ? 'var(--success)' : '#ef4444';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    }
});
