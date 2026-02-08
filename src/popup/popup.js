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
    let profiles = [];
    let activeProfileId = null;

    // 0. Init Auto-fill Toggle
    const autoFillToggle = document.getElementById('autoFillToggle');
    chrome.storage.local.get(['isAutoFillEnabled'], (result) => {
        // Default to true if undefined
        const isEnabled = result.isAutoFillEnabled !== false;
        autoFillToggle.checked = isEnabled;
    });

    autoFillToggle.addEventListener('change', () => {
        const isEnabled = autoFillToggle.checked;
        chrome.storage.local.set({ isAutoFillEnabled: isEnabled }, () => {
            showStatus(isEnabled ? 'Global Auto-fill Enabled' : 'Global Auto-fill Disabled', 'success');
        });
    });

    // 0.5. Init Page-Specific Toggle
    const pageSpecificToggle = document.getElementById('pageSpecificToggle');
    const currentDomainEl = document.getElementById('currentDomain');

    // Get current tab's domain
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            let currentDomain = null;
            try {
                const url = new URL(tab.url);
                currentDomain = url.hostname.replace(/^www\./, '');
            } catch (e) {
                console.error('Error parsing URL:', e);
            }

            if (currentDomain && currentDomainEl) {
                currentDomainEl.textContent = currentDomain;

                // Load page-specific setting
                chrome.storage.local.get(['pageSpecificSettings'], (result) => {
                    const pageSettings = result.pageSpecificSettings || {};
                    const isEnabled = pageSettings[currentDomain] !== false; // Default true
                    pageSpecificToggle.checked = isEnabled;
                });

                // Add event listener for page-specific toggle
                pageSpecificToggle.addEventListener('change', () => {
                    const isEnabled = pageSpecificToggle.checked;
                    chrome.storage.local.get(['pageSpecificSettings'], (result) => {
                        const pageSettings = result.pageSpecificSettings || {};
                        pageSettings[currentDomain] = isEnabled;
                        chrome.storage.local.set({ pageSpecificSettings: pageSettings }, () => {
                            showStatus(
                                isEnabled ? `Auto-fill enabled for ${currentDomain}` : `Auto-fill disabled for ${currentDomain}`,
                                'success'
                            );
                        });
                    });
                });
            } else if (currentDomainEl) {
                currentDomainEl.textContent = 'Not a web page';
                pageSpecificToggle.disabled = true;
            }
        }
    } catch (e) {
        console.error('Error getting current tab:', e);
        if (currentDomainEl) {
            currentDomainEl.textContent = 'Error loading';
        }
    }

    try {
        const data = await chrome.storage.local.get(['profiles', 'activeProfileId', 'profile']);

        if (data.profiles && data.profiles.length > 0) {
            profiles = data.profiles;
            activeProfileId = data.activeProfileId || profiles[0].id;
        } else if (data.profile) {
            // Migration handling (if missed by options page)
            profiles = [{
                id: 'default',
                name: 'Default Profile',
                data: data.profile
            }];
            activeProfileId = 'default';
        } else {
            // No data or empty
            profiles = [{
                id: 'default',
                name: 'My Profile',
                data: {}
            }];
            activeProfileId = 'default';
        }

        renderProfileSelector();
        loadActiveProfile();

    } catch (e) {
        console.error('Error loading data:', e);
    }

    // Render Selector
    function renderProfileSelector() {
        const selector = document.getElementById('profileSelector');
        selector.innerHTML = '';
        profiles.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            if (p.id === activeProfileId) option.selected = true;
            selector.appendChild(option);
        });

        selector.addEventListener('change', (e) => {
            activeProfileId = e.target.value;
            chrome.storage.local.set({ activeProfileId });
            loadActiveProfile();
        });
    }

    function loadActiveProfile() {
        const active = profiles.find(p => p.id === activeProfileId);
        if (active && active.data) {
            populateForm(active.data);
            showStatus(`Loaded: ${active.name}`, 'success');
        }
    }

    // 3. Save Data
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const newProfileData = {
            personal: {},
            links: {},
            preferences: {},
            education: [],
            work: []
        };

        // Initialize arrays with a single object to hold the form data
        // The popup currently only supports editing the *first* entry.
        newProfileData.education = [{}];
        newProfileData.work = [{}];

        // Get existing data to preserve unedited fields (like Education/Work arrays)
        // logic: if we have existing arrays, we might want to preserve items 2..n
        let existingEducation = [];
        let existingWork = [];

        const currentProfileIndex = profiles.findIndex(p => p.id === activeProfileId);
        if (currentProfileIndex !== -1) {
            const existingData = profiles[currentProfileIndex].data || {};
            if (existingData.education && Array.isArray(existingData.education)) {
                existingEducation = existingData.education;
            }
            if (existingData.work && Array.isArray(existingData.work)) {
                existingWork = existingData.work;
            }
        }

        // Convert flat "section.key" names into nested object
        for (let [name, value] of formData.entries()) {
            const [section, key] = name.split('.');
            if (section && key) {
                if (section === 'work' || section === 'education') {
                    // Update the first item in the new data array
                    newProfileData[section][0][key] = value.trim();
                } else {
                    if (!newProfileData[section]) newProfileData[section] = {};
                    newProfileData[section][key] = value.trim();
                }
            }
        }

        // Merge: Keep the *new* first item, but append existing items 1..n if they exist
        if (existingEducation.length > 1) {
            newProfileData.education = [newProfileData.education[0], ...existingEducation.slice(1)];
        }
        if (existingWork.length > 1) {
            newProfileData.work = [newProfileData.work[0], ...existingWork.slice(1)];
        }

        try {
            if (currentProfileIndex !== -1) {
                profiles[currentProfileIndex].data = {
                    ...profiles[currentProfileIndex].data, // Keep other fields
                    ...newProfileData
                };
                await chrome.storage.local.set({ profiles });
                showStatus('Profile saved successfully!', 'success');
            }
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
        // Clear inputs first
        form.reset();

        for (const section in profile) {
            if (section === 'education' || Array.isArray(profile[section])) continue; // Skip arrays

            for (const key in profile[section]) {
                const inputName = `${section}.${key}`;
                const input = form.querySelector(`[name="${inputName}"]`);
                if (input) {
                    input.value = profile[section][key];
                }
            }
        }

        // Handle work array if it exists (fallback to first item for simple inputs)
        // The popup currently uses simple inputs for work. 
        // If user used Options page to satisfy work array, we might want to map 1st item -> popup inputs?
        // For now, let's keep popup simple. 
    }

    function showStatus(msg, type) {
        status.textContent = msg;
        status.style.color = type === 'success' ? 'var(--success)' : '#ef4444';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    }
});
