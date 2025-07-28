// API endpoint - this should be dynamically set during deployment
const API_ENDPOINT = window.WA_API_ENDPOINT || 'https://n8peb2vyeg.execute-api.ap-southeast-2.amazonaws.com/prod/proxy';

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
    const generationDateElement = document.getElementById('generation-date');
    if (generationDateElement) {
        generationDateElement.textContent = new Date().toLocaleDateString();
    }
    
    // Add event listeners
    if (fetchBtn) fetchBtn.addEventListener('click', fetchWorkload);
    if (listWorkloadsBtn) listWorkloadsBtn.addEventListener('click', listWorkloads);
    
    // Export chart buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chartId = btn.getAttribute('data-chart');
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const link = document.createElement('a');
                link.download = `${chartId}-${new Date().toISOString()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }
        });
    });
    
    // Export risk summary button
    const exportRiskSummaryBtn = document.getElementById('export-risk-summary-btn');
    if (exportRiskSummaryBtn) {
        exportRiskSummaryBtn.addEventListener('click', exportRiskSummary);
    }
    
    console.log(`Well-Architected Visualizer initialized with API endpoint: ${API_ENDPOINT}`);
});

// Function to show loading indicator
function showLoading() {
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (reportContent) reportContent.classList.add('hidden');
    if (workloadsList) workloadsList.classList.add('hidden');
}

// Function to hide loading indicator
function hideLoading() {
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
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
        console.log('API response:', data);
        
        return data;
        
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Function to list available workloads
async function listWorkloads() {
    try {
        showLoading();
        
        const data = await callApi('list_workloads');
        
        // Clear previous list
        if (workloadsListItems) {
            workloadsListItems.innerHTML = '';
        }
        
        if (data.WorkloadSummaries && data.WorkloadSummaries.length > 0) {
            data.WorkloadSummaries.forEach(workload => {
                const workloadItem = document.createElement('div');
                workloadItem.className = 'workload-item';
                workloadItem.innerHTML = `
                    <h6>${workload.WorkloadName}</h6>
                    <p><strong>ARN:</strong> ${workload.WorkloadArn}</p>
                    <p><strong>Updated:</strong> ${new Date(workload.UpdatedAt).toLocaleDateString()}</p>
                    <p><strong>Risk Summary:</strong> 
                        ${workload.RiskCounts.HIGH || 0} High, 
                        ${workload.RiskCounts.MEDIUM || 0} Medium, 
                        ${workload.RiskCounts.NONE || 0} Compliant
                        ${workload.RiskCounts.UNANSWERED ? `, ${workload.RiskCounts.UNANSWERED} Unanswered` : ''}
                    </p>
                `;
                
                workloadItem.addEventListener('click', () => {
                    if (workloadArnInput) {
                        workloadArnInput.value = workload.WorkloadArn;
                    }
                    fetchWorkload();
                });
                
                if (workloadsListItems) {
                    workloadsListItems.appendChild(workloadItem);
                }
            });
            
            if (workloadsList) {
                workloadsList.classList.remove('hidden');
            }
        } else {
            if (workloadsListItems) {
                workloadsListItems.innerHTML = '<p>No workloads found.</p>';
            }
            if (workloadsList) {
                workloadsList.classList.remove('hidden');
            }
        }
        
    } catch (error) {
        console.error('Error listing workloads:', error);
        alert(`Error listing workloads: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Function to fetch and display workload data
