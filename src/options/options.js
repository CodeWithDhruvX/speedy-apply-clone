document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Navigation
    setupNavigation();

    // 2. Initialize Dashboard
    initDashboard();

    // 3. Initialize Profile
    initProfile();

    // 4. Setup Copy Feature
    setupCopyFeature();

    // 5. Setup Storage Listener for Sync
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            let shouldRender = false;

            if (changes.profiles) {
                profiles = changes.profiles.newValue || [];
                shouldRender = true;
            }

            if (changes.activeProfileId) {
                activeProfileId = changes.activeProfileId.newValue;
                shouldRender = true;
            }

            if (shouldRender) {
                renderProfileSelector();
                renderProfileForm();

                // Optional: visual feedback
                const saveBtn = document.getElementById('saveProfileBtn');
                if (saveBtn) {
                    const originalText = saveBtn.textContent;
                    saveBtn.textContent = 'Syncing...';
                    setTimeout(() => { saveBtn.textContent = originalText; }, 1000);
                }
            }
        }
    });
});

function setupNavigation() {
    const navDashboard = document.getElementById('nav-dashboard');
    const navProfile = document.getElementById('nav-profile');
    const navEmail = document.getElementById('nav-email');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewProfile = document.getElementById('view-profile');
    const viewEmail = document.getElementById('view-email-generator');

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        navDashboard.classList.add('active');
        navProfile.classList.remove('active');
        if (navEmail) navEmail.classList.remove('active');
        viewDashboard.style.display = 'block';
        viewProfile.style.display = 'none';
        if (viewEmail) viewEmail.style.display = 'none';
        initDashboard(); // Refresh stats
    });

    navProfile.addEventListener('click', (e) => {
        e.preventDefault();
        navProfile.classList.add('active');
        navDashboard.classList.remove('active');
        if (navEmail) navEmail.classList.remove('active');
        viewDashboard.style.display = 'none';
        viewProfile.style.display = 'block';
        if (viewEmail) viewEmail.style.display = 'none';
        loadProfile(); // Refresh profile data
    });

    if (navEmail) {
        navEmail.addEventListener('click', (e) => {
            e.preventDefault();
            navEmail.classList.add('active');
            navDashboard.classList.remove('active');
            navProfile.classList.remove('active');
            viewDashboard.style.display = 'none';
            viewProfile.style.display = 'none';
            if (viewEmail) viewEmail.style.display = 'block';
        });
    }
}

// --- Dashboard Logic ---
let currentPage = 1;
let itemsPerPage = 10;
let searchQuery = '';
let allLogs = [];
let selectedTimestamps = new Set(); // Track selected record timestamps

async function initDashboard() {
    // Set Date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('currentDate');
    if (dateElem) dateElem.textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Load Data
    const data = await chrome.storage.local.get(['applicationLog', 'stats']);
    allLogs = data.applicationLog || [];

    // Calculate Stats
    const today = new Date().toDateString();
    const todayLogs = allLogs.filter(log => new Date(log.timestamp).toDateString() === today);

    const todayCountElem = document.getElementById('todayCount');
    if (todayCountElem) todayCountElem.textContent = todayLogs.length;

    const totalCountElem = document.getElementById('totalCount');
    if (totalCountElem) totalCountElem.textContent = allLogs.length;

    // Setup search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = searchQuery;
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1; // Reset to first page on search
            renderTable();
        });
    }

    // Setup pagination
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const filteredLogs = getFilteredLogs();
            const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }

    // Setup page jump
    const pageJumpInput = document.getElementById('pageJumpInput');
    const pageJumpBtn = document.getElementById('pageJumpBtn');

    const handlePageJump = () => {
        const filteredLogs = getFilteredLogs();
        const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
        const targetPage = parseInt(pageJumpInput.value);

        if (targetPage && targetPage >= 1 && targetPage <= totalPages) {
            currentPage = targetPage;
            renderTable();
            pageJumpInput.value = ''; // Clear input after jump
        } else if (targetPage) {
            // Invalid page number - show feedback
            pageJumpInput.style.borderColor = '#ef4444';
            setTimeout(() => {
                pageJumpInput.style.borderColor = '';
            }, 1000);
        }
    };

    if (pageJumpBtn) {
        pageJumpBtn.addEventListener('click', handlePageJump);
    }

    if (pageJumpInput) {
        // Allow Enter key to jump
        pageJumpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handlePageJump();
            }
        });
    }

    // Setup select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const visibleCheckboxes = document.querySelectorAll('.record-checkbox');
            visibleCheckboxes.forEach(checkbox => {
                checkbox.checked = e.currentTarget.checked;
                const timestamp = checkbox.dataset.timestamp;
                if (e.currentTarget.checked) {
                    selectedTimestamps.add(timestamp);
                } else {
                    selectedTimestamps.delete(timestamp);
                }
            });
            updateBulkActions();
        });
    }

    // Setup bulk action buttons
    const openAllBtn = document.getElementById('openAllBtn');
    if (openAllBtn) {
        openAllBtn.addEventListener('click', () => {
            const selectedLogs = allLogs.filter(log => selectedTimestamps.has(String(log.timestamp)));
            selectedLogs.forEach(log => {
                chrome.tabs.create({ url: log.site });
            });
        });
    }

    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', async () => {
            if (selectedTimestamps.size === 0) return;

            const confirmMsg = `Are you sure you want to delete ${selectedTimestamps.size} selected record(s)?`;
            if (confirm(confirmMsg)) {
                const data = await chrome.storage.local.get(['applicationLog']);
                const currentLogs = data.applicationLog || [];
                const newLogs = currentLogs.filter(log => !selectedTimestamps.has(String(log.timestamp)));
                await chrome.storage.local.set({ applicationLog: newLogs });

                // Clear selection and update state
                selectedTimestamps.clear();
                allLogs = newLogs;
                renderTable();
                updateBulkActions();

                // Update stats
                const totalCountElem = document.getElementById('totalCount');
                if (totalCountElem) totalCountElem.textContent = newLogs.length;

                const today = new Date().toDateString();
                const todayLogs = newLogs.filter(log => new Date(log.timestamp).toDateString() === today);
                const todayCountElem = document.getElementById('todayCount');
                if (todayCountElem) todayCountElem.textContent = todayLogs.length;
            }
        });
    }

    // Render Table
    renderTable();
    // Render Chart (Default: Weekly)
    const chart = document.getElementById('activityChart');
    if (chart) renderChart(allLogs, chart, 'weekly');
}

