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
                row.innerHTML = `
                    <td>${log.site || 'Unknown Site'}</td>
                    <td>${log.role || 'N/A'}</td>
                    <td>${new Date(log.timestamp).toLocaleDateString()} ${new Date(log.timestamp).toLocaleTimeString()}</td>
                    <td><span class="status-badge">Applied</span></td>
                `;
                tableBody.appendChild(row);
            });
        }
    }

    // Render Chart (Last 7 Days)
    const chart = document.getElementById('activityChart');
    if (chart) renderChart(logs, chart);
}

function renderChart(logs, chartElement) {
    chartElement.innerHTML = ''; // Clear previous
    const days = 7;
    const stats = {};

    // Initialize last 7 days
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        stats[d.toDateString()] = 0;
    }

    // Fill counts
    logs.forEach(log => {
        const d = new Date(log.timestamp).toDateString();
        if (stats[d] !== undefined) {
            stats[d]++;
        }
    });

    // Find max for scaling
    const counts = Object.values(stats);
    const max = Math.max(...counts, 5); // Minimum scale of 5

    // Draw bars
    Object.keys(stats).forEach(dateStr => {
        const count = stats[dateStr];
        const height = (count / max) * 100;
        const dateObj = new Date(dateStr);
        const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
            <div class="bar" style="height: ${height}%" title="${count} applications"></div>
            <div class="bar-label">${dayLabel}</div>
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

    saveBtn.addEventListener('click', saveCurrentProfile);
    newBtn.addEventListener('click', createNewProfile);
    renameBtn.addEventListener('click', renameCurrentProfile);
    deleteBtn.addEventListener('click', deleteCurrentProfile);
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
