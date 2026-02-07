/**
 * COMPREHENSIVE GOOGLE FORMS DEBUG SCRIPT
 * 
 * Copy and paste this entire script into the browser console on the Google Form page
 * This will help us understand the exact structure of Google Forms fields
 */

console.log("=== COMPREHENSIVE GOOGLE FORMS DEBUG ===\n");

// 1. Find ALL possible input elements
console.log("1. SEARCHING FOR ALL INPUT ELEMENTS:");
const allInputs = document.querySelectorAll('input, textarea');
console.log(`Total inputs found: ${allInputs.length}`);

allInputs.forEach((input, i) => {
    console.log(`\n--- Input #${i + 1} ---`);
    console.log('Tag:', input.tagName);
    console.log('Type:', input.type);
    console.log('Name:', input.name);
    console.log('ID:', input.id);
    console.log('Value:', input.value);
    console.log('Placeholder:', input.placeholder);
    console.log('Class:', input.className);
    console.log('aria-label:', input.getAttribute('aria-label'));
    console.log('aria-labelledby:', input.getAttribute('aria-labelledby'));
    console.log('data-params:', input.getAttribute('data-params'));
    console.log('jsname:', input.getAttribute('jsname'));

    // Check if hidden
    const isHidden = input.type === 'hidden' ||
        input.style.display === 'none' ||
        input.style.visibility === 'hidden' ||
        input.offsetParent === null;
    console.log('Is Hidden:', isHidden);

    // Try to find label
    if (input.getAttribute('aria-labelledby')) {
        const labelId = input.getAttribute('aria-labelledby');
        const labelEl = document.getElementById(labelId);
        if (labelEl) {
            console.log('Label (from aria-labelledby):', labelEl.innerText.trim());
        }
    }

    // Check parent structure
    console.log('Parent tag:', input.parentElement?.tagName);
    console.log('Parent class:', input.parentElement?.className);
});

// 2. Look for specific question text
console.log("\n\n2. SEARCHING FOR QUESTION TEXT:");
const questionDivs = document.querySelectorAll('[role="heading"]');
console.log(`Found ${questionDivs.length} question headings`);
questionDivs.forEach((q, i) => {
    console.log(`Question ${i + 1}: "${q.innerText}"`);
});

// 3. Check what SpeedyApply is finding
console.log("\n\n3. SPEE DY APPLY DETECTION:");
if (window.SpeedyMatcher) {
    console.log("SpeedyMatcher exists!");

    allInputs.forEach((input, i) => {
        if (input.type !== 'hidden') {
            const label = window.SpeedyMatcher.getLabelText(input);
            const key = window.SpeedyMatcher.identifyField(input);
            console.log(`Input #${i + 1}: label="${label}" -> identified as: ${key || 'NO MATCH'}`);
        }
    });
} else {
    console.log("SpeedyMatcher not loaded yet!");
}

// 4. Check visible, non-hidden text inputs
console.log("\n\n4. VISIBLE TEXT INPUTS:");
const visibleInputs = Array.from(allInputs).filter(input => {
    return input.type !== 'hidden' &&
        input.type !== 'file' &&
        input.style.display !== 'none' &&
        input.offsetParent !== null;
});
console.log(`Found ${visibleInputs.length} visible inputs`);
visibleInputs.forEach((input, i) => {
    console.log(`\nVisible Input #${i + 1}:`);
    console.log('- Type:', input.type);
    console.log('- Name:', input.name);
    console.log('- Placeholder:', input.placeholder);
    console.log('- Nearby text:', input.closest('[role="listitem"]')?.innerText.substring(0, 100));
});

console.log("\n=== END DEBUG ===");