function getFilteredLogs() {
    if (!searchQuery) return allLogs;

    return allLogs.filter(log => {
        const siteMatch = log.site.toLowerCase().includes(searchQuery);
        const roleMatch = (log.role || '').toLowerCase().includes(searchQuery);
        const companyMatch = (log.company || '').toLowerCase().includes(searchQuery);
        const portalMatch = (log.portal || '').toLowerCase().includes(searchQuery);
        // Fallback portal check for old records logic (domain) happens in render, but basic search 
        // on site url covers implied portal name usually.
        return siteMatch || roleMatch || companyMatch || portalMatch;
    });
}

function renderTable() {
    const tableBody = document.getElementById('activityTable');
    if (!tableBody) return;

    const filteredLogs = getFilteredLogs();
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    // Ensure current page is valid
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }

    tableBody.innerHTML = '';

    if (filteredLogs.length === 0) {
        const message = searchQuery ? 'No applications found matching your search.' : 'No applications yet. Start applying!';
        // colspan increased from 7 to 8
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">${message}</td></tr>`;
    } else {
        // Get logs for current page (reverse to show newest first)
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = filteredLogs.slice().reverse().slice(startIndex, endIndex);

        pageData.forEach(log => {
            const row = document.createElement('tr');

            // We don't need displayUrl logic anymore since we hide the text

            const isChecked = selectedTimestamps.has(String(log.timestamp));

            let companyName = log.company || '';
            let portalName = log.portal;
            let location = log.location || 'N/A'; // New Location Field

            // Fallback for Portal Name if missing (old records)
            if (!portalName) {
                try {
                    const urlObj = new URL(log.site);
                    let domain = urlObj.hostname.replace(/^www\./, '');
                    portalName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
                } catch (e) {
                    portalName = 'Unknown';
                }
            }

            row.innerHTML = `
                <td>
                    <input type="checkbox" class="row-checkbox record-checkbox" 
                           data-timestamp="${log.timestamp}" 
                           ${isChecked ? 'checked' : ''}>
                </td>
                <td><span class="portal-badge" style="background: #eef2ff; color: #4338ca; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 500;">${portalName}</span></td>
                <td><strong>${companyName}</strong></td>
                <td>${location}</td>
                <td>
                    <div class="url-cell" style="justify-content: center;">
                        <button class="open-btn" data-url="${log.site}" title="Open in New Tab">↗️</button>
                    </div>
                </td>
                <td>${log.role || 'N/A'}</td>
                <td>${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString()}</td>
                <td><span class="status-badge">Applied</span></td>
                <td>
                    <button class="delete-btn danger-btn" data-timestamp="${log.timestamp}" title="Delete Record">🗑️</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                chrome.tabs.create({ url: url });
            });
        });

        // Removed copy-btn listener as we removed the button

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const timestamp = e.currentTarget.dataset.timestamp;
                if (confirm('Are you sure you want to delete this record?')) {
                    const data = await chrome.storage.local.get(['applicationLog']);
                    const currentLogs = data.applicationLog || [];
                    const newLogs = currentLogs.filter(log => String(log.timestamp) !== timestamp);
                    await chrome.storage.local.set({ applicationLog: newLogs });
                    allLogs = newLogs;
                    renderTable();

                    // Update stats
                    const totalCountElem = document.getElementById('totalCount');
                    if (totalCountElem) totalCountElem.textContent = newLogs.length;

                    const today = new Date().toDateString();
                    const todayLogs = newLogs.filter(log => new Date(log.timestamp).toDateString() === today);
                    const todayCountElem = document.getElementById('todayCount');
                    if (todayCountElem) todayCountElem.textContent = todayLogs.length;
                }
            });
        });

        // Add checkbox listeners
        document.querySelectorAll('.record-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const timestamp = e.currentTarget.dataset.timestamp;
                if (e.currentTarget.checked) {
                    selectedTimestamps.add(timestamp);
                } else {
                    selectedTimestamps.delete(timestamp);
                }
                updateBulkActions();
                updateSelectAllCheckbox();
            });
        });
    }

    // Update select all checkbox state
    updateSelectAllCheckbox();
    // Update pagination controls
    updatePaginationControls(filteredLogs.length, totalPages);
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const visibleCheckboxes = document.querySelectorAll('.record-checkbox');

    if (!selectAllCheckbox || visibleCheckboxes.length === 0) return;

    const allChecked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(visibleCheckboxes).some(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
}

function updateBulkActions() {
    const bulkActionsDiv = document.getElementById('bulkActions');
    const selectionCountSpan = document.getElementById('selectionCount');
    const count = selectedTimestamps.size;

    if (bulkActionsDiv) {
        bulkActionsDiv.style.display = count > 0 ? 'flex' : 'none';
    }

    if (selectionCountSpan) {
        selectionCountSpan.textContent = `${count} selected`;
    }
}


function updatePaginationControls(totalItems, totalPages) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const pageJumpInput = document.getElementById('pageJumpInput');

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages || totalPages === 0;
    }

    if (pageInfo) {
        const showing = totalItems === 0 ? 0 : totalItems;
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1} (${showing} total)`;
    }

    // Update page jump input max value
    if (pageJumpInput) {
        pageJumpInput.max = totalPages || 1;
        pageJumpInput.placeholder = totalPages > 0 ? `1-${totalPages}` : '#';
    }
}

// Keep chart filter functionality
function setupChartFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const range = e.target.dataset.range;
            renderChart(allLogs, document.getElementById('activityChart'), range);
        });
    });
}

