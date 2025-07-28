// API endpoint for the Lambda proxy
const API_ENDPOINT = 'https://9jcjq591ni.execute-api.ap-southeast-2.amazonaws.com/prod/proxy';

// DOM elements
const workloadArnInput = document.getElementById('workload-arn');
const fetchBtn = document.getElementById('fetch-btn');
const listWorkloadsBtn = document.getElementById('list-workloads-btn');
const workloadsList = document.getElementById('workloads-list');
const workloadsListItems = document.getElementById('workloads-list-items');
const loadingIndicator = document.getElementById('loading');
const reportContent = document.getElementById('report-content');

// Chart objects
let riskChart = null;
let pillarChart = null;

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Set current date in footer
    document.getElementById('generation-date').textContent = new Date().toLocaleDateString();
    
    // Add event listeners
    fetchBtn.addEventListener('click', fetchWorkload);
    listWorkloadsBtn.addEventListener('click', listWorkloads);
    
    // Export chart buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chartId = btn.getAttribute('data-chart');
            const canvas = document.getElementById(chartId);
            const link = document.createElement('a');
            link.download = `${chartId}-${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    });
    
    // Export risk summary button
    const exportRiskSummaryBtn = document.getElementById('export-risk-summary-btn');
    if (exportRiskSummaryBtn) {
        exportRiskSummaryBtn.addEventListener('click', exportRiskSummary);
    }
});

// Function to show loading indicator
function showLoading() {
    loadingIndicator.classList.remove('hidden');
    reportContent.classList.add('hidden');
    workloadsList.classList.add('hidden');
}

// Function to hide loading indicator
function hideLoading() {
    loadingIndicator.classList.add('hidden');
}

// Function to make API calls to the Lambda proxy
async function callApi(operation, params = {}) {
    try {
        console.log(`Calling API operation: ${operation}`, params);
        
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                operation: operation,
                params: params
            })
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries([...response.headers]));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API error (${response.status}): ${errorText}`);
            throw new Error(`API returned status ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`API response for ${operation}:`, data);
        return data;
    } catch (error) {
        console.error(`Failed to execute ${operation}:`, error);
        throw new Error(`Failed to execute ${operation}: ${error.message}`);
    }
}

// Function to list available workloads
async function listWorkloads() {
    try {
        showLoading();
        
        const data = await callApi('list_workloads');
        
        // Clear previous list
        workloadsListItems.innerHTML = '';
        
        // Add workloads to the list
        if (data.WorkloadSummaries && data.WorkloadSummaries.length > 0) {
            data.WorkloadSummaries.forEach(workload => {
                const li = document.createElement('li');
                li.className = 'list-group-item';
                li.innerHTML = `
                    <strong>${workload.WorkloadName}</strong>
                    <br>
                    <small>${workload.WorkloadArn}</small>
                    <br>
                    <small>Updated: ${new Date(workload.UpdatedAt).toLocaleString()}</small>
                `;
                li.addEventListener('click', () => {
                    workloadArnInput.value = workload.WorkloadArn;
                    workloadsList.classList.add('hidden');
                    fetchWorkload();
                });
                workloadsListItems.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = 'No workloads found';
            workloadsListItems.appendChild(li);
        }
        
        // Show the workloads list
        workloadsList.classList.remove('hidden');
        hideLoading();
    } catch (error) {
        hideLoading();
        alert(`Error listing workloads: ${error.message}`);
    }
}

// Function to fetch workload data
async function fetchWorkload() {
    try {
        const workloadArn = workloadArnInput.value.trim();
        if (!workloadArn) {
            alert('Please enter a workload ARN or ID');
            return;
        }
        
        showLoading();
        
        // Extract workload ID from ARN if needed
        let workloadId = workloadArn;
        if (workloadArn.includes('/')) {
            workloadId = workloadArn.split('/').pop();
        }
        
        console.log("Fetching workload with ID:", workloadId);
        
        // Get workload details
        const workloadData = await callApi('get_workload', {
            WorkloadId: workloadId
        });
        
        console.log("Raw workload data from API:", JSON.stringify(workloadData, null, 2));
        
        // Get lens reviews
        const lensReviews = await callApi('list_lens_reviews', {
            WorkloadId: workloadId
        });
        
        // Get lens review details for the wellarchitected lens
        const lensReview = await callApi('get_lens_review', {
            WorkloadId: workloadId,
            LensAlias: 'wellarchitected'
        });
        
        // Process the data to calculate compliance scores
        const processedData = processRawWorkloadData(workloadData, lensReview);
        
        // Get recommendations for high and medium risk items
        await fetchRecommendations(workloadId, processedData);
        
        // Display the processed data
        displayWorkloadData(processedData);
        
        hideLoading();
        reportContent.classList.remove('hidden');
    } catch (error) {
        hideLoading();
        alert(`Error fetching workload: ${error.message}`);
    }
}

// Function to process raw workload data
function processRawWorkloadData(workloadData, lensReview) {
    console.log("Raw workload data:", JSON.stringify(workloadData, null, 2));
    
    // Extract the reviewer name - this is typically the email address of the person who created the workload
    let ownerName = 'N/A';
    if (workloadData.Workload && workloadData.Workload.Owner) {
        ownerName = workloadData.Workload.Owner;
    }
    
    // Extract account IDs
    let accountIds = [];
    if (workloadData.Workload && workloadData.Workload.AccountIds) {
        accountIds = workloadData.Workload.AccountIds;
    }
    
    // Initialize processed data structure
    const processedData = {
        workloadName: workloadData.Workload.WorkloadName || 'N/A',
        workloadDescription: workloadData.Workload.Description || 'N/A',
        ownerName: ownerName,
        accountIds: accountIds,
        regions: workloadData.Workload.AwsRegions || [],
        industry: workloadData.Workload.Industry || 'N/A',
        pillars: [],
        riskCounts: {
            high: 0,
            medium: 0,
            compliant: 0  // Renamed from 'low' and will include 'none' values
        },
        recommendations: []
    };
    
    // Process pillar data and calculate compliance percentages
    if (lensReview && lensReview.LensReview && lensReview.LensReview.PillarReviewSummaries) {
        lensReview.LensReview.PillarReviewSummaries.forEach(pillar => {
            // Calculate total questions
            const total = (
                (pillar.RiskCounts.HIGH || 0) + 
                (pillar.RiskCounts.MEDIUM || 0) + 
                (pillar.RiskCounts.LOW || 0) + 
                (pillar.RiskCounts.NONE || 0)
            );
            
            // Calculate compliant questions (NONE and LOW risk are considered compliant)
            const compliant = (pillar.RiskCounts.NONE || 0) + (pillar.RiskCounts.LOW || 0);
            
            // Calculate compliance percentage
            const compliancePercentage = total > 0 ? Math.round((compliant / total) * 100) : 0;
            
            // Add pillar data to processed data
            processedData.pillars.push({
                pillarId: pillar.PillarId,
                pillarName: pillar.PillarName,
                compliancePercentage: compliancePercentage,
                riskCounts: {
                    high: pillar.RiskCounts.HIGH || 0,
                    medium: pillar.RiskCounts.MEDIUM || 0,
                    compliant: (pillar.RiskCounts.NONE || 0) + (pillar.RiskCounts.LOW || 0)  // Combined NONE and LOW as compliant
                }
            });
            
            // Add to total risk counts
            processedData.riskCounts.high += pillar.RiskCounts.HIGH || 0;
            processedData.riskCounts.medium += pillar.RiskCounts.MEDIUM || 0;
            processedData.riskCounts.compliant += (pillar.RiskCounts.NONE || 0) + (pillar.RiskCounts.LOW || 0);  // Combined NONE and LOW as compliant
        });
    }
    
    // Calculate overall compliance percentage
    const totalQuestions = (
        processedData.riskCounts.high + 
        processedData.riskCounts.medium + 
        processedData.riskCounts.compliant
    );
    
    processedData.overallCompliance = totalQuestions > 0 ? 
        Math.round((processedData.riskCounts.compliant / totalQuestions) * 100) : 0;
    
    return processedData;
}

// Function to fetch recommendations for high and medium risk items
async function fetchRecommendations(workloadId, processedData) {
    try {
        // For each pillar, get answers with high or medium risk
        for (const pillar of processedData.pillars) {
            // Skip pillars with no high or medium risks
            if (pillar.riskCounts.high === 0 && pillar.riskCounts.medium === 0) {
                continue;
            }
            
            // Get answers for this pillar
            const answers = await callApi('list_answers', {
                WorkloadId: workloadId,
                LensAlias: 'wellarchitected',
                PillarId: pillar.pillarId
            });
            
            // Filter for high and medium risk items
            for (const answer of answers.AnswerSummaries || []) {
                if (answer.Risk === 'HIGH' || answer.Risk === 'MEDIUM') {
                    // Get detailed answer info
                    const detail = await callApi('get_answer', {
                        WorkloadId: workloadId,
                        LensAlias: 'wellarchitected',
                        QuestionId: answer.QuestionId
                    });
                    
                    processedData.recommendations.push({
                        title: answer.QuestionTitle,
                        pillarName: pillar.pillarName,
                        risk: answer.Risk,
                        improvementPlan: detail.Answer.ImprovementPlan || '',
                        improvementPlanUrl: detail.Answer.ImprovementPlanUrl || ''
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }
}

// Function to display workload data
function displayWorkloadData(data) {
    console.log("Displaying workload data:", JSON.stringify(data, null, 2));
    
    try {
        // Display workload information
        const workloadNameElement = document.getElementById('workload-name');
        if (workloadNameElement) {
            workloadNameElement.textContent = data.workloadName || 'N/A';
        } else {
            console.error("Element with ID 'workload-name' not found");
        }
        
        const reportDateElement = document.getElementById('report-date');
        if (reportDateElement) {
            reportDateElement.textContent = new Date().toLocaleDateString();
        } else {
            console.error("Element with ID 'report-date' not found");
        }
        
        // Make sure we're displaying the correct data in each field
        const reviewerNameElement = document.getElementById('reviewer-name');
        if (reviewerNameElement) {
            reviewerNameElement.textContent = data.ownerName || 'N/A';
        } else {
            console.error("Element with ID 'reviewer-name' not found");
        }
        
        const accountIdElement = document.getElementById('account-id');
        if (accountIdElement) {
            accountIdElement.textContent = data.accountIds && data.accountIds.length > 0 ? data.accountIds.join(', ') : 'N/A';
        } else {
            console.error("Element with ID 'account-id' not found");
        }
        
        const regionDisplayElement = document.getElementById('region-display');
        if (regionDisplayElement) {
            regionDisplayElement.textContent = data.regions && data.regions.length > 0 ? data.regions.join(', ') : 'N/A';
        } else {
            console.error("Element with ID 'region-display' not found");
        }
        
        const industryElement = document.getElementById('industry');
        if (industryElement) {
            industryElement.textContent = data.industry || 'N/A';
        } else {
            console.error("Element with ID 'industry' not found");
        }
        
        console.log("Updated display elements:");
        console.log("Owner name set to:", data.ownerName);
        console.log("Account ID set to:", data.accountIds && data.accountIds.length > 0 ? data.accountIds.join(', ') : 'N/A');
    } catch (error) {
        console.error("Error updating display:", error);
    }
    
    // Update risk counts
    const highRiskElement = document.getElementById('high-risk');
    if (highRiskElement) {
        highRiskElement.textContent = data.riskCounts.high;
    } else {
        console.error("Element with ID 'high-risk' not found");
    }
    
    const mediumRiskElement = document.getElementById('medium-risk');
    if (mediumRiskElement) {
        mediumRiskElement.textContent = data.riskCounts.medium;
    } else {
        console.error("Element with ID 'medium-risk' not found");
    }
    
    const compliantRiskElement = document.getElementById('compliant-risk');
    if (compliantRiskElement) {
        compliantRiskElement.textContent = data.riskCounts.compliant;
    } else {
        console.error("Element with ID 'compliant-risk' not found");
    }
    
    // Update overall compliance percentage
    const compliancePercentage = data.overallCompliance;
    const complianceElement = document.getElementById('compliance');
    if (complianceElement) {
        complianceElement.textContent = `${compliancePercentage}%`;
    } else {
        console.error("Element with ID 'compliance' not found");
    }
    
    const complianceBar = document.getElementById('compliance-bar');
    if (complianceBar) {
        complianceBar.style.width = `${compliancePercentage}%`;
        
        // Set compliance bar color based on percentage
        if (compliancePercentage < 30) {
            complianceBar.style.backgroundColor = '#d13212'; // Red
        } else if (compliancePercentage < 70) {
            complianceBar.style.backgroundColor = '#ff9900'; // Orange
        } else {
            complianceBar.style.backgroundColor = '#1d8102'; // Green
        }
    } else {
        console.error("Element with ID 'compliance-bar' not found");
    }
    
    // Create risk distribution chart
    try {
        const riskChartElement = document.getElementById('riskChart');
        if (riskChartElement) {
            createRiskChart(data.riskCounts.high, data.riskCounts.medium, data.riskCounts.compliant);
        } else {
            console.error("Element with ID 'riskChart' not found");
        }
        
        // Create pillar chart with real data
        const pillarChartElement = document.getElementById('pillarChart');
        if (pillarChartElement) {
            createPillarChart(data.pillars);
        } else {
            console.error("Element with ID 'pillarChart' not found");
        }
        
        // Display pillar summary with real data
        const pillarSummaryElement = document.getElementById('pillar-summary');
        if (pillarSummaryElement) {
            displayPillarSummary(data.pillars);
        } else {
            console.error("Element with ID 'pillar-summary' not found");
        }
        
        // Display recommendations with real data
        const recommendationsListElement = document.getElementById('recommendations-list');
        if (recommendationsListElement) {
            displayRecommendations(data.recommendations);
        } else {
            console.error("Element with ID 'recommendations-list' not found");
        }
        
        // Add event listener for risk summary export button
        const exportRiskSummaryBtn = document.getElementById('export-risk-summary-btn');
        if (exportRiskSummaryBtn) {
            exportRiskSummaryBtn.addEventListener('click', exportRiskSummary);
        } else {
            console.error("Element with ID 'export-risk-summary-btn' not found");
        }
    } catch (error) {
        console.error("Error creating charts or displaying data:", error);
    }
}

// Function to create risk distribution chart
function createRiskChart(highRisk, mediumRisk, compliantRisk) {
    try {
        const ctx = document.getElementById('riskChart');
        if (!ctx) {
            console.error("Element with ID 'riskChart' not found");
            return;
        }
        
        const context = ctx.getContext('2d');
        if (!context) {
            console.error("Could not get 2D context for riskChart");
            return;
        }
        
        // Destroy existing chart if it exists
        if (riskChart) {
            riskChart.destroy();
        }
        
        riskChart = new Chart(context, {
            type: 'doughnut',
            data: {
                labels: ['High Risk', 'Medium Risk', 'Compliant'],
                datasets: [{
                    data: [highRisk, mediumRisk, compliantRisk],
                    backgroundColor: ['#d13212', '#ff9900', '#1d8102'],  // Removed the light green for Low Risk
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating risk chart:", error);
    }
}

// Function to create pillar chart with real data
function createPillarChart(pillars) {
    try {
        const ctx = document.getElementById('pillarChart');
        if (!ctx) {
            console.error("Element with ID 'pillarChart' not found");
            return;
        }
        
        const context = ctx.getContext('2d');
        if (!context) {
            console.error("Could not get 2D context for pillarChart");
            return;
        }
        
        // Destroy existing chart if it exists
        if (pillarChart) {
            pillarChart.destroy();
        }
        
        pillarChart = new Chart(context, {
            type: 'radar',
            data: {
                labels: pillars.map(p => p.pillarName),
                datasets: [{
                    label: 'Compliance Score',
                    data: pillars.map(p => p.compliancePercentage),
                    backgroundColor: 'rgba(29, 129, 2, 0.2)',  // Light green background
                    borderColor: '#1d8102',                    // Green border
                    borderWidth: 2,
                    pointBackgroundColor: '#1d8102'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.raw + '% Compliant';
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error creating pillar chart:", error);
    }
}

// Function to display pillar summary with real data
function displayPillarSummary(pillars) {
    try {
        const pillarSummaryContainer = document.getElementById('pillar-summary');
        if (!pillarSummaryContainer) {
            console.error("Element with ID 'pillar-summary' not found");
            return;
        }
        
        pillarSummaryContainer.innerHTML = '';
        
        pillars.forEach(pillar => {
            const pillarCard = document.createElement('div');
            pillarCard.className = 'pillar-card';
            
            // Set color class based on compliance percentage (higher is better)
            let colorClass = 'risk-low';  // Green for high compliance
            let barColor = '#1d8102';     // Green
            
            if (pillar.compliancePercentage < 30) {
                colorClass = 'risk-high';  // Red for low compliance
                barColor = '#d13212';      // Red
            } else if (pillar.compliancePercentage < 70) {
                colorClass = 'risk-medium'; // Orange for medium compliance
                barColor = '#ff9900';       // Orange
            }
            
            pillarCard.innerHTML = `
                <h5>${pillar.pillarName}</h5>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="${colorClass}">${pillar.compliancePercentage}% Compliant</span>
                    <div class="progress-container" style="width: 70%;">
                        <div class="progress-bar" style="width: ${pillar.compliancePercentage}%; background-color: ${barColor}"></div>
                    </div>
                </div>
                <div class="risk-counts">
                    <span class="risk-high">High: ${pillar.riskCounts.high}</span>
                    <span class="risk-medium">Medium: ${pillar.riskCounts.medium}</span>
                    <span class="risk-low">Compliant: ${pillar.riskCounts.compliant}</span>
                </div>
                <div class="text-center mt-2">
                    <button class="btn btn-sm btn-outline-secondary export-pillar-btn" data-pillar="${pillar.pillarName}">Export Summary</button>
                </div>
            `;
            
            pillarSummaryContainer.appendChild(pillarCard);
        });
        
        // Add event listeners for export buttons
        document.querySelectorAll('.export-pillar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pillarName = btn.getAttribute('data-pillar');
                exportPillarSummary(pillarName);
            });
        });
    } catch (error) {
        console.error("Error displaying pillar summary:", error);
    }
}

// Function to display recommendations with real data
function displayRecommendations(recommendations) {
    try {
        const recommendationsContainer = document.getElementById('recommendations-list');
        if (!recommendationsContainer) {
            console.error("Element with ID 'recommendations-list' not found");
            return;
        }
        
        recommendationsContainer.innerHTML = '';
        
        if (!recommendations || recommendations.length === 0) {
            recommendationsContainer.innerHTML = '<p>No recommendations available.</p>';
            return;
        }
        
        recommendations.forEach(rec => {
            const recItem = document.createElement('div');
            recItem.className = 'recommendation-item';
            
            let riskClass = 'risk-low';
            if (rec.risk === 'HIGH') {
                riskClass = 'risk-high';
            } else if (rec.risk === 'MEDIUM') {
                riskClass = 'risk-medium';
            }
            
            recItem.innerHTML = `
                <h5>${rec.title}</h5>
                <p>${rec.improvementPlan || 'No improvement plan available.'}</p>
                <div class="d-flex justify-content-between">
                    <span>Pillar: ${rec.pillarName}</span>
                    <span class="${riskClass}">Risk: ${rec.risk}</span>
                </div>
                ${rec.improvementPlanUrl ? `<a href="${rec.improvementPlanUrl}" target="_blank" class="recommendation-link">View Detailed Guidance</a>` : ''}
            `;
            
            recommendationsContainer.appendChild(recItem);
        });
    } catch (error) {
        console.error("Error displaying recommendations:", error);
    }
}

// Function to export pillar summary as image
function exportPillarSummary(pillarName) {
    try {
        // Find the pillar card
        const pillarCards = document.querySelectorAll('.pillar-card');
        if (!pillarCards || pillarCards.length === 0) {
            console.error("No pillar cards found");
            return;
        }
        
        let pillarCard = null;
        
        pillarCards.forEach(card => {
            const heading = card.querySelector('h5');
            if (heading && heading.textContent === pillarName) {
                pillarCard = card;
            }
        });
        
        if (!pillarCard) {
            console.error('Could not find pillar card for', pillarName);
            return;
        }
        
        // Use html2canvas to capture the pillar card
        if (typeof html2canvas === 'undefined') {
            console.error('html2canvas is not defined. Make sure the library is loaded.');
            alert('Error: html2canvas library is not loaded. Please check your HTML includes the library.');
            return;
        }
        
        html2canvas(pillarCard).then(canvas => {
            const link = document.createElement('a');
            link.download = `pillar-summary-${pillarName}-${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error exporting pillar summary:', error);
            alert('Error exporting pillar summary: ' + error.message);
        });
    } catch (error) {
        console.error('Error in exportPillarSummary:', error);
        alert('Error exporting pillar summary: ' + error.message);
    }
}

// Function to export risk summary as image
function exportRiskSummary() {
    try {
        // Find the risk summary card - using a more compatible selector
        const highRiskElement = document.getElementById('high-risk');
        if (!highRiskElement) {
            console.error('Could not find high-risk element');
            return;
        }
        
        // Find the closest card ancestor
        let riskSummary = highRiskElement;
        while (riskSummary && !riskSummary.classList.contains('card')) {
            riskSummary = riskSummary.parentElement;
        }
        
        if (!riskSummary) {
            console.error('Could not find risk summary card');
            return;
        }
        
        // Use html2canvas to capture the risk summary
        html2canvas(riskSummary).then(canvas => {
            const link = document.createElement('a');
            link.download = `risk-summary-${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error exporting risk summary:', error);
            alert('Error exporting risk summary. Please make sure html2canvas is loaded.');
        });
    } catch (error) {
        console.error('Error in exportRiskSummary:', error);
        alert('Error exporting risk summary: ' + error.message);
    }
}
