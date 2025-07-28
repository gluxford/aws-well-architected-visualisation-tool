// This is a special debug version of the script to help identify the issue

// Function to display workload data with extra debugging
function displayWorkloadData(data) {
    console.log("Displaying workload data:", JSON.stringify(data, null, 2));
    
    // Log the HTML elements we're trying to update
    console.log("HTML elements:");
    console.log("workload-name element:", document.getElementById('workload-name'));
    console.log("reviewer-name element:", document.getElementById('reviewer-name'));
    console.log("account-id element:", document.getElementById('account-id'));
    
    // Display workload information with extra checks
    try {
        // Workload name
        const workloadNameEl = document.getElementById('workload-name');
        if (workloadNameEl) {
            workloadNameEl.textContent = data.workloadName || 'N/A';
            console.log("Set workload name to:", data.workloadName);
        } else {
            console.error("Could not find workload-name element");
        }
        
        // Report date
        const reportDateEl = document.getElementById('report-date');
        if (reportDateEl) {
            reportDateEl.textContent = new Date().toLocaleDateString();
        }
        
        // Reviewer name - this is where the issue might be
        const reviewerNameEl = document.getElementById('reviewer-name');
        if (reviewerNameEl) {
            reviewerNameEl.textContent = data.owner || 'N/A';
            console.log("Set reviewer name to:", data.owner);
        } else {
            console.error("Could not find reviewer-name element");
        }
        
        // AWS Account ID
        const accountIdEl = document.getElementById('account-id');
        if (accountIdEl) {
            accountIdEl.textContent = data.accountIds && data.accountIds.length > 0 ? data.accountIds.join(', ') : 'N/A';
            console.log("Set account ID to:", data.accountIds);
        } else {
            console.error("Could not find account-id element");
        }
        
        // Region
        const regionEl = document.getElementById('region-display');
        if (regionEl) {
            regionEl.textContent = data.regions && data.regions.length > 0 ? data.regions.join(', ') : 'N/A';
        }
        
        // Industry
        const industryEl = document.getElementById('industry');
        if (industryEl) {
            industryEl.textContent = data.industry || 'N/A';
        }
    } catch (error) {
        console.error("Error updating display:", error);
    }
    
    // Rest of the function remains the same...
}