// Call setupChartFilters after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupChartFilters();
});

function renderChart(logs, chartElement, range = 'weekly') {
    chartElement.innerHTML = ''; // Clear previous
    const stats = {};
    let labels = [];
    let keys = [];

    // Helper to get local YYYY-MM-DD
    const getLocalYMD = (date) => {
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - (offset * 60 * 1000));
        return local.toISOString().split('T')[0];
    };

    if (range === 'weekly') {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = getLocalYMD(d);
            stats[key] = 0;
            keys.push(key);
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }
    } else if (range === 'monthly') {
        // Last 30 days
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = getLocalYMD(d);
            stats[key] = 0;
            keys.push(key);
            // Show label every 5 days
            labels.push(i % 5 === 0 ? d.getDate() : '');
        }
    } else if (range === 'yearly') {
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${d.getMonth()}`; // YYYY-M
            stats[key] = 0;
            keys.push(key);
            labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
        }
    }

    // Fill counts
    logs.forEach(log => {
        const d = new Date(log.timestamp);
        let key;
        if (range === 'yearly') {
            key = `${d.getFullYear()}-${d.getMonth()}`;
        } else {
            key = getLocalYMD(d);
        }

        if (stats[key] !== undefined) {
            stats[key]++;
        }
    });

    // Find max for scaling
    const counts = Object.values(stats);
    const max = Math.max(...counts, 5); // Minimum scale of 5

    // Draw bars
    keys.forEach((key, index) => {
        const count = stats[key];
        const height = (count / max) * 85; // Leave 15% space for labels/padding
        const label = labels[index];

        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar" style="height: ${height}%" title="${count} applications"></div>
            <div class="bar-label">${label}</div>
        `;
        chartElement.appendChild(col);
    });
}

// --- Profile Logic ---
let profiles = [];
let activeProfileId = null;

