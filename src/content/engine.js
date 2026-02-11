(async function () {


    // Load User Data
    const storage = await chrome.storage.local.get(['profile', 'profiles', 'activeProfileId']);
    let profile = null;

    if (storage.profiles && storage.activeProfileId) {
        const active = storage.profiles.find(p => p.id === storage.activeProfileId);
        if (active) profile = active.data;
    } else if (storage.profile) {
        // Fallback for old data or immediate migration
        profile = storage.profile;
    }

    if (!profile) {

        return;
    }

    // Flatten profile for easier lookup: "personal.firstName" -> "John"
    // matches: const profile = ... created above.

    // We also need to fix 'window.SpeedyInjector' calls to be safe if checking existence.
    // But they should exist.

    // Helper: Extract domain from URL
    function getDomain() {
        try {
            const hostname = window.location.hostname;
            // Remove 'www.' prefix if present
            return hostname.replace(/^www\./, '');
        } catch (e) {
            console.error('SpeedyApply: Error extracting domain', e);
            return null;
        }
    }

    // --- AI Helper (Ollama via Background) ---
    async function generateAIResponse(prompt) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'OLLAMA_REQUEST',
                prompt: prompt,
                model: profile.ollamaModel // Will be passed if we add it to profile object or fetch separately
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("SpeedyApply AI Error (Runtime):", chrome.runtime.lastError);
                    resolve(null);
                    return;
                }

                if (response && response.success) {
                    console.log("SpeedyApply AI: Ollama response received successfully.");
                    resolve(response.data);
                } else {
                    console.error("SpeedyApply AI Error (Ollama):", response ? response.error : 'Unknown error');
                    resolve(null);
                }
            });
        });
    }

    const Engine = {
        init: function () {
            // Initial scan
            this.scanAndFill();

            // Inject Floating Action Button
            this.createFloatingButton();

            // Setup Interaction Tracking (Manual Clicks)
            this.setupInteractionTracking();

            // Observer for dynamic content (Single Page Apps)
            const observer = new MutationObserver((mutations) => {
                // Debounce simple scan
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.scanAndFill();
                    this.handleSpecifics();
                }, 500);
            });

            observer.observe(document.body, { childList: true, subtree: true });
            // Storage Change Listener for syncing specific settings
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes.isAutoFillEnabled) {
                    this.updateToggleUI(changes.isAutoFillEnabled.newValue);
                }
                if (namespace === 'local' && changes.pageSpecificSettings) {
                    const domain = getDomain();
                    if (domain) {
                        const newSettings = changes.pageSpecificSettings.newValue || {};
                        this.updatePageToggleUI(newSettings[domain] !== false);
                    }
                }
            });
        },

        setupInteractionTracking: function () {
            document.body.addEventListener('click', (e) => {
                // Find closest button or link if user clicked on icon/span inside
                const target = e.target.closest('button, input[type="submit"], a, [role="button"]');

                if (!target) return;

                const text = (target.innerText || target.value || target.getAttribute('aria-label') || '').toLowerCase();
                const trackingKeywords = ['apply', 'submit', 'send application', 'save & continue', 'next', 'review'];

                // Check if text matches any keyword
                const isSubmitButton = trackingKeywords.some(keyword => text.includes(keyword));

                if (isSubmitButton) {

                    this.logApplication();
                }
            }, true); // Use capture to ensure we catch it before some frameworks might stop propagation
        },

        createFloatingButton: async function () {
            if (document.getElementById('speedy-apply-container')) return;

            // Container
            const container = document.createElement('div');
            container.id = 'speedy-apply-container';
            Object.assign(container.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: '999999',
                display: 'flex',
                flexDirection: 'column', // Stack vertically
                gap: '10px',
                alignItems: 'center'
            });

            // --- Draggable Handle ---
            const dragHandle = document.createElement('div');
            dragHandle.id = 'speedy-apply-drag-handle';
            // Use a grip icon (unicode)
            dragHandle.innerText = '⠿';
            dragHandle.title = 'Drag to move';
            Object.assign(dragHandle.style, {
                fontSize: '20px',
                color: '#9ca3af', // gray-400
                cursor: 'grab',
                userSelect: 'none',
                lineHeight: '1',
                marginBottom: '5px',
                textAlign: 'center',
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
            });

            // Add Drag Logic
            let isDragging = false;
            let dragStartX, dragStartY;
            let initialDragLeft, initialDragTop;

            const onDragStart = (e) => {
                e.preventDefault(); // Prevent text selection
                isDragging = true;
                dragHandle.style.cursor = 'grabbing';

                const rect = container.getBoundingClientRect();

                // Switch to fixed top/left if not already
                // This ensures smooth dragging from any position
                container.style.bottom = 'auto';
                container.style.right = 'auto';
                container.style.left = rect.left + 'px';
                container.style.top = rect.top + 'px';

                dragStartX = e.clientX;
                dragStartY = e.clientY;
                initialDragLeft = rect.left;
                initialDragTop = rect.top;

                document.addEventListener('mousemove', onDragMove);
                document.addEventListener('mouseup', onDragEnd);
            };

            const onDragMove = (e) => {
                if (!isDragging) return;

                const dx = e.clientX - dragStartX;
                const dy = e.clientY - dragStartY;

                // updates position
                container.style.left = (initialDragLeft + dx) + 'px';
                container.style.top = (initialDragTop + dy) + 'px';
            };

            const onDragEnd = () => {
                isDragging = false;
                dragHandle.style.cursor = 'grab';
                document.removeEventListener('mousemove', onDragMove);
                document.removeEventListener('mouseup', onDragEnd);
            };

            dragHandle.addEventListener('mousedown', onDragStart);
            container.appendChild(dragHandle);

            // Get current domain for page-specific toggle
            const currentDomain = getDomain();
            const initialStorage = await chrome.storage.local.get(['isAutoFillEnabled', 'pageSpecificSettings']);
            const pageSettings = initialStorage.pageSpecificSettings || {};

            // 0. Page-Specific Toggle Button
            if (currentDomain) {
                const pageToggleBtn = document.createElement('button');
                pageToggleBtn.id = 'speedy-apply-page-toggle';

                // Format domain name for display (capitalize first letter)
                const domainDisplay = currentDomain.split('.')[0].charAt(0).toUpperCase() +
                    currentDomain.split('.')[0].slice(1);

                pageToggleBtn.title = `Enable/Disable auto-fill for ${currentDomain}`;
                Object.assign(pageToggleBtn.style, {
                    minWidth: '120px',
                    height: '32px',
                    borderRadius: '16px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    marginBottom: '8px',
                    padding: '0 12px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                });

                pageToggleBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Get current page-specific state
                    const currentStorage = await chrome.storage.local.get('pageSpecificSettings');
                    const currentPageSettings = currentStorage.pageSpecificSettings || {};
                    const currentState = currentPageSettings[currentDomain] === true; // Default false
                    const newState = !currentState;

                    // Update page-specific settings
                    currentPageSettings[currentDomain] = newState;
                    await chrome.storage.local.set({ pageSpecificSettings: currentPageSettings });

                    // UI update
                    this.updatePageToggleUI(newState);


                };

                container.appendChild(pageToggleBtn);
            }

            // 1. Global Toggle Button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'speedy-apply-toggle';
            toggleBtn.title = 'SpeedyApply: Global Enable/Disable';
            Object.assign(toggleBtn.style, {
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                marginBottom: '5px'
            });

            toggleBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Get current state
                const storage = await chrome.storage.local.get('isAutoFillEnabled');
                const currentState = storage.isAutoFillEnabled === true; // Default false
                const newState = !currentState;

                // Save
                await chrome.storage.local.set({ isAutoFillEnabled: newState });

                // UI update specific to this button is handled by storage listener or immediacy
                this.updateToggleUI(newState);


            };

            // 2. Fill Button (The main FAB)
            const fillBtn = document.createElement('button');
            fillBtn.id = 'speedy-apply-fab';
            fillBtn.innerText = '⚡';
            fillBtn.title = 'SpeedyApply: Fill Again';
            Object.assign(fillBtn.style, {
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s'
            });

            fillBtn.onmouseover = () => fillBtn.style.transform = 'scale(1.1)';
            fillBtn.onmouseout = () => fillBtn.style.transform = 'scale(1)';

            fillBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.scanAndFill(true); // Force fill

                // Visual feedback
                const originalText = fillBtn.innerText;
                fillBtn.innerText = '✅';
                setTimeout(() => fillBtn.innerText = originalText, 1000);
            };

            // Append
            container.appendChild(toggleBtn);
            container.appendChild(fillBtn);

            // 3. Screenshot Button
            const screenshotBtn = document.createElement('button');
            screenshotBtn.id = 'speedy-apply-screenshot-btn';
            screenshotBtn.innerText = '📷';
            screenshotBtn.title = 'SpeedyApply: Full Page Screenshot';
            Object.assign(screenshotBtn.style, {
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: '1px solid #d1d5db',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                marginTop: '5px' // Add some spacing
            });

            screenshotBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.captureFullPage(screenshotBtn);
            };

            container.appendChild(screenshotBtn);
            document.body.appendChild(container);

            // Initialize Toggle States
            this.updateToggleUI(initialStorage.isAutoFillEnabled === true);
            if (currentDomain) {
                this.updatePageToggleUI(pageSettings[currentDomain] === true);
            }
        },

        updateToggleUI: function (isEnabled) {
            const btn = document.getElementById('speedy-apply-toggle');
            if (!btn) return;

            if (isEnabled) {
                btn.innerText = '✅';
                btn.style.backgroundColor = '#dcfce7'; // green-100
                btn.style.color = '#166534'; // green-800
                btn.title = "SpeedyApply is Enabled";
            } else {
                btn.innerText = '🚫';
                btn.style.backgroundColor = '#fee2e2'; // red-100
                btn.style.color = '#991b1b'; // red-800
                btn.title = "SpeedyApply is Disabled";
            }
        },

        updatePageToggleUI: function (isEnabled) {
            const btn = document.getElementById('speedy-apply-page-toggle');
            if (!btn) return;

            const currentDomain = getDomain();
            if (!currentDomain) return;

            // Format domain name for display
            const domainDisplay = currentDomain.split('.')[0].charAt(0).toUpperCase() +
                currentDomain.split('.')[0].slice(1);

            if (isEnabled) {
                btn.innerText = `${domainDisplay}: ✅`;
                btn.style.backgroundColor = '#dcfce7'; // green-100
                btn.style.color = '#166534'; // green-800
                btn.title = `Auto-fill enabled for ${currentDomain}`;
            } else {
                btn.innerText = `${domainDisplay}: 🚫`;
                btn.style.backgroundColor = '#fee2e2'; // red-100
                btn.style.color = '#991b1b'; // red-800
                btn.title = `Auto-fill disabled for ${currentDomain}`;
            }
        },

        scanAndFill: async function (force = false) {
            let shouldFill = true; // Default to true, disable if settings say so
            let useAI = false;
            let ollamaModel = 'qwen2.5-coder:3b';
            try {
                // RE-FETCH PROFILE DATA to ensure we use the latest active profile
                const storage = await chrome.storage.local.get(['profile', 'profiles', 'activeProfileId', 'isAutoFillEnabled', 'pageSpecificSettings', 'useOllama', 'ollamaModel']);

                useAI = storage.useOllama === true;
                if (storage.ollamaModel) ollamaModel = storage.ollamaModel;

                shouldFill = storage.isAutoFillEnabled !== false;

                if (useAI) {
                    console.log(`SpeedyApply: Local AI (Ollama) is ENABLED. Model: ${ollamaModel}`);
                    // Trigger a background check to see if Ollama is actually reachable right now
                    chrome.runtime.sendMessage({ action: 'CHECK_OLLAMA_STATUS' }, (res) => {
                        if (res && res.success) console.log("SpeedyApply: Ollama connection CONFIRMED ✅");
                        else console.warn("SpeedyApply: Ollama connection FAILED ❌. Is it running?");
                    });
                }

                let currentProfileData = null;

                // Check if auto-fill is enabled globally
                if (!force && storage.isAutoFillEnabled !== true) {

                    shouldFill = false;
                }

                // Check if auto-fill is enabled for this specific page
                if (!force && shouldFill) {
                    const currentDomain = getDomain();
                    if (currentDomain) {
                        const pageSettings = storage.pageSpecificSettings || {};
                        const pageEnabled = pageSettings[currentDomain] === true; // Default false
                        if (!pageEnabled) {

                            shouldFill = false;
                        }
                    }
                }

                if (storage.profiles && storage.activeProfileId) {
                    const active = storage.profiles.find(p => p.id === storage.activeProfileId);
                    if (active) currentProfileData = active.data;
                } else if (storage.profile) {
                    currentProfileData = storage.profile;
                }

                if (!currentProfileData) {
                    console.log("SpeedyApply: No Active Profile found. Auto-fill disabled.");
                    shouldFill = false;
                } else {
                    // Update the global 'profile' variable used by getValueByKey helper
                    profile = currentProfileData;
                    // console.log("SpeedyApply: Profile loaded.", profile.personal?.firstName);
                }

            } catch (error) {
                if (error.message.includes("Extension context invalidated")) {
                    console.warn("SpeedyApply: Extension context invalidated during scan.");
                    return;
                }
                console.error("SpeedyApply: Error during scan setup", error);
                return;
            }


            const inputs = this.getAllInputs(document.body);
            console.log(`SpeedyApply: Scanned ${inputs.length} inputs on this page/frame.`);

            let filledCount = 0;
            let potentialMatches = 0;



            // --- Array Handling Logic ---
            // Track occurrences of array-based keys to fill 1st, 2nd, 3rd items correctly
            const keyCounts = {};

            inputs.forEach((input, index) => {
                // if (input.dataset.speedyFilled) return; // Optional: Allow re-fill if data changed?

                const key = window.SpeedyMatcher.identifyField(input);
                const labelText = window.SpeedyMatcher.getLabelText(input);

                if (inputs.length < 20) { // Only log details if not too spammy
                    console.log(`SpeedyApply Input [${index}]: Label="${labelText}", Key="${key}", Tag=${input.tagName}, Type=${input.type}`);
                }

                // Skip Google Forms "Other:" fields (these are for radio/checkbox "Other" options)
                if (labelText && (labelText.toLowerCase().includes('other response') || labelText.toLowerCase() === 'other')) {
                    return;
                }

                if (key) {
                    potentialMatches++;

                    if (!shouldFill) return; // Skip actual filling if disabled

                    // Update count for this key
                    if (!keyCounts[key]) keyCounts[key] = 0;
                    const currentIndex = keyCounts[key];
                    keyCounts[key]++;

                    const value = this.getValueByKey(key, currentIndex);
                    if (value) {
                        console.log(`SpeedyApply: Regex Matched & Filling ${key} [index ${currentIndex}]`);
                        this.fillInput(input, value, key);
                        filledCount++;
                    } else {
                        console.log(`SpeedyApply: Regex Matched ${key} but NO VALUE in profile.`);
                    }
                } else if (useAI && shouldFill && !input.value && !input.dataset.speedyFilled) {
                    // Fallback to AI if no regex match and AI is enabled
                    // Support Text, Textarea, Select, and Radio
                    const isValidAIField =
                        (input.type === 'text' || input.tagName === 'TEXTAREA' || input.tagName === 'SELECT') ||
                        (input.type === 'radio' && !input.checked); // Only if not already checked

                    if (isValidAIField) {
                        // For radio, only trigger once per group? 
                        // Logic: if radio is unchecked, we try to fill it. 
                        // But we should check if ANY in the group is checked? 
                        // For now, let attemptAIFill handle it or simplified check:
                        let groupResolved = false;
                        if (input.type === 'radio' && input.name) {
                            const group = document.querySelectorAll(`input[name="${input.name}"]:checked`);
                            if (group.length > 0) groupResolved = true;
                        }

                        if (!groupResolved) {
                            // console.log("SpeedyApply: Falling back to AI for", input);
                            this.attemptAIFill(input);
                        }
                    }
                } else if (useAI && !input.value) {
                    // Debug log to see why it didn't trigger
                    // console.log("SpeedyApply Debug: Skipped AI. AI_Enabled:", useAI, "ShouldFill:", shouldFill, "HasValue:", !!input.value, "Dataset:", input.dataset.speedyFilled);
                }
            });

            // Log if we filled OR if we found matches (implies it's a job application page)
            if (filledCount > 0 || potentialMatches > 0) {
                this.logApplication();
            }

        },


        logApplication: async function () {
            try {
                // Simple debounce to avoid logging same page multiple times in one session
                if (this.hasLogged) return;

                const url = window.location.href;
                // Try to guess role from title?
                let role = document.title.split('-')[0].split('|')[0].trim().substring(0, 50);
                if (!role) role = 'N/A';

                // Helper: Clean string
                const cleanStr = (str) => str ? str.trim().replace(/\s+/g, ' ') : '';

                // Helper: Get Domain / Portal Name
                const getPortalName = () => {
                    const domain = getDomain();
                    if (!domain) return 'Unknown';
                    const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                    return name;
                };

                const portal = getPortalName();

                // Known Portals to ignore if found as "Company"
                const KNOWN_PORTALS = [
                    'Naukri', 'LinkedIn', 'Indeed', 'Glassdoor', 'Monster',
                    'Foundit', 'Instahyre', 'Hirist', 'Workday', 'Greenhouse',
                    'Lever', 'Wellfound', 'AngelList', 'App.join'
                ];

                // --- Extract Company & Location ---
                let company = '';
                let location = '';

                // 0. Naukri Specific "About company" (Highest Priority)
                if (url.includes('naukri.com')) {
                    // Strategy 1: Look for "About company" header and get following siblings
                    const headers = Array.from(document.querySelectorAll('h6, h2, h3, h4, div'));
                    const aboutHeader = headers.find(h => h.innerText && h.innerText.toLowerCase().includes('about company'));

                    if (aboutHeader) {
                        // In Naukri, the company name is often in a div/p immediately following
                        // We must skip scripts/styles and ensure we don't grab JSON
                        let next = aboutHeader.nextElementSibling;
                        let attempts = 0;
                        while (next && attempts < 3) {
                            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META'].includes(next.tagName)) {
                                next = next.nextElementSibling;
                                attempts++;
                                continue;
                            }

                            // Check contents
                            if (next.innerText) {
                                const detail = next.querySelector('.detail');
                                let textVal = '';
                                if (detail) {
                                    textVal = cleanStr(detail.innerText);
                                } else {
                                    textVal = cleanStr(next.innerText);
                                }

                                // Validation: Don't accept JSON or very long text
                                if (textVal && !textVal.startsWith('{') && !textVal.startsWith('[') && textVal.length < 100) {
                                    if (textVal.length > 50) company = textVal.split('.')[0];
                                    else company = textVal;
                                    break; // Found it
                                }
                            }
                            next = next.nextElementSibling;
                            attempts++;
                        }
                    }

                    if (!company) {
                        const naukriSel = document.querySelector('.job-desc-company-info .company-name, .salary-delivery .company-name, a.level-1');
                        if (naukriSel) company = cleanStr(naukriSel.innerText);
                    }

                    // Naukri Location
                    // Try multiple common selectors for Naukri
                    const locSelectors = [
                        '.loc',
                        '.location',
                        '.job-loc',
                        '[itemprop="jobLocation"]',
                        '.left-sec .loc',
                        '.meta-info .loc',
                        '.job-meta .loc'
                    ];

                    for (const sel of locSelectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            location = cleanStr(el.innerText);
                            if (location) break;
                        }
                    }

                    // Naukri Role (if document.title failed)
                    if (role === 'N/A' || !role || role.includes('SpeedyApply')) {
                        const roleSel = document.querySelector('h1.job-title, h1.jd-header-title');
                        if (roleSel) role = cleanStr(roleSel.innerText);
                    }
                }

                // 1. JSON-LD (High Priority)
                if (!company || !location) {
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const script of scripts) {
                        try {
                            const data = JSON.parse(script.innerText);
                            const items = Array.isArray(data) ? data : [data];

                            for (const item of items) {
                                if (item['@type'] === 'JobPosting') {
                                    // Company
                                    if (!company && item.hiringOrganization && item.hiringOrganization.name) {
                                        const extracted = cleanStr(item.hiringOrganization.name);
                                        if (extracted && extracted.toLowerCase() !== 'confidential') {
                                            if (!extracted.toLowerCase().includes(portal.toLowerCase())) {
                                                company = extracted;
                                            }
                                        }
                                    }
                                    // Location
                                    if (!location && item.jobLocation) {
                                        if (item.jobLocation.address) {
                                            const addr = item.jobLocation.address;
                                            const parts = [];
                                            if (addr.addressLocality) parts.push(addr.addressLocality);
                                            if (addr.addressRegion) parts.push(addr.addressRegion);
                                            if (addr.addressCountry) parts.push(addr.addressCountry);
                                            location = parts.join(', ');
                                        }
                                    }
                                }
                            }
                            if (company && location) break;
                        } catch (e) { /* ignore */ }
                    }
                }

                // 2. Platform-Specific Selectors (Company)
                if (!company) {
                    const selectors = [
                        '.job-desc-company-info .company-name',
                        '.salary-delivery .company-name',
                        '.job-details-jobs-unified-top-card__company-name',
                        '.jobs-unified-top-card__company-name',
                        '[data-company-name="true"]',
                        '.jobsearch-CompanyAvatar-companyLink',
                        '[data-test="employer-name"]',
                        '[data-test-id="company-name"]',
                        '.company-name'
                    ];

                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            company = cleanStr(el.innerText);
                            if (company) break;
                        }
                    }
                }

                // 3. Platform-Specific Selectors (Location)
                if (!location) {
                    const locSelectors = [
                        '.job-details-jobs-unified-top-card__workplace-type', // LinkedIn
                        '.jobs-unified-top-card__workplace-type',
                        '[data-test="job-location"]',
                        '[data-test-id="location"]',
                        '.job-location',
                        '.location'
                    ];

                    for (const sel of locSelectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            location = cleanStr(el.innerText);
                            if (location) break;
                        }
                    }
                }


                // 4. Title Parsing
                if (!company) {
                    const title = document.title;
                    const atMatch = title.match(/\s+at\s+([^|\-]+)/i);
                    const pipeMatch = title.match(/\s+\|\s+([^|\-]+)/);
                    const hyphenMatch = title.match(/\s+-\s+([^|\-]+)/);

                    if (atMatch && atMatch[1]) company = cleanStr(atMatch[1]);
                    else if (pipeMatch && pipeMatch[1]) company = cleanStr(pipeMatch[1]);
                    else if (hyphenMatch && hyphenMatch[1]) company = cleanStr(hyphenMatch[1]);
                }

                // 5. Fallback: Meta Tags
                if (!company) {
                    const siteNameMeta = document.querySelector('meta[property="og:site_name"]');
                    if (siteNameMeta) {
                        const val = cleanStr(siteNameMeta.content);
                        if (!KNOWN_PORTALS.some(p => val.toLowerCase().includes(p.toLowerCase()))) {
                            company = val;
                        }
                    }
                }

                // Final Cleanup
                if (company && KNOWN_PORTALS.some(p => company.toLowerCase().includes(p.toLowerCase()))) {
                    company = '';
                }


                const storage = await chrome.storage.local.get('applicationLog');
                let logs = storage.applicationLog || [];

                // Check if we logged this URL recently (last 1 hour) to avoid duplicates on refresh
                const recent = logs.find(l => l.site === url && (Date.now() - l.timestamp < 3600000));

                if (!recent) {
                    logs.push({
                        site: url,
                        role: role,
                        company: company || '',
                        location: location || '',
                        portal: portal,
                        timestamp: Date.now()
                    });
                    await chrome.storage.local.set({ applicationLog: logs });
                    this.hasLogged = true;

                }
            } catch (error) {
                // Ignore context invalidated errors here too
                if (!error.message.includes("Extension context invalidated")) {

                }
            }
        },

        getAllInputs: function (root) {
            let inputs = [];

            // Standard inputs + Custom Dropdowns (Workday, ARIA) + Rich Text Editors
            const standard = root.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), select, textarea, [role="combobox"], [role="button"][aria-haspopup], [data-automation-id*="dropdown"], [role="textbox"]');
            inputs = [...standard];

            // Google Forms specific: Look for inputs in specific containers
            if (window.location.href.includes('docs.google.com/forms')) {
                const googleFormsInputs = root.querySelectorAll('[role="listitem"] input, [role="listitem"] textarea, .freebirdFormviewerComponentsQuestionTextRoot input, .freebirdFormviewerComponentsQuestionTextRoot textarea');
                googleFormsInputs.forEach(input => {
                    if (!inputs.includes(input) && input.type !== 'hidden' && input.type !== 'file') {
                        inputs.push(input);
                    }
                });
            }

            // Filter out hidden/invisible inputs
            inputs = inputs.filter(input => {
                const style = window.getComputedStyle(input);
                const isVisible = style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0' &&
                    input.offsetParent !== null;
                return isVisible || input.type === 'email' || input.type === 'tel' || input.type === 'text';
            });



            // Shadow DOM traversal
            // Walk through all elements to find shadow roots
            const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            let node = treeWalker.nextNode();
            while (node) {
                if (node.shadowRoot) {
                    inputs = inputs.concat(this.getAllInputs(node.shadowRoot));
                }
                node = treeWalker.nextNode();
            }

            return inputs;
        },

        fillInput: function (input, value, key) {
            if (input.tagName === 'SELECT') {
                window.SpeedyInjector.setSelectValue(input, value, key);
            } else if (input.type === 'radio') {
                window.SpeedyInjector.setRadioValue(input, value, key);
            } else if (input.type === 'checkbox') {
                window.SpeedyInjector.setCheckboxValue(input, value, key);
            } else if (input.tagName === 'DIV' || input.tagName === 'BUTTON' || input.getAttribute('role') === 'combobox') {
                window.SpeedyInjector.setCustomDropdownValue(input, value, key);
            } else {
                window.SpeedyInjector.setValue(input, value, key);
            }
            input.dataset.speedyFilled = "true";
            input.style.border = "2px solid #22c55e";
        },

        captureFullPage: async function (btn) {
            const originalText = btn.innerText;
            btn.innerText = '⏳'; // Loading state

            // 1. Prepare for scroll
            const originalScrollPos = window.scrollY;
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden'; // Hide scrollbars during capture

            const fullHeight = document.documentElement.scrollHeight;
            const viewportHeight = window.innerHeight;
            const totalScrolls = Math.ceil(fullHeight / viewportHeight);

            const canvas = document.createElement('canvas');
            canvas.width = window.innerWidth;
            canvas.height = fullHeight;
            const ctx = canvas.getContext('2d');

            try {
                // 2. Scroll and Capture Loop
                for (let i = 0; i < totalScrolls; i++) {
                    const scrollY = i * viewportHeight;
                    window.scrollTo(0, scrollY);

                    // Wait for render/scroll settle
                    await new Promise(r => setTimeout(r, 250));

                    // Capture visible tab via Background
                    const dataUrl = await new Promise((resolve) => {
                        chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (response) => {
                            if (response && response.success) resolve(response.dataUrl);
                            else resolve(null);
                        });
                    });

                    if (dataUrl) {
                        const img = new Image();
                        img.src = dataUrl;
                        await new Promise(r => img.onload = r);

                        // Draw to canvas at correct offset
                        // Note: capturing visible tab captures the viewport. 
                        // We need to account for the last scroll which might overlap
                        let drawHeight = viewportHeight;
                        if (i === totalScrolls - 1) {
                            // Last scroll
                            // Logic: The last screenshot might have some overlap if we just scrolled to bottom
                            // But simplified: stick rest at bottom.
                        }

                        ctx.drawImage(img, 0, 0, window.innerWidth, viewportHeight, 0, scrollY, window.innerWidth, viewportHeight);
                    }
                }

                // 3. Convert Canvas to Blob and Copy
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        console.error("SpeedyApply: Failed to create blob from canvas");
                        btn.innerText = '❌';
                        return;
                    }
                    try {
                        const item = new ClipboardItem({ "image/png": blob });
                        await navigator.clipboard.write([item]);
                        console.log("SpeedyApply: Screenshot copied to clipboard!");
                        btn.innerText = '✅';
                    } catch (err) {
                        console.error("SpeedyApply: Clipboard write failed", err);
                        btn.innerText = '❌';
                    }
                }, 'image/png');

            } catch (e) {
                console.error("SpeedyApply: Screenshot failed", e);
                btn.innerText = '❌';
            } finally {
                // 4. Cleanup
                window.scrollTo(0, originalScrollPos);
                document.body.style.overflow = originalOverflow;
                setTimeout(() => btn.innerText = originalText, 2000);
            }
        },

        attemptAIFill: async function (input) {
            if (input.dataset.aiPending) return;
            input.dataset.aiPending = "true";

            const label = window.SpeedyMatcher.getLabelText(input);
            if (!label || label.length < 3) {
                delete input.dataset.aiPending;
                return;
            }

            // --- Context Extraction ---
            const getSectionContext = (el) => {
                let current = el.parentElement;
                let depth = 0;
                while (current && depth < 5) {
                    const header = current.querySelector('h1, h2, h3, h4, h5, h6, legend, label.section-label');
                    if (header) return header.innerText.trim();
                    current = current.parentElement;
                    depth++;
                }
                return "";
            };

            const sectionContext = getSectionContext(input);

            const context = {
                profile: profile,
                pageTitle: document.title,
                domain: getDomain(),
                company: '',
                section: sectionContext
            };

            // Try to extract company name (Simplified logic from logApplication)
            try {
                const atMatch = document.title.match(/\s+at\s+([^|\-]+)/i);
                if (atMatch && atMatch[1]) context.company = atMatch[1].trim();
            } catch (e) { }


            // --- Field Type Analysis ---
            let fieldType = 'text';
            let optionsList = [];

            if (input.tagName === 'TEXTAREA') {
                fieldType = 'long_text';
            } else if (input.tagName === 'SELECT') {
                fieldType = 'dropdown';
                optionsList = Array.from(input.options).map(o => o.text.trim()).filter(t => t);
            } else if (input.type === 'radio') {
                fieldType = 'radio';
                // Find all radio buttons with the same name
                const name = input.name;
                if (name) {
                    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
                    radios.forEach(r => {
                        const lbl = window.SpeedyMatcher.getLabelText(r);
                        if (lbl) optionsList.push(lbl);
                    });
                }
            } else if (input.type === 'checkbox') {
                fieldType = 'checkbox';
                // Same name check for group checkboxes
                const name = input.name;
                if (name) {
                    const checkboxes = document.querySelectorAll(`input[type="checkbox"][name="${name}"]`);
                    if (checkboxes.length > 1) {
                        checkboxes.forEach(c => {
                            const lbl = window.SpeedyMatcher.getLabelText(c);
                            if (lbl) optionsList.push(lbl);
                        });
                    } else {
                        // Single boolean checkbox
                        optionsList = ['Yes', 'No']; // implied
                    }
                }
            }


            // --- Prompt Construction ---
            let systemPrompt = `You are a helpful job application assistant. You are filling out a form for a user.
User Profile: ${JSON.stringify(profile)}
Page Title: "${context.pageTitle}"
Company: "${context.company}"
Section: "${context.section}"
`;

            let userPrompt = `Field Label: "${label}"\n`;

            if (fieldType === 'dropdown' || fieldType === 'radio') {
                userPrompt += `Type: Selection (Choose one)\n`;
                userPrompt += `Available Options: ${JSON.stringify(optionsList)}\n`;
                userPrompt += `Task: Choose the BEST option from the list that matches the user profile. Return ONLY the exact text of the option. If none matches exactly, pick the most logical one or "Other". Do NOT add any explanation.`;
            } else if (fieldType === 'checkbox') {
                userPrompt += `Type: Selection (Multiple allowed)\n`;
                userPrompt += `Available Options: ${JSON.stringify(optionsList)}\n`;
                userPrompt += `Task: Choose the applicable options from the list. Return the exact text of the options separated by a comma (e.g. "Option A, Option B"). If none apply, return "No".`;
            } else if (fieldType === 'long_text') {
                userPrompt += `Type: Long Text / Essay\n`;
                userPrompt += `Task: Write a professional response for this field based on the user profile. Keep it relevant and concise unless asked for a cover letter. Return ONLY the text to be filled.`;
            } else {
                // Heuristic for Numeric/Experience fields
                const lowerLabel = label.toLowerCase();
                if (lowerLabel.includes('experience') || lowerLabel.includes('years') || lowerLabel.includes('ctc') || lowerLabel.includes('salary') || input.type === 'number') {
                    userPrompt += `Type: Numeric (Decimal)\n`;
                    userPrompt += `Constraint: You must return ONLY a decimal number (e.g., 5.0, 10.5, 0.0). Do NOT include text like "years", "lpa", "$", etc.\n`;
                    userPrompt += `Task: Extract the numeric value for this field from the profile. If the user has no experience or the value is missing, return "0.0".`;
                } else if (input.type === 'date') {
                    userPrompt += `Type: Date\n`;
                    userPrompt += `Constraint: Return in YYYY-MM-DD format.\n`;
                    userPrompt += `Task: Provide the date based on the profile.\n`;
                } else {
                    userPrompt += `Type: Short Text\n`;
                    userPrompt += `Task: Provide the best value for this field. Return ONLY the value. No explanations.`;
                }
            }

            console.log(`SpeedyApply: AI Prompt for "${label}" (${fieldType})`, userPrompt);

            const response = await generateAIResponse(systemPrompt + "\n\n" + userPrompt);

            if (response) {
                let cleaned = response.trim();

                // Clean-up: Remove Markdown code blocks if present
                cleaned = cleaned.replace(/^```(json|text)?\n/, '').replace(/\n```$/, '');
                // Remove surrounding quotes if present and not part of the content (heuristic)
                if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
                    cleaned = cleaned.slice(1, -1);
                }


                if (cleaned) {
                    console.log(`SpeedyApply AI: Filled "${label}" with "${cleaned}"`);

                    if (fieldType === 'dropdown' || fieldType === 'radio') {
                        // Try to find the exact option match or fuzzy match
                        const bestMatch = optionsList.find(opt => opt.toLowerCase() === cleaned.toLowerCase()) ||
                            optionsList.find(opt => opt.toLowerCase().includes(cleaned.toLowerCase()));

                        if (bestMatch) {
                            cleaned = bestMatch;
                            this.fillInput(input, cleaned, 'AI_GENERATED');
                            input.style.border = "2px solid #a855f7"; // Purple for AI
                        } else {
                            console.warn("SpeedyApply AI: Could not match option for", label, cleaned);
                            // Optional: Fill anyway if it's a combobox or we trust the input?
                            // For strict dropdowns, failing to match means we can't select it easily relying on current injectors.
                        }
                    } else if (fieldType === 'checkbox') {
                        const choices = cleaned.split(',').map(s => s.trim());
                        // For each choice, try to find a matching checkbox in the group and click it?
                        // fillInput logic for checkbox expects a value.
                        // If it's a standard single checkbox setup (boolean):
                        if (optionsList.includes('Yes') && optionsList.includes('No') && optionsList.length === 2) {
                            // Single checkbox logic, often "I agree" etc.
                            if (cleaned.toLowerCase().includes('yes') || cleaned.toLowerCase().includes('agree')) {
                                this.fillInput(input, true, 'AI_GENERATED');
                                input.style.border = "2px solid #a855f7";
                            }
                        } else {
                            // Multiple checkboxes
                            // We need to find the specific inputs to check.
                            // This is tricky because `fillInput` takes `input`.
                            // We might need to iterate over the group here if we want to support multi-select AI.
                            // For now, let's just log implementation gap or try to fill the current one if it matches.
                            choices.forEach(choice => {
                                if (window.SpeedyMatcher.getLabelText(input).toLowerCase().includes(choice.toLowerCase())) {
                                    this.fillInput(input, true, 'AI_GENERATED');
                                    input.style.border = "2px solid #a855f7";
                                }
                            });
                        }
                    } else {
                        this.fillInput(input, cleaned, 'AI_GENERATED');
                        input.style.border = "2px solid #a855f7"; // Purple for AI
                    }

                }
            } else {
                console.log(`SpeedyApply AI: Failed to generate response for "${label}"`);
            }

            delete input.dataset.aiPending;
        },

        getValueByKey: function (key, index = 0) {
            // key is like "personal.firstName" or "education.school"

            // Special handling for Full Name (combine first + last)
            if (key === 'personal.fullName') {
                if (profile.personal) {
                    const { firstName, lastName } = profile.personal;
                    if (firstName && lastName) return `${firstName} ${lastName}`;
                    if (firstName) return firstName;
                    if (lastName) return lastName;
                }
                return null;
            }

            // Special handling for Generic Location if not explicitly set
            if (key === 'personal.location') {
                const val = profile.personal && profile.personal.location;
                if (val) return val;

                // Fallback: Construct it
                if (profile.personal) {
                    const { city, state, country } = profile.personal;
                    if (city && state) return `${city}, ${state}`;
                    if (city && country) return `${city}, ${country}`;
                    if (city) return city;
                }
            }

            const parts = key.split('.');
            if (parts.length === 2 && profile[parts[0]]) {
                const section = profile[parts[0]];
                const fieldName = parts[1];

                // Handle Arrays (Education, Work)
                if (Array.isArray(section)) {
                    // Logic: We rely on the order of fields found in the DOM.
                    // If we find 'work.company' for the 1st time, index=0. 2nd time, index=1.

                    if (index < section.length) {
                        const item = section[index];

                        // New Fields Logic
                        if (fieldName === 'grade') {
                            return item.grade || item.gpa || item.score || null;
                        }

                        if (fieldName === 'startDate') {
                            // Helper: format YYYY-MM to Month Year
                            return item.startDate || null;
                        }

                        if (fieldName === 'endDate') {
                            return item.endDate || null;
                        }

                        return item[fieldName];
                    }
                    return null;
                }

                // Handle Objects (Personal, Links)
                return section[fieldName];
            }
            return null;
        },

        handleSpecifics: function () {
            const url = window.location.href;

            // 1. LinkedIn Easy Apply "Next" Button
            if (url.includes('linkedin.com')) {
                // Determine if we are in a modal
                const modal = document.querySelector('.jobs-easy-apply-modal');
                if (modal) {
                    // Find "Next" button and listen? 
                    // Actually, just re-scanning on mutation is enough, which is already set up.
                }
            }

            if (url.includes('myworkdayjobs.com')) {
                // Workday often requires triggering specific events on the *react* handler.
                // Our injector already does standard event dispatch.
            }
        },

        togglePinnedPopup: function (tabId) {
            const existing = document.getElementById('speedy-apply-pinned-popup');
            if (existing) {
                // Remove message listener if we added one (though named function is better for removal, 
                // here we just remove DOM, listener persists but checks for element)
                window.removeEventListener('message', this.boundDragListener);
                existing.remove();

            } else {
                // Create Container
                const container = document.createElement('div');
                container.id = 'speedy-apply-pinned-popup';
                Object.assign(container.style, {
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    width: '360px',
                    height: '520px',
                    zIndex: '2147483647', // Max z-index
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    backgroundColor: '#0f172a',
                    display: 'flex',
                    flexDirection: 'column'
                });

                // Load Iframe
                const iframe = document.createElement('iframe');
                let src = chrome.runtime.getURL('src/popup/index.html?pinned=true');
                if (tabId) {
                    src += `&tabId=${tabId}`;
                }
                iframe.src = src;
                iframe.allow = "clipboard-write";
                Object.assign(iframe.style, {
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    flex: '1',
                    pointerEvents: 'auto' // ensure interaction
                });
                container.appendChild(iframe);

                // --- Resizing Logic (8 Handles) ---
                const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
                const handleStyles = {
                    position: 'absolute',
                    zIndex: '2147483648', // Above iframe
                    backgroundColor: 'transparent' // Invisible but clickable
                };
                const thickness = '6px';

                handles.forEach(dir => {
                    const el = document.createElement('div');
                    el.className = `resize-handle-${dir}`;
                    Object.assign(el.style, handleStyles);
                    el.style.cursor = `${dir}-resize`;

                    // Position
                    if (dir.includes('n')) { el.style.top = `-${(parseInt(thickness) / 2)}px`; el.style.height = thickness; el.style.left = '0'; el.style.width = '100%'; }
                    if (dir.includes('s')) { el.style.bottom = `-${(parseInt(thickness) / 2)}px`; el.style.height = thickness; el.style.left = '0'; el.style.width = '100%'; }
                    if (dir.includes('e')) { el.style.right = `-${(parseInt(thickness) / 2)}px`; el.style.width = thickness; el.style.top = '0'; el.style.height = '100%'; }
                    if (dir.includes('w')) { el.style.left = `-${(parseInt(thickness) / 2)}px`; el.style.width = thickness; el.style.top = '0'; el.style.height = '100%'; }

                    // Corners (overwrite width/height/pos)
                    if (dir === 'ne') { el.style.top = `-${(parseInt(thickness) / 2)}px`; el.style.right = `-${(parseInt(thickness) / 2)}px`; el.style.width = '12px'; el.style.height = '12px'; el.style.cursor = 'ne-resize'; }
                    if (dir === 'nw') { el.style.top = `-${(parseInt(thickness) / 2)}px`; el.style.left = `-${(parseInt(thickness) / 2)}px`; el.style.width = '12px'; el.style.height = '12px'; el.style.cursor = 'nw-resize'; }
                    if (dir === 'se') { el.style.bottom = `-${(parseInt(thickness) / 2)}px`; el.style.right = `-${(parseInt(thickness) / 2)}px`; el.style.width = '12px'; el.style.height = '12px'; el.style.cursor = 'se-resize'; }
                    if (dir === 'sw') { el.style.bottom = `-${(parseInt(thickness) / 2)}px`; el.style.left = `-${(parseInt(thickness) / 2)}px`; el.style.width = '12px'; el.style.height = '12px'; el.style.cursor = 'sw-resize'; }

                    container.appendChild(el);

                    // Resize Event
                    el.addEventListener('mousedown', (e) => initResize(e, dir));
                });

                // Resize Implementation
                const initResize = (e, dir) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const rect = container.getBoundingClientRect();
                    const startWidth = rect.width;
                    const startHeight = rect.height;
                    const startTop = rect.top;
                    const startLeft = rect.left;

                    // Cover iframe with overlay to prevent mouse capture loss
                    const overlay = document.createElement('div');
                    Object.assign(overlay.style, {
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                        zIndex: '2147483650', cursor: `${dir}-resize`
                    });
                    document.body.appendChild(overlay);

                    const onMouseMove = (ev) => {
                        const dx = ev.clientX - startX;
                        const dy = ev.clientY - startY;

                        let newWidth = startWidth;
                        let newHeight = startHeight;
                        let newTop = startTop;
                        let newLeft = startLeft;

                        if (dir.includes('e')) newWidth = startWidth + dx;
                        if (dir.includes('w')) { newWidth = startWidth - dx; newLeft = startLeft + dx; }
                        if (dir.includes('s')) newHeight = startHeight + dy;
                        if (dir.includes('n')) { newHeight = startHeight - dy; newTop = startTop + dy; }

                        // Constraint Min Size
                        if (newWidth < 300) {
                            if (dir.includes('w')) newLeft = startLeft + (startWidth - 300);
                            newWidth = 300;
                        }
                        if (newHeight < 200) {
                            if (dir.includes('n')) newTop = startTop + (startHeight - 200);
                            newHeight = 200;
                        }

                        Object.assign(container.style, {
                            width: `${newWidth}px`,
                            height: `${newHeight}px`,
                            top: `${newTop}px`,
                            left: `${newLeft}px`
                        });
                    };

                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        overlay.remove();
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                };

                // --- Dragging Logic (via PostMessage from Header) ---
                this.boundDragListener = (event) => {
                    if (event.data && event.data.type === 'SPEEDY_DRAG_START') {
                        // event.data also likely needs offset info? 
                        // Actually, we can just use current mouse position relative to container top-left.
                        // But since the mouse event happened inside iframe, coordinates are tricky.
                        // STRATEGY: 
                        // 1. Popup sends "start" on mousedown.
                        // 2. We assume mouse is effectively "grabbing" the header.
                        // 3. We use the *global* mouse position (we can track it loosely or just start tracking from the current global mouse position if we had it).
                        // BETTER: The popup event passed screenX/screenY? 
                        // No, simplest is: iframe Mousedown -> Message -> Engine puts Overlay -> Engine MouseMove moves container.

                        const startX = event.data.screenX; // Use screen coords to sync across
                        const startY = event.data.screenY;

                        // We assume the user clicked *somewhere* in the header.
                        // We'll calculate the initial offset based on current container position.
                        // NOTE: We don't have the *exact* clientX/Y of the mouse inside the main page yet.
                        // But wait, 'mousemove' on document will give us current mouse position instantly?
                        // Let's rely on the first mousemove to establish delta if needed, 
                        // OR better: The iframe event payload can include clientX/Y relative to screen, 
                        // and we compare changes.

                        const rect = container.getBoundingClientRect();
                        const initialLeft = rect.left;
                        const initialTop = rect.top;

                        // Overlay to capture events outside iframe
                        const overlay = document.createElement('div');
                        Object.assign(overlay.style, {
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                            zIndex: '2147483650', cursor: 'grabbing'
                        });
                        document.body.appendChild(overlay);

                        // Used to calculate delta
                        let lastScreenX = startX;
                        let lastScreenY = startY;

                        const onDragMove = (ev) => {
                            const curScreenX = ev.screenX; // use screen coordinates for consistency across frames
                            const curScreenY = ev.screenY;

                            const dx = curScreenX - lastScreenX;
                            const dy = curScreenY - lastScreenY;

                            const currentRect = container.getBoundingClientRect();
                            container.style.left = `${currentRect.left + dx}px`;
                            container.style.top = `${currentRect.top + dy}px`;

                            lastScreenX = curScreenX;
                            lastScreenY = curScreenY;
                        };

                        const onDragMoveLocal = (ev) => {
                            // Fallback if screenX is not trusted or consistent in some envs
                            // just normal drag logic
                        };

                        const onDragUp = () => {
                            document.removeEventListener('mousemove', onDragMove);
                            document.removeEventListener('mouseup', onDragUp);
                            overlay.remove();
                            // Notify iframe to reset cursor if needed
                            iframe.contentWindow.postMessage({ type: 'SPEEDY_DRAG_END' }, '*');
                        };

                        document.addEventListener('mousemove', onDragMove);
                        document.addEventListener('mouseup', onDragUp);
                    }
                };

                window.addEventListener('message', this.boundDragListener);

                document.body.appendChild(container);

            }
        },

        minimizePinnedPopup: function () {
            const container = document.getElementById('speedy-apply-pinned-popup');
            if (container) {
                container.style.display = 'none';
                this.showRestoreButton();
            }
        },

        restorePinnedPopup: function () {
            const container = document.getElementById('speedy-apply-pinned-popup');
            if (container) {
                container.style.display = 'flex';
                this.removeRestoreButton();
            }
        },

        showRestoreButton: function () {
            if (document.getElementById('speedy-apply-restore-btn')) return;

            const container = document.getElementById('speedy-apply-container');
            if (!container) return; // Should exist

            const restoreBtn = document.createElement('button');
            restoreBtn.id = 'speedy-apply-restore-btn';
            restoreBtn.innerText = '🖥️'; // Monitor/Display icon
            restoreBtn.title = 'Restore Pinned Window';
            Object.assign(restoreBtn.style, {
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#8b5cf6', // Violet
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s',
                marginTop: '5px' // Space from other buttons
            });

            restoreBtn.onmouseover = () => restoreBtn.style.transform = 'scale(1.1)';
            restoreBtn.onmouseout = () => restoreBtn.style.transform = 'scale(1)';

            restoreBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.restorePinnedPopup();
            };

            container.insertBefore(restoreBtn, container.lastElementChild);
        },

        removeRestoreButton: function () {
            const btn = document.getElementById('speedy-apply-restore-btn');
            if (btn) btn.remove();
        }
    };

    // Listen for manual triggers
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "fill") {

            Engine.scanAndFill(true); // Force fill
            sendResponse({ status: "done" });
        } else if (request.action === "toggle_pin_popup") {
            Engine.togglePinnedPopup(request.tabId);
            sendResponse({ status: "done" });
        } else if (request.action === "minimize_popup") {
            Engine.minimizePinnedPopup();
            sendResponse({ status: "done" });
        } else if (request.action === "restore_popup") {
            Engine.restorePinnedPopup();
            sendResponse({ status: "done" });
        }
    });

    // Run
    // Google Forms needs extra time to load fields dynamically
    const isGoogleForms = window.location.href.includes('docs.google.com/forms');
    const initialDelay = isGoogleForms ? 3000 : 1000;



    setTimeout(() => {
        Engine.init();

        // For Google Forms, do an additional scan after a delay
        if (isGoogleForms) {

            setTimeout(() => {

                Engine.scanAndFill(false);
            }, 2000);
        }
    }, initialDelay);

})();
