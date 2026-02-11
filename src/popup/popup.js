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

    // 7. Drag Logic for Pinned Mode
    const header = document.querySelector('header');
    if (header) {
        header.addEventListener('mousedown', (e) => {
            // Ignore clicks on buttons/inputs inside header
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.slider')) return;

            // Only trigger if in pinned mode (we can infer or check param)
            // But checking param is safer
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('pinned') === 'true') {
                e.preventDefault(); // Prevent text selection
                // Send message to parent
                window.parent.postMessage({
                    type: 'SPEEDY_DRAG_START',
                    screenX: e.screenX,
                    screenY: e.screenY
                }, '*');
            }
        });

        // Listen for drag end to reset cursor (optional, if we changed it)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SPEEDY_DRAG_END') {
                // Reset stuff if needed
            }
        });
    }

    // Get current tab's domain
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            let currentDomain = null;
            try {
                const url = new URL(tab.url);
                currentDomain = url.hostname.replace(/^www\./, '');
            } catch (e) {

            }

            if (currentDomain && currentDomainEl) {
                currentDomainEl.textContent = currentDomain;

                // Load page-specific setting
                chrome.storage.local.get(['pageSpecificSettings'], (result) => {
                    const pageSettings = result.pageSpecificSettings || {};
                    const isEnabled = pageSettings[currentDomain] === true; // Default false
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
        // Inject copy buttons after form is populated
        setTimeout(injectCopyButtons, 100);
    }

    // 2.1 Setup Copy Feature
    setupCopyFeature();

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

        // Initialize arrays as empty. We only create the first item object
        // if we actually find form data for it.
        newProfileData.education = [];
        newProfileData.work = [];

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
                    if (!newProfileData[section][0]) {
                        newProfileData[section][0] = {};
                    }
                    newProfileData[section][0][key] = value.trim();
                } else {
                    if (!newProfileData[section]) newProfileData[section] = {};
                    newProfileData[section][key] = value.trim();
                }
            }
        }

        // Merge: Keep the *new* first item, but append existing items 1..n if they exist.
        // If no new item was created (no form fields), keep existing items entirely.
        if (newProfileData.education.length > 0) {
            newProfileData.education = [newProfileData.education[0], ...existingEducation.slice(1)];
        } else {
            newProfileData.education = existingEducation;
        }

        if (newProfileData.work.length > 0) {
            newProfileData.work = [newProfileData.work[0], ...existingWork.slice(1)];
        } else {
            newProfileData.work = existingWork;
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

        // --- NEW: Handle History Tabs ---
        renderHistoryTabs(profile);
    }

    function renderHistoryTabs(profile) {
        const eduTab = document.getElementById('tab-education');
        const workTab = document.getElementById('tab-work-history');
        const eduList = document.getElementById('education-list');
        const workList = document.getElementById('work-history-list');

        // Education
        if (profile.education && Array.isArray(profile.education) && profile.education.length > 0) {
            eduTab.style.display = 'block';
            eduList.innerHTML = profile.education.map(edu => `
                <div class="history-item">
                    <div class="form-group">
                        <label>School / University</label>
                        <input type="text" readonly value="${edu.school || ''}">
                    </div>
                    <div class="form-group">
                        <label>Degree</label>
                        <input type="text" readonly value="${edu.degree || ''}">
                    </div>
                    <div class="form-group">
                        <label>Field of Study</label>
                        <input type="text" readonly value="${edu.field || ''}">
                    </div>
                    <div class="form-group">
                        <label>GPA / Grade</label>
                        <input type="text" readonly value="${edu.grade || ''}">
                    </div>
                    <div class="form-group">
                        <label>Dates</label>
                        <input type="text" readonly value="${edu.startDate || ''} - ${edu.endDate || ''}">
                    </div>
                </div>
            `).join('');
        } else {
            eduTab.style.display = 'none';
            eduList.innerHTML = '<div class="status">No education history found.</div>';
        }

        // Work History
        if (profile.work && Array.isArray(profile.work) && profile.work.length > 0) {
            workTab.style.display = 'block';
            workList.innerHTML = profile.work.map(job => `
                <div class="history-item">
                    <div class="form-group">
                        <label>Company</label>
                        <input type="text" readonly value="${job.company || ''}">
                    </div>
                    <div class="form-group">
                        <label>Job Title</label>
                        <input type="text" readonly value="${job.title || ''}">
                    </div>
                    <div class="form-group">
                        <label>Location</label>
                        <input type="text" readonly value="${job.location || ''}">
                    </div>
                    <div class="form-group">
                        <label>Dates</label>
                        <input type="text" readonly value="${job.startDate || ''} - ${job.endDate || ''}">
                    </div>
                    <div class="form-group full-width">
                        <label>Description</label>
                        <textarea readonly rows="3">${job.description || ''}</textarea>
                    </div>
                </div>
            `).join('');
        } else {
            workTab.style.display = 'none';
            workList.innerHTML = '<div class="status">No work history found.</div>';
        }

        // Re-inject copy buttons for these new fields
        setTimeout(injectCopyButtons, 0);
    }

    function showStatus(msg, type) {
        status.textContent = msg;
        status.style.color = type === 'success' ? 'var(--success)' : '#ef4444';
        setTimeout(() => {
            status.textContent = '';
        }, 3000);
    }


    function setupCopyFeature() {
        // Global event listener for copy buttons
        document.body.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-field-btn')) {
                e.preventDefault();
                const btn = e.target;
                const label = btn.parentElement;

                // In popup, input is usually sibling of label in .form-group
                const formGroup = label.parentElement;
                const input = formGroup.querySelector('input, textarea, select');

                if (input) {
                    const value = input.value;
                    if (value) {
                        navigator.clipboard.writeText(value).then(() => {
                            const originalText = btn.textContent;
                            btn.textContent = '✅';
                            btn.style.color = 'var(--success)';
                            btn.style.opacity = '1';

                            setTimeout(() => {
                                btn.textContent = originalText;
                                btn.style.color = '';
                                btn.style.opacity = '';
                            }, 1000);
                        });
                    }
                }
            }
        });
    }

    function injectCopyButtons() {
        const labels = document.querySelectorAll('.form-group > label');
        labels.forEach(label => {
            // Check if button already exists
            if (!label.querySelector('.copy-field-btn')) {
                const btn = document.createElement('button');
                btn.className = 'copy-field-btn';
                btn.title = 'Copy value';
                btn.textContent = '📋';
                btn.type = 'button'; // Prevent form submission
                label.appendChild(btn);
            }
        });
    }

    // 5. Pin/Unpin Logic
    const pinBtn = document.getElementById('pinBtn');
    const unpinBtn = document.getElementById('unpinBtn');
    const minimizeBtn = document.getElementById('minimizeBtn');

    // Check if we are in "pinned" mode
    const urlParams = new URLSearchParams(window.location.search);
    const isPinned = urlParams.get('pinned') === 'true';
    const tabIdParam = urlParams.get('tabId');

    if (isPinned) {
        if (pinBtn) pinBtn.style.display = 'none';
        if (unpinBtn) unpinBtn.style.display = 'flex';
        if (minimizeBtn) minimizeBtn.style.display = 'flex';
        document.body.classList.add('pinned-mode');
    } else {
        if (pinBtn) pinBtn.style.display = 'flex';
        if (unpinBtn) unpinBtn.style.display = 'none';
        if (minimizeBtn) minimizeBtn.style.display = 'none';
    }

    if (pinBtn) {
        pinBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                // Pass tabId so engine can pass it back to the pinned iframe
                chrome.tabs.sendMessage(tab.id, { action: "toggle_pin_popup", tabId: tab.id }, () => {
                    if (chrome.runtime.lastError) {

                    }
                    window.close();
                });

                // Fallback: If callback never fires (e.g. content script not ready), close anyway after timeout
                setTimeout(() => window.close(), 500);
            }
        });
    }

    if (unpinBtn) {
        unpinBtn.addEventListener('click', async () => {
            // Use passed tabId if available, otherwise query
            let targetTabId = tabIdParam ? parseInt(tabIdParam) : null;

            if (!targetTabId) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) targetTabId = tab.id;
            }

            if (targetTabId) {
                chrome.tabs.sendMessage(targetTabId, { action: "toggle_pin_popup" }, (response) => {
                    if (chrome.runtime.lastError) {

                    }
                });
            } else {

            }
        });
    }

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { action: "minimize_popup", tabId: tab.id }, () => {

                });
            }
        });
    }


    // 6. Global Search Logic
    const globalSearchInput = document.getElementById('globalSearch');
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const formGroups = document.querySelectorAll('.form-group');

            if (query.length > 0) {
                document.body.classList.add('search-mode');

                formGroups.forEach(group => {
                    const label = group.querySelector('label')?.textContent.toLowerCase() || '';
                    const input = group.querySelector('input, textarea, select');
                    const value = input?.value.toLowerCase() || '';

                    if (label.includes(query) || value.includes(query)) {
                        group.classList.add('match');
                    } else {
                        group.classList.remove('match');
                    }
                });

                // Search History Items
                const historyItems = document.querySelectorAll('.history-item');
                historyItems.forEach(item => {
                    const text = item.textContent.toLowerCase();
                    if (text.includes(query)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                });
            } else {
                document.body.classList.remove('search-mode');
                formGroups.forEach(group => group.classList.remove('match'));

                // Restore History Items
                document.querySelectorAll('.history-item').forEach(item => item.style.display = 'flex');

                // Restore tabs: find active tab and ensure it's visible (though search-mode removal handles this via CSS)
            }
        });
    }

    // 7. Email Generator Logic
    const generateEmailBtn = document.getElementById('generateEmailBtn');
    const copyEmailBtn = document.getElementById('copyEmailBtn');
    const generatedEmailOutput = document.getElementById('generated-email-output');
    const emailRecruiterInput = document.getElementById('email-recruiter');

    if (generateEmailBtn) {
        generateEmailBtn.addEventListener('click', () => {
            // Gather Data from Form Inputs (Visual Source of Truth)
            const getVal = (name) => {
                const el = document.querySelector(`[name="${name}"]`);
                return el ? el.value.trim() : '';
            };
            const getValById = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const recruiterName = emailRecruiterInput.value.trim() || '[Recruiter Name]';

            // Personal
            const firstName = getVal('personal.firstName');
            const lastName = getVal('personal.lastName');
            const fullName = `${firstName} ${lastName}`.trim();
            const dob = getVal('personal.dob'); // YYYY-MM-DD
            const formattedDob = dob ? new Date(dob).toLocaleDateString('en-GB') : '[DD/MM/YYYY]'; // DD/MM/YYYY
            const phone = getVal('personal.phone');
            const email = getVal('personal.email');

            // Address / Loc
            const city = getVal('personal.city');
            const state = getVal('personal.state'); // using state as generic location part if needed
            const currentLocation = city ? (state ? `${city}, ${state}` : city) : getVal('personal.location');
            const preferredLocation = getVal('preferences.preferredLocation');

            // Legal
            const passportNum = getVal('legal.passportNumber');
            const passportExpiry = getVal('legal.passportExpiry');
            const formattedPassportExpiry = passportExpiry ? new Date(passportExpiry).toLocaleDateString('en-GB') : '';
            const passportDetails = passportNum ? `${passportNum} (Exp: ${formattedPassportExpiry})` : 'NA';

            // Work / Preferences
            const totalExp = getVal('preferences.experience');
            const relevantExp = getVal('preferences.relevantType');
            const currentCtc = getVal('preferences.currentCtc');
            const expectedCtc = getVal('preferences.expectedCtc');
            const noticePeriod = getVal('preferences.noticePeriod');
            const holdingOffers = getVal('preferences.holdingOffers');
            const careerGaps = getVal('preferences.careerGaps');

            const currentEmployer = getVal('work.company');
            const currentDesignation = getVal('work.title');

            // Get Previous Employer from Data Object (since it's not in the main short form)
            let previousEmployer = 'NA';
            let highestEducation = '[Degree – University Name]';

            const activeProfile = profiles.find(p => p.id === activeProfileId);
            if (activeProfile && activeProfile.data) {
                // Previous Work
                if (activeProfile.data.work && Array.isArray(activeProfile.data.work) && activeProfile.data.work.length > 1) {
                    previousEmployer = activeProfile.data.work[1].company || 'NA';
                }

                // Highest Education
                if (activeProfile.data.education && Array.isArray(activeProfile.data.education) && activeProfile.data.education.length > 0) {
                    const edu = activeProfile.data.education[0];
                    highestEducation = `${edu.degree || 'Degree'} – ${edu.school || 'University'}`;
                }
            }

            // Construct Email
            const emailBody = `Dear ${recruiterName},

Greetings!

Thank you for sharing the company profile and detailed job description. It was a pleasure speaking with you.

As discussed, please find attached my updated resume in Word format along with my relieving letter / LWD confirmation mail for your review.

Please find the requested details below:

**Position applying for:** Fullstack Developer

**Full Name (As per Govt ID):** ${fullName}
**DOB:** ${formattedDob}
**Phone:** ${phone}
**Alternative Contact:** NA
**Email:** ${email}
**Alternate Email:** NA
**Passport Number with Expiry Date:** ${passportDetails}

**Total Years of IT Experience:** ${totalExp || '[X Years]'}
**Relevant Experience:** ${relevantExp || '[X Years]'}

**Current CTC:** ${currentCtc || '[Amount]'}
**Expected CTC:** ${expectedCtc || '[Amount]'}
**Notice Period:** ${noticePeriod || '[Immediate / XX Days]'}

**Holding Any Offers:** ${holdingOffers || 'No'}

**Current Employer:** ${currentEmployer || '[Company Name]'}
**Previous Organization:** ${previousEmployer}
**Current Designation:** ${currentDesignation || '[Designation]'}
**Current Location:** ${currentLocation || '[City]'}
**Preferred Work Location:** ${preferredLocation || 'Pune'}

**Highest Education with University Name:** ${highestEducation}
**Any Career or Educational Gaps:** ${careerGaps || 'No'}

Kindly let me know if any additional information or documents are required from my end.
I look forward to the next steps in the process.

Thank you for your time and consideration.

Warm regards,
**${fullName}**
${phone}
${email}`;

            generatedEmailOutput.value = emailBody;

            // Auto-resize textarea
            generatedEmailOutput.style.height = 'auto';
            generatedEmailOutput.style.height = (generatedEmailOutput.scrollHeight) + 'px';
        });
    }

    if (copyEmailBtn) {
        copyEmailBtn.addEventListener('click', () => {
            const text = generatedEmailOutput.value;
            if (text) {
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = copyEmailBtn.textContent;
                    copyEmailBtn.textContent = '✅ Copied!';
                    copyEmailBtn.style.backgroundColor = '#059669';
                    setTimeout(() => {
                        copyEmailBtn.textContent = originalText;
                        copyEmailBtn.style.backgroundColor = '#6b7280';
                    }, 2000);
                });
            }
        });
    }
});