function initProfile() {
    const saveBtn = document.getElementById('saveProfileBtn');
    const newBtn = document.getElementById('newProfileBtn');
    const renameBtn = document.getElementById('renameProfileBtn');
    const deleteBtn = document.getElementById('deleteProfileBtn');
    const selector = document.getElementById('profileSelector');

    const duplicateBtn = document.getElementById('duplicateProfileBtn');

    saveBtn.addEventListener('click', saveCurrentProfile);
    newBtn.addEventListener('click', createNewProfile);
    renameBtn.addEventListener('click', renameCurrentProfile);
    deleteBtn.addEventListener('click', deleteCurrentProfile);
    duplicateBtn.addEventListener('click', duplicateCurrentProfile);

    // Import / Export
    document.getElementById('exportProfileBtn').addEventListener('click', exportProfile);
    document.getElementById('importProfileBtn').addEventListener('click', importProfile);
    document.getElementById('importFileInput').addEventListener('change', handleFileImport);

    // Resume Import
    document.getElementById('importResumeBtn').addEventListener('click', importResume);
    document.getElementById('importResumeInput').addEventListener('change', handleResumeImport);

    selector.addEventListener('change', (e) => switchProfile(e.target.value));

    document.getElementById('addEducationBtn').addEventListener('click', () => addEducationItem());
    document.getElementById('addWorkBtn').addEventListener('click', () => addWorkItem());

    // Inject buttons for initial static fields
    injectCopyButtons();
}

