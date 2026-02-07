(async function () {
    console.log("🚀 SpeedyApply Engine Loaded");

    // Load User Data
    const storage = await chrome.storage.local.get('profile');
    const profile = storage.profile;

    if (!profile) {
        console.log("SpeedyApply: No profile data found. Please set up your profile.");
        return;
    }

    // Flatten profile for easier lookup: "personal.firstName" -> "John"
    // We keep the original nested 'profile' for structure access if needed,
    // and flatProfile for direct key lookup if we used that.
    // The previous code usage in scanAndFill used 'this.getValueByKey' which uses 'profile'.
    // matches: const profile = storage.profile; created at line 6.

    // We also need to fix 'window.SpeedyInjector' calls to be safe if checking existence.
    // But they should exist.

    const Engine = {
        init: function () {
            // Initial scan
            this.scanAndFill();

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

        scanAndFill: function () {
            const inputs = this.getAllInputs(document.body);
            let filledCount = 0;

            inputs.forEach(input => {
                if (input.dataset.speedyFilled) return;

                const key = window.SpeedyMatcher.identifyField(input);
                if (key) {
                    const value = this.getValueByKey(key);
                    if (value) {
                        console.log(`SpeedyApply: Filling ${key}`);
                        if (input.tagName === 'SELECT') {
                            window.SpeedyInjector.setSelectValue(input, value);
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
            // key is like "personal.firstName"
            const parts = key.split('.');
            if (parts.length === 2 && profile[parts[0]]) {
                return profile[parts[0]][parts[1]];
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
            Engine.scanAndFill();
            sendResponse({ status: "done" });
        }
    });

    // Run
    // Delay slightly to ensure page stability?
    setTimeout(() => Engine.init(), 1000);

})();
