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
        },

        createFloatingButton: function () {
            if (document.getElementById('speedy-apply-fab')) return;

            const btn = document.createElement('button');
            btn.id = 'speedy-apply-fab';
            btn.innerText = '⚡';
            btn.title = 'SpeedyApply: Fill Again';

            // Styles
            Object.assign(btn.style, {
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                zIndex: '999999',
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

            btn.onmouseover = () => btn.style.transform = 'scale(1.1)';
            btn.onmouseout = () => btn.style.transform = 'scale(1)';

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("SpeedyApply: Manual FAB trigger");
                this.scanAndFill(true); // Force fill

                // Visual feedback
                const originalText = btn.innerText;
                btn.innerText = '✅';
                setTimeout(() => btn.innerText = originalText, 1000);
            };

            document.body.appendChild(btn);
        },

        scanAndFill: async function (force = false) {
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
        },

        getAllInputs: function (root) {
            let inputs = [];

            // Standard inputs
            const standard = root.querySelectorAll('input:not([type="hidden"]), select, textarea');
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