function setupCopyFeature() {
    // Global event listener for copy buttons
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-field-btn')) {
            e.preventDefault();
            const btn = e.target;
            const label = btn.parentElement;
            const formGroup = label.parentElement;

            // Find input/textarea in the same form-group
            const input = formGroup.querySelector('input, textarea, select');

            if (input) {
                const value = input.value;
                if (value) {
                    navigator.clipboard.writeText(value).then(() => {
                        const originalText = btn.textContent;
                        btn.textContent = '✅';
                        setTimeout(() => {
                            btn.textContent = originalText;
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

async function loadProfile() {
    const data = await chrome.storage.local.get(['profile', 'profiles', 'activeProfileId']);

    // 1. Migration: Single Profile -> Multiple Profiles
    if (data.profile && !data.profiles) {
        console.log("Migrating single profile to multiple...");
        const defaultProfile = {
            id: 'default-' + Date.now(),
            name: 'Default Profile',
            data: data.profile
        };
        profiles = [defaultProfile];
        activeProfileId = defaultProfile.id;

        await chrome.storage.local.set({
            profiles: profiles,
            activeProfileId: activeProfileId,
            profile: null // Clear old
        });
    } else if (data.profiles && data.profiles.length > 0) {
        profiles = data.profiles;
        activeProfileId = data.activeProfileId || profiles[0].id;
    } else {
        // No data, create initial empty profile
        const newProfile = {
            id: 'profile-' + Date.now(),
            name: 'My Profile',
            data: { personal: {}, links: {}, education: [], work: [] }
        };
        profiles = [newProfile];
        activeProfileId = newProfile.id;
        await chrome.storage.local.set({ profiles, activeProfileId });
    }

    renderProfileSelector();
    renderProfileForm();
}

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
}

function switchProfile(id) {
    activeProfileId = id;
    chrome.storage.local.set({ activeProfileId });
    renderProfileForm();
}

function renderProfileForm() {
    const currentProfile = profiles.find(p => p.id === activeProfileId);
    if (!currentProfile) return;

    const data = currentProfile.data || { personal: {}, links: {}, education: [], work: [] };

    // Ensure structure
    if (!data.personal) data.personal = {};
    if (!data.links) data.links = {};
    if (!data.education) data.education = [];
    if (!data.work) data.work = [];
    if (!data.legal) data.legal = {};
    if (!data.eeoc) data.eeoc = {};
    if (!data.preferences) data.preferences = {};
    if (!data.profile) data.profile = {};
    if (!data.documents) data.documents = {};

    // Populate Personal Info
    document.getElementById('p-firstName').value = data.personal.firstName || '';
    document.getElementById('p-lastName').value = data.personal.lastName || '';
    document.getElementById('p-email').value = data.personal.email || '';
    document.getElementById('p-phone').value = data.personal.phone || '';
    document.getElementById('p-dob').value = data.personal.dob || ''; // New
    document.getElementById('p-location').value = data.personal.location || '';

    // Populate Address
    document.getElementById('a-street').value = data.personal.street || '';
    document.getElementById('a-city').value = data.personal.city || '';
    document.getElementById('a-state').value = data.personal.state || '';
    document.getElementById('a-zip').value = data.personal.zip || '';
    document.getElementById('a-country').value = data.personal.country || '';

    // Populate Links
    document.getElementById('l-linkedin').value = data.links.linkedin || '';
    document.getElementById('l-github').value = data.links.github || '';
    document.getElementById('l-portfolio').value = data.links.portfolio || '';
    document.getElementById('l-twitter').value = data.links.twitter || '';

    // Populate Legal & Demographics
    document.getElementById('lg-authorized').value = data.legal.authorized || '';
    document.getElementById('lg-sponsorship').value = data.legal.sponsorship || '';
    document.getElementById('lg-passportNumber').value = data.legal.passportNumber || ''; // New
    document.getElementById('lg-passportExpiry').value = data.legal.passportExpiry || ''; // New
    document.getElementById('lg-panNumber').value = data.legal.panNumber || ''; // New

    document.getElementById('de-gender').value = data.eeoc.gender || '';
    document.getElementById('de-race').value = data.eeoc.race || '';
    document.getElementById('de-veteran').value = data.eeoc.veteran || '';
    document.getElementById('de-disability').value = data.eeoc.disability || '';

    // Populate Job Preferences
    document.getElementById('pref-noticePeriod').value = data.preferences.noticePeriod || '';
    document.getElementById('pref-currentCtc').value = data.preferences.currentCtc || '';
    document.getElementById('pref-expectedCtc').value = data.preferences.expectedCtc || '';
    document.getElementById('pref-experience').value = data.preferences.experience || '';
    document.getElementById('pref-relevantType').value = data.preferences.relevantType || ''; // New
    document.getElementById('pref-preferredLocation').value = data.preferences.preferredLocation || ''; // New
    document.getElementById('pref-holdingOffers').value = data.preferences.holdingOffers || ''; // New
    document.getElementById('pref-careerGaps').value = data.preferences.careerGaps || ''; // New

    // Populate Profile Extras
    document.getElementById('pr-skills').value = data.profile.skills || '';
    document.getElementById('pr-reasonForChange').value = data.profile.reasonForChange || '';
    document.getElementById('pr-summary').value = data.profile.summary || '';
    document.getElementById('doc-coverLetter').value = data.documents.coverLetter || '';

    // Populate Education
    const eduList = document.getElementById('education-list');
    eduList.innerHTML = '';
    data.education.forEach(edu => addEducationItem(edu));

    // Populate Work
    const workList = document.getElementById('work-list');
    workList.innerHTML = '';
    data.work.forEach(work => addWorkItem(work));
}

async function saveCurrentProfile() {
    const currentProfileIndex = profiles.findIndex(p => p.id === activeProfileId);
    if (currentProfileIndex === -1) return;

    // Collect Data
    const newData = {
        personal: {
            firstName: document.getElementById('p-firstName').value,
            lastName: document.getElementById('p-lastName').value,
            email: document.getElementById('p-email').value,
            phone: document.getElementById('p-phone').value,
            dob: document.getElementById('p-dob').value, // New
            location: document.getElementById('p-location').value,
            street: document.getElementById('a-street').value,
            city: document.getElementById('a-city').value,
            state: document.getElementById('a-state').value,
            zip: document.getElementById('a-zip').value,
            country: document.getElementById('a-country').value
        },
        links: {
            linkedin: document.getElementById('l-linkedin').value,
            github: document.getElementById('l-github').value,
            portfolio: document.getElementById('l-portfolio').value,
            twitter: document.getElementById('l-twitter').value
        },
        legal: {
            authorized: document.getElementById('lg-authorized').value,
            sponsorship: document.getElementById('lg-sponsorship').value,
            passportNumber: document.getElementById('lg-passportNumber').value, // New
            passportExpiry: document.getElementById('lg-passportExpiry').value, // New
            panNumber: document.getElementById('lg-panNumber').value // New
        },
        eeoc: {
            gender: document.getElementById('de-gender').value,
            race: document.getElementById('de-race').value,
            veteran: document.getElementById('de-veteran').value,
            disability: document.getElementById('de-disability').value
        },
        preferences: {
            noticePeriod: document.getElementById('pref-noticePeriod').value,
            currentCtc: document.getElementById('pref-currentCtc').value,
            expectedCtc: document.getElementById('pref-expectedCtc').value,
            experience: document.getElementById('pref-experience').value,
            relevantType: document.getElementById('pref-relevantType').value, // New
            preferredLocation: document.getElementById('pref-preferredLocation').value, // New
            holdingOffers: document.getElementById('pref-holdingOffers').value, // New
            careerGaps: document.getElementById('pref-careerGaps').value // New
        },
        profile: {
            skills: document.getElementById('pr-skills').value,
            reasonForChange: document.getElementById('pr-reasonForChange').value,
            summary: document.getElementById('pr-summary').value
        },
        documents: {
            coverLetter: document.getElementById('doc-coverLetter').value
        },
        education: [],
        work: []
    };

    document.querySelectorAll('.education-item').forEach(item => {
        newData.education.push({
            school: item.querySelector('.edu-school').value,
            degree: item.querySelector('.edu-degree').value,
            field: item.querySelector('.edu-field').value,
            grade: item.querySelector('.edu-grade').value, // Save GPA
            startDate: item.querySelector('.edu-start').value,
            endDate: item.querySelector('.edu-end').value
        });
    });

    document.querySelectorAll('.work-item').forEach(item => {
        newData.work.push({
            company: item.querySelector('.work-company').value,
            title: item.querySelector('.work-title').value,
            location: item.querySelector('.work-location').value, // Save Location
            startDate: item.querySelector('.work-start').value,
            endDate: item.querySelector('.work-end').value,
            description: item.querySelector('.work-desc').value
        });
    });

    // Update Local State
    profiles[currentProfileIndex].data = newData;

    // Save to Storage
    await chrome.storage.local.set({ profiles: profiles });

    // Feedback
    const btn = document.getElementById('saveProfileBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.backgroundColor = '#22c55e';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
}

async function duplicateCurrentProfile() {
    const current = profiles.find(p => p.id === activeProfileId);
    if (!current) return;

    const newProfile = {
        id: 'profile-' + Date.now(),
        name: "Copy of " + current.name,
        // Deep copy the data
        data: JSON.parse(JSON.stringify(current.data))
    };

    profiles.push(newProfile);
    activeProfileId = newProfile.id;

    await chrome.storage.local.set({ profiles, activeProfileId });

    renderProfileSelector();
    renderProfileForm();

    // Feedback
    const btn = document.getElementById('duplicateProfileBtn');
    const originalText = btn.textContent;
    btn.textContent = 'Duplicated!';
    btn.style.backgroundColor = '#22c55e';
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 1500);
}

async function createNewProfile() {
    const name = prompt("Enter new profile name:", "New Profile");
    if (!name) return;

    const newProfile = {
        id: 'profile-' + Date.now(),
        name: name,
        data: { personal: {}, links: {}, education: [], work: [] }
    };

    profiles.push(newProfile);
    activeProfileId = newProfile.id;

    await chrome.storage.local.set({ profiles, activeProfileId });

    renderProfileSelector();
    renderProfileForm();
}

async function renameCurrentProfile() {
    const current = profiles.find(p => p.id === activeProfileId);
    if (!current) return;

    const newName = prompt("Enter new name:", current.name);
    if (!newName || newName === current.name) return;

    current.name = newName;
    await chrome.storage.local.set({ profiles });
    renderProfileSelector();
}

async function deleteCurrentProfile() {
    if (profiles.length <= 1) {
        alert("Cannot delete the only profile.");
        return;
    }

    if (!confirm("Are you sure you want to delete this profile?")) return;

    profiles = profiles.filter(p => p.id !== activeProfileId);
    activeProfileId = profiles[0].id; // Switch to first available

    await chrome.storage.local.set({ profiles, activeProfileId });

    renderProfileSelector();
    renderProfileForm();
}

function addEducationItem(data = {}) {
    const list = document.getElementById('education-list');
    const id = Date.now();
    const item = document.createElement('div');
    item.className = 'list-item education-item';
    item.innerHTML = `
        <button class="remove-btn danger-btn">Remove</button>
        <div class="form-grid">
            <div class="form-group">
                <label>School / University <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-school" value="${data.school || ''}">
            </div>
            <div class="form-group">
                <label>Degree <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-degree" value="${data.degree || ''}">
            </div>
            <div class="form-group">
                <label>Field of Study <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-field" value="${data.field || ''}">
            </div>
            <div class="form-group">
                <label>GPA / Grade <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-grade" value="${data.grade || ''}" placeholder="e.g. 3.8/4.0">
            </div>
            <div class="form-group">
                <label>Start Date <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-start" value="${data.startDate || ''}" placeholder="YYYY-MM">
            </div>
            <div class="form-group">
                <label>End Date <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input edu-end" value="${data.endDate || ''}" placeholder="YYYY-MM or Present">
            </div>
        </div>
    `;

    item.querySelector('.remove-btn').addEventListener('click', () => {
        item.remove();
    });

    list.appendChild(item);
}

function addWorkItem(data = {}) {
    const list = document.getElementById('work-list');
    const item = document.createElement('div');
    item.className = 'list-item work-item';
    item.innerHTML = `
        <button class="remove-btn danger-btn">Remove</button>
        <div class="form-grid">
            <div class="form-group">
                <label>Company <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input work-company" value="${data.company || ''}">
            </div>
            <div class="form-group">
                <label>Job Title <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input work-title" value="${data.title || ''}">
            </div>
            <div class="form-group">
                <label>Location <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input work-location" value="${data.location || ''}" placeholder="e.g. New York, NY">
            </div>
            <div class="form-group">
                <label>Start Date <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input work-start" value="${data.startDate || ''}" placeholder="YYYY-MM">
            </div>
            <div class="form-group">
                <label>End Date <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <input type="text" class="form-input work-end" value="${data.endDate || ''}" placeholder="YYYY-MM or Present">
            </div>
            <div class="form-group full-width">
                <label>Description (Role Responsibilities) <button class="copy-field-btn" title="Copy value" type="button">📋</button></label>
                <textarea class="form-input work-desc">${data.description || ''}</textarea>
            </div>
        </div>
    `;

    item.querySelector('.remove-btn').addEventListener('click', () => {
        item.remove();
    });

    list.appendChild(item);
}

// --- Import / Export Logic ---

function exportProfile() {
    const current = profiles.find((p) => p.id === activeProfileId);
    if (!current) return;

    // Create a clean copy to export
    const exportData = {
        name: current.name,
        timestamp: new Date().toISOString(),
        version: "1.0",
        data: current.data
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');

    // Sanitize filename
    const safeName = current.name.replace(/[^a-z0-9]/gi, '_');
    const fileName = `SpeedyApply_Profile_${safeName}.json`;

    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    // Feedback
    const btn = document.getElementById('exportProfileBtn');
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = 'Exported!';
        btn.style.backgroundColor = '#22c55e';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 1500);
    }
}

function importProfile() {
    const fileInput = document.getElementById('importFileInput');
    if (fileInput) fileInput.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);

            // Basic Validation
            if (!json.data || !json.name) {
                alert("Invalid profile file format. Missing 'data' or 'name' fields.");
                return;
            }

            // Create new profile from import
            const newProfile = {
                id: 'profile-' + Date.now(),
                name: "Imported: " + json.name,
                data: json.data
            };

            profiles.push(newProfile);
            activeProfileId = newProfile.id;

            await chrome.storage.local.set({ profiles, activeProfileId });

            renderProfileSelector();
            renderProfileForm();

            // Feedback
            const btn = document.getElementById('importProfileBtn');
            if (btn) {
                const originalText = btn.textContent;
                btn.textContent = 'Imported!';
                btn.style.backgroundColor = '#22c55e';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 1500);
            }

            alert("Profile imported successfully!");

        } catch (error) {
            console.error(error);
            alert("Error parsing JSON file. Please ensure it is a valid JSON.");
        }

        // Reset input so the same file can be selected again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
}

// --- Resume Import Logic ---

function importResume() {
    const input = document.getElementById('importResumeInput');
    if (input) input.click();
}

async function handleResumeImport(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
        // Show loading feedback
        const btn = document.getElementById('importResumeBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Parsing...';
        btn.disabled = true;

        // Use ResumeParser to parse the files
        const parser = new ResumeParser();
        const parsedResults = await parser.parseFiles(files);

        if (!parsedResults || parsedResults.length === 0) {
            throw new Error('Failed to parse any resume data');
        }

        let importedCount = 0;
        let lastImportedId = null;

        for (const parsedData of parsedResults) {
            // Map parsed data to profile format
            const profileData = mapResumeToProfile(parsedData);

            // Create new profile from parsed data
            const newProfile = {
                id: 'profile-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: parsedData._resumeName || 'Resume',
                data: profileData
            };

            profiles.push(newProfile);
            lastImportedId = newProfile.id;
            importedCount++;
        }

        // Switch to the last imported profile
        if (lastImportedId) {
            activeProfileId = lastImportedId;
        }

        await chrome.storage.local.set({ profiles, activeProfileId });

        renderProfileSelector();
        renderProfileForm();

        // Success feedback
        btn.textContent = 'Imported!';
        btn.style.backgroundColor = '#22c55e';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
            btn.disabled = false;
        }, 2000);

        if (importedCount === 1) {
            const parsedData = parsedResults[0];
            alert(`Resume imported successfully!\n\nExtracted:\n- Name: ${parsedData.firstName} ${parsedData.lastName}\n- Email: ${parsedData.email}\n- Phone: ${parsedData.phone}\n- ${parsedData.education.length} education entries\n- ${parsedData.workHistory.length} work entries\n\nReview and edit as needed.`);
        } else {
            alert(`${importedCount} resumes imported successfully! Check the profile selector to view them.`);
        }

    } catch (error) {
        console.error('Resume import error:', error);
        alert(`Error importing resume: ${error.message}\n\nPlease ensure you uploaded a valid LaTeX resume file (.tex) or ZIP archive.`);

        // Reset button
        const btn = document.getElementById('importResumeBtn');
        if (btn) {
            btn.textContent = '📄 Import from Resume';
            btn.disabled = false;
            btn.style.backgroundColor = '';
        }
    }

    // Reset input
    event.target.value = '';
}

