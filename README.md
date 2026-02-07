# SpeedyApply Open

SpeedyApply Open is a browser extension designed to help you auto-fill job applications on popular recruitment platforms like Greenhouse, Lever, Workday, and more.

## Features

-   **Profile Management**: Save your personal details, links, and work experience securely in your browser's local storage.
-   **One-Click Auto-Fill**: Automatically fill application forms with a single click.
-   **Dashboard**: Track your application history and statistics.
-   **Privacy Focused**: Your data stays on your device.

## Supported Platforms

-   Greenhouse
-   Lever
-   Workday
-   Hirist
-   IIMJobs
-   Instahyre
-   Foundit (Monster India)
-   LinkedIn & more

## Installation

Since this is a developer version (unpacked extension), follow these steps to install:

1.  **Clone or Download** this repository to your local machine.
2.  Open your browser (Chrome, Edge, Brave, etc.) and navigate to the extensions page:
    *   Chrome: `chrome://extensions`
    *   Edge: `edge://extensions`
3.  Enable **Developer mode** (usually a toggle in the top right corner).
4.  Click on **"Load unpacked"**.
5.  Select the folder where you cloned/downloaded this repository (the folder containing `manifest.json`).
6.  The extension should now appear in your browser toolbar.

## Usage Guide

### 1. Configure Your Profile

1.  Click the **SpeedyApply** icon 🚀 in your browser toolbar.
2.  Fill in your details across the three tabs:
    *   **Personal**: Name, Email, Phone, Location.
    *   **Links**: LinkedIn, GitHub, Portfolio, Twitter.
    *   **Work**: Notice Period, Current/Expected CTC, Experience, Summary.
3.  Click **Save Profile** to store your information.

### 2. Auto-Fill Applications

1.  Navigate to a job application page on a supported site (e.g., a Greenhouse job post).
2.  Click the **SpeedyApply** icon to open the popup.
3.  Click the **⚡ Auto-Fill Page** button.
4.  The extension will attempt to match fields and fill them with your saved data.
    *   *Note: Always review the filled information before submitting.*

### 3. View Dashboard

1.  Right-click the extension icon and select **Options**.
2.  Or, click "Dashboard" (if available in the popup/context menu).
3.  Here you can view your application stats and history.

## Development

-   **`src/popup`**: Code for the extension popup UI.
-   **`src/content`**: Scripts that run on job pages to inject data (`injector.js`, `matcher.js`).
-   **`src/data`**: `dictionary.js` contains the field mapping logic.
-   **`src/options`**: Code for the dashboard page.