async function fetchWorkload() {
    try {
        if (!workloadArnInput || !workloadArnInput.value.trim()) {
            alert('Please enter a workload ARN or select from the list');
            return;
        }
        
        showLoading();
        
        const workloadArn = workloadArnInput.value.trim();
        const workloadId = workloadArn.includes('/') ? workloadArn.split('/').pop() : workloadArn;
        
        console.log(`Fetching data for workload: ${workloadId}`);
        
        // Use the custom get_workload_data operation for comprehensive data
        const workloadData = await callApi('get_workload_data', {
            WorkloadId: workloadId
        });
        
        // Display the workload data
        displayWorkloadData(workloadData);
        
        if (reportContent) {
            reportContent.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error fetching workload:', error);
        alert(`Error fetching workload: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Function to display workload data
function displayWorkloadData(data) {
    try {
        console.log('Displaying workload data:', data);
        
        // Display workload information
        updateElementText('workload-name', data.workloadName || 'N/A');
        updateElementText('report-date', new Date().toLocaleDateString());
        updateElementText('reviewer-name', data.ownerName || 'N/A');
        updateElementText('account-id', data.accountIds && data.accountIds.length > 0 ? data.accountIds.join(', ') : 'N/A');
        updateElementText('region-display', data.regions && data.regions.length > 0 ? data.regions.join(', ') : 'N/A');
        updateElementText('industry', data.industry || 'N/A');
        
        // Update risk counts
        updateElementText('high-risk', data.riskCounts.high);
        updateElementText('medium-risk', data.riskCounts.medium);
        updateElementText('compliant-risk', data.riskCounts.compliant);
        
        // Show unanswered questions if they exist
        if (data.riskCounts.unanswered > 0) {
            const unansweredElement = document.getElementById('unanswered-risk');
            if (unansweredElement) {
                updateElementText('unanswered-risk', data.riskCounts.unanswered);
                unansweredElement.parentElement.style.display = 'block';
            } else {
                // Add unanswered section if it doesn't exist
                const riskSummaryContainer = document.querySelector('.card-body .row');
                if (riskSummaryContainer) {
                    const unansweredCol = document.createElement('div');
                    unansweredCol.className = 'col-3';
                    unansweredCol.innerHTML = `
                        <h5 class="text-info">Unanswered</h5>
                        <h2 id="unanswered-risk" class="text-info">${data.riskCounts.unanswered}</h2>
                    `;
                    riskSummaryContainer.appendChild(unansweredCol);
                }
            }
        }
        
        // Update overall compliance percentage
        const compliancePercentage = data.overallCompliance;
        updateElementText('compliance', `${compliancePercentage}%`);
        
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
        }
        
        // Create charts
        createRiskChart(data.riskCounts.high, data.riskCounts.medium, data.riskCounts.compliant, data.riskCounts.unanswered);
        createPillarChart(data.pillars);
        
        // Display pillar summary
        displayPillarSummary(data.pillars);
        
        // Show warning if there are unanswered questions
        if (data.hasUnansweredQuestions) {
            showUnansweredWarning(data.riskCounts.unanswered);
        }
        
        console.log('Workload data displayed successfully');
        
    } catch (error) {
        console.error('Error displaying workload data:', error);
        alert(`Error displaying data: ${error.message}`);
    }
}

// Helper function to update element text safely
function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`Element with ID '${elementId}' not found`);
    }
}

// Function to show warning about unanswered questions
function showUnansweredWarning(unansweredCount) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'alert alert-warning mt-3';
    warningDiv.innerHTML = `
        <h5>⚠️ Assessment Incomplete</h5>
        <p>This workload has <strong>${unansweredCount} unanswered questions</strong>. 
        Complete the Well-Architected review in the AWS console to get accurate risk assessments and recommendations.</p>
    `;
    
    const reportContent = document.getElementById('report-content');
    if (reportContent) {
        reportContent.insertBefore(warningDiv, reportContent.firstChild);
    }
}

// Function to create risk distribution chart
function createRiskChart(highRisk, mediumRisk, compliantRisk, unansweredRisk = 0) {
    const ctx = document.getElementById('riskChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (riskChart) {
        riskChart.destroy();
    }
    
    const labels = ['High Risk', 'Medium Risk', 'Compliant'];
    const data = [highRisk, mediumRisk, compliantRisk];
    const colors = ['#dc3545', '#ffc107', '#28a745'];
    
    // Add unanswered if there are any
    if (unansweredRisk > 0) {
        labels.push('Unanswered');
        data.push(unansweredRisk);
        colors.push('#17a2b8');
    }
    
    riskChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
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
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Function to create pillar chart with real data
function createPillarChart(pillars) {
    const ctx = document.getElementById('pillarChart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (pillarChart) {
        pillarChart.destroy();
    }
    
    const labels = pillars.map(p => p.name);
    const complianceData = pillars.map(p => p.compliance);
    
    pillarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Compliance %',
                data: complianceData,
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#007bff',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Function to display pillar summary with real data
function displayPillarSummary(pillars) {
    const pillarSummaryContainer = document.getElementById('pillar-summary');
    if (!pillarSummaryContainer) return;
    
    pillarSummaryContainer.innerHTML = '';
    
    pillars.forEach(pillar => {
        const pillarCard = document.createElement('div');
        pillarCard.className = 'col-md-6 col-lg-4 mb-3';
        
        const riskCounts = pillar.riskCounts;
        const hasUnanswered = riskCounts.UNANSWERED > 0;
        
        pillarCard.innerHTML = `
            <div class="card pillar-card">
                <div class="card-header">
                    <h5>${pillar.name}</h5>
                </div>
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-4">
                            <small class="text-danger">High</small>
                            <div class="h6 text-danger">${riskCounts.HIGH}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-warning">Medium</small>
                            <div class="h6 text-warning">${riskCounts.MEDIUM}</div>
                        </div>
                        <div class="col-4">
                            <small class="text-success">Compliant</small>
                            <div class="h6 text-success">${riskCounts.NONE}</div>
                        </div>
                    </div>
                    ${hasUnanswered ? `
                        <div class="row text-center mt-2">
                            <div class="col-12">
                                <small class="text-info">Unanswered</small>
                                <div class="h6 text-info">${riskCounts.UNANSWERED}</div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="mt-2">
                        <small>Compliance: ${pillar.compliance}%</small>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar ${pillar.compliance < 30 ? 'bg-danger' : pillar.compliance < 70 ? 'bg-warning' : 'bg-success'}" 
                                 style="width: ${pillar.compliance}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        pillarSummaryContainer.appendChild(pillarCard);
    });
}

// Function to export risk summary as image
function exportRiskSummary() {
    const riskSummary = document.querySelector('.card:has(#high-risk)')?.closest('.card');
    
    if (!riskSummary) {
        console.error('Could not find risk summary card');
        return;
    }
    
    // Use html2canvas to capture the risk summary
    if (typeof html2canvas !== 'undefined') {
        html2canvas(riskSummary).then(canvas => {
            const link = document.createElement('a');
            link.download = `risk-summary-${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error exporting risk summary:', error);
            alert('Error exporting risk summary. Please make sure html2canvas is loaded.');
        });
    } else {
        alert('Export functionality not available. html2canvas library not loaded.');
    }
}

// Function to export pillar summary as image
function exportPillarSummary(pillarName) {
    const pillarCards = document.querySelectorAll('.pillar-card');
    let pillarCard = null;
    
    pillarCards.forEach(card => {
        if (card.querySelector('h5').textContent === pillarName) {
            pillarCard = card;
        }
    });
    
    if (!pillarCard) {
        console.error('Could not find pillar card for', pillarName);
        return;
    }
    
    // Use html2canvas to capture the pillar card
    if (typeof html2canvas !== 'undefined') {
        html2canvas(pillarCard).then(canvas => {
            const link = document.createElement('a');
            link.download = `pillar-summary-${pillarName}-${new Date().toISOString()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Error exporting pillar summary:', error);
            alert('Error exporting pillar summary. Please make sure html2canvas is loaded.');
        });
    } else {
        alert('Export functionality not available. html2canvas library not loaded.');
    }
}

// Make functions available globally for HTML onclick handlers
window.exportRiskSummary = exportRiskSummary;
window.exportPillarSummary = exportPillarSummary;
