document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Navigation
    setupNavigation();

    // 2. Initialize Dashboard
    initDashboard();

    // 3. Initialize Profile
    initProfile();
});

function setupNavigation() {
    const navDashboard = document.getElementById('nav-dashboard');
    const navProfile = document.getElementById('nav-profile');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewProfile = document.getElementById('view-profile');

    navDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        navDashboard.classList.add('active');
        navProfile.classList.remove('active');
        viewDashboard.style.display = 'block';
        viewProfile.style.display = 'none';
        initDashboard(); // Refresh stats
    });

    navProfile.addEventListener('click', (e) => {
        e.preventDefault();
        navProfile.classList.add('active');
        navDashboard.classList.remove('active');
        viewDashboard.style.display = 'none';
        viewProfile.style.display = 'block';
        loadProfile(); // Refresh profile data
    });
}

// --- Dashboard Logic ---
async function initDashboard() {
    // Set Date
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElem = document.getElementById('currentDate');
    if (dateElem) dateElem.textContent = new Date().toLocaleDateString('en-US', dateOptions);

    // Load Data
    const data = await chrome.storage.local.get(['applicationLog', 'stats']);
    const logs = data.applicationLog || [];

    // Calculate Stats
    const today = new Date().toDateString();
    const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === today);

    const todayCountElem = document.getElementById('todayCount');
    if (todayCountElem) todayCountElem.textContent = todayLogs.length;

    const totalCountElem = document.getElementById('totalCount');
    if (totalCountElem) totalCountElem.textContent = logs.length;

    // Render Table
    const tableBody = document.getElementById('activityTable');
    if (tableBody) {
        tableBody.innerHTML = '';
        if (logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">No applications yet. Start applying!</td></tr>';
        } else {
            // Show last 10
            logs.slice().reverse().slice(0, 10).forEach(log => {
                const row = document.createElement('tr');
                let displayUrl = log.site;
                try {
                    // Try to make it shorter but keep protocol: "https://domain.com/path..."
                    const urlObj = new URL(log.site);
                    const path = urlObj.pathname.length > 20 ? urlObj.pathname.substring(0, 20) + '...' : urlObj.pathname;
                    displayUrl = urlObj.origin + path;
                } catch (e) {
                    // Fallback
                    if (displayUrl.length > 40) displayUrl = displayUrl.substring(0, 40) + '...';
                }

                row.innerHTML = `
                    <td>
                        <div class="url-cell">
                            <span title="${log.site}">${displayUrl}</span>
                            <button class="copy-btn" data-url="${log.site}" title="Copy URL">📋</button>
                        </div>
                    </td>
                    <td>${log.role || 'N/A'}</td>
                    <td>${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td><span class="status-badge">Applied</span></td>
                `;
                tableBody.appendChild(row);
            });

            // Add copy listeners
            document.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = e.target.dataset.url;
                    navigator.clipboard.writeText(url).then(() => {
                        const original = e.target.textContent;
                        e.target.textContent = '✅';
                        setTimeout(() => e.target.textContent = original, 1000);
                    });
                });
            });
        }
    }

    // Setup Filter Listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Render chart
            const range = e.target.dataset.range;
            renderChart(logs, document.getElementById('activityChart'), range);
        });
    });

    // Render Chart (Default: Weekly)
    const chart = document.getElementById('activityChart');
    if (chart) renderChart(logs, chart, 'weekly');
}

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

    selector.addEventListener('change', (e) => switchProfile(e.target.value));

    document.getElementById('addEducationBtn').addEventListener('click', () => addEducationItem());
    document.getElementById('addWorkBtn').addEventListener('click', () => addWorkItem());
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
    document.getElementById('de-gender').value = data.eeoc.gender || '';
    document.getElementById('de-race').value = data.eeoc.race || '';
    document.getElementById('de-veteran').value = data.eeoc.veteran || '';
    document.getElementById('de-disability').value = data.eeoc.disability || '';

    // Populate Job Preferences
    document.getElementById('pref-noticePeriod').value = data.preferences.noticePeriod || '';
    document.getElementById('pref-currentCtc').value = data.preferences.currentCtc || '';
    document.getElementById('pref-expectedCtc').value = data.preferences.expectedCtc || '';
    document.getElementById('pref-experience').value = data.preferences.experience || '';

    // Populate Profile Extras
    document.getElementById('pr-skills').value = data.profile.skills || '';
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
            location: document.getElementById('p-location').value,
            // New Address Fields
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
            sponsorship: document.getElementById('lg-sponsorship').value
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
            experience: document.getElementById('pref-experience').value
        },
        profile: {
            skills: document.getElementById('pr-skills').value,
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
            startDate: item.querySelector('.edu-start').value,
            endDate: item.querySelector('.edu-end').value
        });
    });

    document.querySelectorAll('.work-item').forEach(item => {
        newData.work.push({
            company: item.querySelector('.work-company').value,
            title: item.querySelector('.work-title').value,
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
                <label>School / University</label>
                <input type="text" class="form-input edu-school" value="${data.school || ''}">
            </div>
            <div class="form-group">
                <label>Degree</label>
                <input type="text" class="form-input edu-degree" value="${data.degree || ''}">
            </div>
            <div class="form-group">
                <label>Field of Study</label>
                <input type="text" class="form-input edu-field" value="${data.field || ''}">
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="month" class="form-input edu-start" value="${data.startDate || ''}">
            </div>
            <div class="form-group">
                <label>End Date</label>
                <input type="month" class="form-input edu-end" value="${data.endDate || ''}">
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
                <label>Company</label>
                <input type="text" class="form-input work-company" value="${data.company || ''}">
            </div>
            <div class="form-group">
                <label>Job Title</label>
                <input type="text" class="form-input work-title" value="${data.title || ''}">
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="month" class="form-input work-start" value="${data.startDate || ''}">
            </div>
            <div class="form-group">
                <label>End Date</label>
                <input type="month" class="form-input work-end" value="${data.endDate || ''}">
            </div>
            <div class="form-group full-width">
                <label>Description (Role Responsibilities)</label>
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
