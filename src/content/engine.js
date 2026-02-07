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

            // 1. Toggle Button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'speedy-apply-toggle';
            toggleBtn.title = 'SpeedyApply: Enable/Disable';
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
                const currentState = storage.isAutoFillEnabled !== false; // Default true
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

            // Initialize Toggle State
            const storage = await chrome.storage.local.get('isAutoFillEnabled');
            this.updateToggleUI(storage.isAutoFillEnabled !== false);
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

        scanAndFill: async function (force = false) {
            try {
                // RE-FETCH PROFILE DATA to ensure we use the latest active profile
                const storage = await chrome.storage.local.get(['profile', 'profiles', 'activeProfileId', 'isAutoFillEnabled']);

                let currentProfileData = null;

                // Check if auto-fill is enabled
                if (!force && storage.isAutoFillEnabled === false) {
                    console.log("SpeedyApply: Auto-fill disabled by user.");
                    return;
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

            inputs.forEach(input => {
                // if (input.dataset.speedyFilled) return; // Optional: Allow re-fill if data changed?

                const key = window.SpeedyMatcher.identifyField(input);
                if (key) {
                    const value = this.getValueByKey(key);
                    if (value) {
                        console.log(`SpeedyApply: Filling ${key}`);

                        if (input.tagName === 'SELECT') {
                            window.SpeedyInjector.setSelectValue(input, value);
                        } else if (input.type === 'radio') {
                            window.SpeedyInjector.setRadioValue(input, value);
                        } else if (input.type === 'checkbox') {
                            window.SpeedyInjector.setCheckboxValue(input, value);
                        } else if (input.tagName === 'DIV' || input.tagName === 'BUTTON' || input.getAttribute('role') === 'combobox') {
                            window.SpeedyInjector.setCustomDropdownValue(input, value);
                        } else {
                            window.SpeedyInjector.setValue(input, value);
                        }
                        input.dataset.speedyFilled = "true";
                        input.style.border = "2px solid #22c55e";
                        filledCount++;
                    }
                }
            });

            if (filledCount > 0) {
                this.logApplication();
            }
        },

        logApplication: async function () {
            try {
                // Simple debounce to avoid logging same page multiple times in one session
                if (this.hasLogged) return;

                const url = window.location.hostname;
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
            const standard = root.querySelectorAll('input:not([type="hidden"]), select, textarea, [role="combobox"], [role="button"][aria-haspopup], [data-automation-id*="dropdown"]');
            inputs = [...standard];

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

            // 2. Workday - Check constraints
            if (url.includes('myworkdayjobs.com')) {
                // Workday often requires triggering specific events on the *react* handler.
                // Our injector already does standard event dispatch.
            }
        }
    };

    // Listen for manual triggers
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "fill") {
            console.log("SpeedyApply: Manual fill triggered");
            Engine.scanAndFill(true); // Force fill
            sendResponse({ status: "done" });
        }
    });

    // Run
    // Delay slightly to ensure page stability?
    setTimeout(() => Engine.init(), 1000);

})();