/**
 * Map parsed resume data to profile structure
 * @param {Object} resumeData - Parsed resume data
 * @returns {Object} Profile data structure
 */
function mapResumeToProfile(resumeData) {
    return {
        personal: {
            firstName: resumeData.firstName || '',
            lastName: resumeData.lastName || '',
            email: resumeData.email || '',
            phone: resumeData.phone || '',
            location: resumeData.location || '',
            street: resumeData.street || '',
            city: resumeData.city || '',
            state: resumeData.state || '',
            zip: resumeData.zip || '',
            country: resumeData.country || ''
        },
        links: {
            linkedin: resumeData.linkedin || '',
            github: resumeData.github || '',
            portfolio: resumeData.portfolio || '',
            twitter: resumeData.twitter || ''
        },
        legal: {
            authorized: '',
            sponsorship: ''
        },
        eeoc: {
            gender: '',
            race: '',
            veteran: '',
            disability: ''
        },
        preferences: {
            noticePeriod: resumeData.noticePeriod || '',
            currentCtc: resumeData.currentCtc || '',
            expectedCtc: resumeData.expectedCtc || '',
            experience: resumeData.experience || ''
        },
        profile: {
            skills: resumeData.skills || '',
            reasonForChange: '',
            summary: resumeData.summary || ''
        },
        documents: {
            coverLetter: ''
        },
        education: resumeData.education.map(edu => ({
            school: edu.institution || '',
            degree: edu.degree || '',
            field: '',
            startDate: edu.startDate || '',
            endDate: edu.endDate || ''
        })),
        work: resumeData.workHistory.map(work => ({
            company: work.company || '',
            title: work.title || '',
            location: work.location || '',
            startDate: work.startDate || '',
            endDate: work.endDate || '',
            description: work.description || ''
        }))
    };
}

