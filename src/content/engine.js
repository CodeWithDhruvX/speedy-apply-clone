(async function () {
    console.log("🚀 SpeedyApply Engine Loaded");

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
        console.log("SpeedyApply: No active profile found. Please set up your profile.");
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

    const Engine = {
        init: function () {
            // Initial scan
            this.scanAndFill();

            // Inject Floating Action Button
            this.createFloatingButton();

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

                    console.log(`SpeedyApply: Page-specific auto-fill for ${currentDomain} ${newState ? 'Enabled' : 'Disabled'}`);
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

                console.log(`SpeedyApply: Auto-fill ${newState ? 'Enabled' : 'Disabled'}`);
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
                console.log("SpeedyApply: Manual FAB trigger");
                this.scanAndFill(true); // Force fill

                // Visual feedback
                const originalText = fillBtn.innerText;
                fillBtn.innerText = '✅';
                setTimeout(() => fillBtn.innerText = originalText, 1000);
            };

            // Append
            container.appendChild(toggleBtn);
            container.appendChild(fillBtn);
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
            try {
                // RE-FETCH PROFILE DATA to ensure we use the latest active profile
                const storage = await chrome.storage.local.get(['profile', 'profiles', 'activeProfileId', 'isAutoFillEnabled', 'pageSpecificSettings']);

                let currentProfileData = null;

                // Check if auto-fill is enabled globally
                if (!force && storage.isAutoFillEnabled !== true) {
                    console.log("SpeedyApply: Auto-fill disabled globally.");
                    return;
                }

                // Check if auto-fill is enabled for this specific page
                if (!force) {
                    const currentDomain = getDomain();
                    if (currentDomain) {
                        const pageSettings = storage.pageSpecificSettings || {};
                        const pageEnabled = pageSettings[currentDomain] === true; // Default false
                        if (!pageEnabled) {
                            console.log(`SpeedyApply: Auto-fill disabled for ${currentDomain}.`);
                            return;
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
                    console.log("SpeedyApply: No active profile found for autofill.");
                    return;
                }

                // Update the global 'profile' variable used by getValueByKey helper
                profile = currentProfileData;

            } catch (error) {
                if (error.message.includes("Extension context invalidated")) {
                    console.warn("SpeedyApply: Extension context invalidated (likely updated/reloaded). Stopping script.");
                    // Optional: Disconnect observer if we had a reference, but returning stops this loop.
                    return;
                }
                console.error("SpeedyApply: Error accessing storage", error);
                return;
            }


            const inputs = this.getAllInputs(document.body);
            let filledCount = 0;

            console.log(`SpeedyApply: Found ${inputs.length} input elements`);

            inputs.forEach((input, index) => {
                // if (input.dataset.speedyFilled) return; // Optional: Allow re-fill if data changed?

                const key = window.SpeedyMatcher.identifyField(input);
                const labelText = window.SpeedyMatcher.getLabelText(input);

                // Skip Google Forms "Other:" fields (these are for radio/checkbox "Other" options)
                if (labelText && (labelText.toLowerCase().includes('other response') || labelText.toLowerCase() === 'other')) {
                    console.log(`[${index + 1}] SKIPPED "Other" field: name="${input.name}" type="${input.type}" label="${labelText}"`);
                    return;
                }

                // Debug logging
                console.log(`[${index + 1}] Input: name="${input.name}" type="${input.type}" id="${input.id}" label="${labelText}" -> Matched: ${key || 'NO MATCH'}`);

                if (key) {
                    const value = this.getValueByKey(key);
                    if (value) {
                        console.log(`SpeedyApply: Filling ${key} with "${value}"`);

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
                        filledCount++;
                    } else {
                        console.log(`SpeedyApply: No value found for ${key}`);
                    }
                }
            });

            if (filledCount > 0) {
                this.logApplication();
            }
            console.log(`SpeedyApply: Filled ${filledCount} fields`);
        },

        logApplication: async function () {
            try {
                // Simple debounce to avoid logging same page multiple times in one session
                if (this.hasLogged) return;

                const url = window.location.href;
                // Try to guess role from title?
                const role = document.title.split('-')[0].split('|')[0].trim().substring(0, 30);

                const storage = await chrome.storage.local.get('applicationLog');
                let logs = storage.applicationLog || [];

                // Check if we logged this URL recently (last 1 hour) to avoid duplicates on refresh
                const recent = logs.find(l => l.site === url && (Date.now() - l.timestamp < 3600000));

                if (!recent) {
                    logs.push({
                        site: url,
                        role: role,
                        timestamp: Date.now()
                    });
                    await chrome.storage.local.set({ applicationLog: logs });
                    this.hasLogged = true;
                    console.log("SpeedyApply: Logged application to Dashboard");
                }
            } catch (error) {
                // Ignore context invalidated errors here too
                if (!error.message.includes("Extension context invalidated")) {
                    console.error("SpeedyApply: Error logging application", error);
                }
            }
        },

        getAllInputs: function (root) {
            let inputs = [];

            // Standard inputs + Custom Dropdowns (Workday, ARIA)
            const standard = root.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]), select, textarea, [role="combobox"], [role="button"][aria-haspopup], [data-automation-id*="dropdown"]');
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

            console.log(`getAllInputs: Found ${inputs.length} inputs after filtering`);

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

        getValueByKey: function (key) {
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

                // Handle Arrays (Education, Work) - Default to 1st item
                if (Array.isArray(section)) {
                    if (section.length > 0) {
                        return section[0][parts[1]];
                    }
                    return null;
                }

                // Handle Objects (Personal, Links)
                return section[parts[1]];
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
                existing.remove();
                console.log("SpeedyApply: Pinned popup removed");
            } else {
                // Create Container
                const container = document.createElement('div');
                container.id = 'speedy-apply-pinned-popup';
                Object.assign(container.style, {
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    width: '400px', // Matches body width (360) + padding (32) + slack
                    height: '560px', // Matches body height (520) + padding (32) + slack
                    zIndex: '2147483647', // Max z-index
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    backgroundColor: '#0f172a',
                    overflow: 'hidden'
                });

                // Create Header (Drag handle? Close button?)
                // Actually the popup itself has a Close button now when pinned.
                // But a small drag handle might be nice later. For now, just the iframe.

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
                    display: 'block'
                });

                container.appendChild(iframe);
                document.body.appendChild(container);
                console.log("SpeedyApply: Pinned popup injected");
            }
        }
    };

    // Listen for manual triggers
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "fill") {
            console.log("SpeedyApply: Manual fill triggered");
            Engine.scanAndFill(true); // Force fill
            sendResponse({ status: "done" });
        } else if (request.action === "toggle_pin_popup") {
            Engine.togglePinnedPopup(request.tabId);
            sendResponse({ status: "done" });
        }
    });

    // Run
    // Google Forms needs extra time to load fields dynamically
    const isGoogleForms = window.location.href.includes('docs.google.com/forms');
    const initialDelay = isGoogleForms ? 3000 : 1000;

    console.log(`SpeedyApply: Waiting ${initialDelay}ms for page to fully load...`);

    setTimeout(() => {
        Engine.init();

        // For Google Forms, do an additional scan after a delay
        if (isGoogleForms) {
            console.log("SpeedyApply: Google Forms detected - will retry scan after 2 seconds");
            setTimeout(() => {
                console.log("SpeedyApply: Google Forms retry scan starting...");
                Engine.scanAndFill(false);
            }, 2000);
        }
    }, initialDelay);

})();