// 6. Navigation Logic Update


// 7. Email Generator Logic (Options Page)
const generateEmailBtn = document.getElementById('generateEmailBtn');
const copyEmailBtn = document.getElementById('copyEmailBtn');
const generatedEmailOutput = document.getElementById('generated-email-output');
const emailRecruiterInput = document.getElementById('email-recruiter');

if (generateEmailBtn) {
    generateEmailBtn.addEventListener('click', () => {
        // Read directly from the Profile Form inputs ensuring we use the latest edited values
        // regardless of whether they are saved or not.
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const recruiterName = emailRecruiterInput.value.trim() || '[Recruiter Name]';

        // Personal
        const firstName = getVal('p-firstName');
        const lastName = getVal('p-lastName');
        const fullName = `${firstName} ${lastName}`.trim();
        const dob = getVal('p-dob');
        const formattedDob = dob ? new Date(dob).toLocaleDateString('en-GB') : '[DD/MM/YYYY]';
        const phone = getVal('p-phone');
        const email = getVal('p-email');

        // Location from Address or General
        const city = getVal('a-city');
        const state = getVal('a-state');
        const currentLocation = city ? (state ? `${city}, ${state}` : city) : getVal('p-location');
        const preferredLocation = getVal('pref-preferredLocation');

        // Legal
        const passportNum = getVal('lg-passportNumber');
        const passportExpiry = getVal('lg-passportExpiry');
        const formattedPassportExpiry = passportExpiry ? new Date(passportExpiry).toLocaleDateString('en-GB') : '';
        const passportDetails = passportNum ? `${passportNum} (Exp: ${formattedPassportExpiry})` : 'NA';
        const panNumber = getVal('lg-panNumber');

        // Preferences
        const totalExp = getVal('pref-experience');
        const relevantExp = getVal('pref-relevantType');
        const currentCtc = getVal('pref-currentCtc');
        const expectedCtc = getVal('pref-expectedCtc');
        const noticePeriod = getVal('pref-noticePeriod');
        const holdingOffers = getVal('pref-holdingOffers');
        const careerGaps = getVal('pref-careerGaps');

        // Work History (Read from DOM list items)
        let currentEmployer = '[Company Name]';
        let currentDesignation = '[Designation]';
        let previousEmployer = 'NA';

        const workItems = document.querySelectorAll('#work-list .work-item');
        if (workItems.length > 0) {
            currentEmployer = workItems[0].querySelector('.work-company').value || '[Company Name]';
            currentDesignation = workItems[0].querySelector('.work-title').value || '[Designation]';

            if (workItems.length > 1) {
                previousEmployer = workItems[1].querySelector('.work-company').value || 'NA';
            }
        }

        // Education
        let highestEducation = '[Degree – University Name]';
        const eduItems = document.querySelectorAll('#education-list .education-item');
        if (eduItems.length > 0) {
            const degree = eduItems[0].querySelector('.edu-degree').value || 'Degree';
            const school = eduItems[0].querySelector('.edu-school').value || 'University';
            highestEducation = `${degree} – ${school}`;
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
**PAN Card Number:** ${panNumber || 'NA'}

**Total Years of IT Experience:** ${totalExp || '[X Years]'}
**Relevant Experience:** ${relevantExp || '[X Years]'}

**Current CTC:** ${currentCtc || '[Amount]'}
**Expected CTC:** ${expectedCtc || '[Amount]'}
**Notice Period:** ${noticePeriod || '[Immediate / XX Days]'}

**Holding Any Offers:** ${holdingOffers || 'No'}

**Current Employer:** ${currentEmployer}
**Previous Organization:** ${previousEmployer}
**Current Designation:** ${currentDesignation}
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
                    copyEmailBtn.style.backgroundColor = '';
                }, 2000);
            });
        }
    });
}
