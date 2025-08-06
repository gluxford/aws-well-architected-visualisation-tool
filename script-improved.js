// API endpoint - this should be dynamically set during deployment
const API_ENDPOINT = window.WA_API_ENDPOINT || 'https://6khj1jz27b.execute-api.ap-southeast-2.amazonaws.com/prod/proxy';

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

// Global workload data for recommendations export
let currentWorkloadData = null;
let currentRecommendationsData = null;

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
    
    // Export recommendations to Excel button
    const exportRecommendationsExcelBtn = document.getElementById('export-recommendations-excel-btn');
    if (exportRecommendationsExcelBtn) {
        exportRecommendationsExcelBtn.addEventListener('click', exportRecommendationsToExcel);
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
        await displayWorkloadData(workloadData);
        
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
async function displayWorkloadData(data) {
    try {
        console.log('Displaying workload data:', data);
        
        // Store workload data globally for Excel export
        currentWorkloadData = data;
        
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
        
        // Update overall compliance percentage - calculate consistently with ring chart
        const totalAnsweredQuestions = data.riskCounts.high + data.riskCounts.medium + data.riskCounts.compliant;
        const compliancePercentage = totalAnsweredQuestions > 0 
            ? Math.round((data.riskCounts.compliant / totalAnsweredQuestions) * 100 * 10) / 10  // Round to 1 decimal place
            : 0;
        
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
        
        // Fetch and display recommendations
        console.log('Fetching recommendations...');
        await fetchRecommendations(data.workloadId, data);
        displayRecommendations(data.recommendations);
        
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

// Function to fetch recommendations for high and medium risk items
async function fetchRecommendations(workloadId, processedData) {
    try {
        // Initialize recommendations array if it doesn't exist
        if (!processedData.recommendations) {
            processedData.recommendations = [];
        }
        
        // For each pillar, get answers with high or medium risk
        for (const pillar of processedData.pillars) {
            // Skip pillars with no high or medium risks
            if (pillar.riskCounts.HIGH === 0 && pillar.riskCounts.MEDIUM === 0) {
                continue;
            }
            
            // Get answers for this pillar
            const answers = await callApi('list_answers', {
                WorkloadId: workloadId,
                LensAlias: 'wellarchitected',
                PillarId: pillar.id
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
                        pillarName: pillar.name,
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

// Function to display recommendations with real data
function displayRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendations-list');
    recommendationsContainer.innerHTML = '';
    
    // Store recommendations data globally for Excel export
    currentRecommendationsData = recommendations;
    
    if (!recommendations || recommendations.length === 0) {
        recommendationsContainer.innerHTML = '<p>No recommendations available.</p>';
        return;
    }
    
    recommendations.forEach((rec, index) => {
        const recItem = document.createElement('div');
        recItem.className = 'recommendation-item';
        recItem.style.border = '1px solid #dee2e6';
        recItem.style.borderRadius = '8px';
        recItem.style.padding = '15px';
        recItem.style.marginBottom = '15px';
        recItem.style.backgroundColor = '#ffffff';
        
        // Set risk color without background highlighting
        let riskColor = '#6c757d'; // Default gray for low risk
        if (rec.risk === 'HIGH') {
            riskColor = '#dc3545'; // Red for high risk
        } else if (rec.risk === 'MEDIUM') {
            riskColor = '#fd7e14'; // Amber/orange for medium risk
        }
        
        // Transform question title into statement format
        let transformedTitle = rec.title;
        
        // Remove "How do you " from the beginning (case insensitive)
        transformedTitle = transformedTitle.replace(/^How do you /i, '');
        
        // Remove question mark from the end
        transformedTitle = transformedTitle.replace(/\?$/, '');
        
        // Capitalize the first letter
        transformedTitle = transformedTitle.charAt(0).toUpperCase() + transformedTitle.slice(1);
        
        // Only show improvement plan if it exists and is not empty
        const improvementPlanHtml = rec.improvementPlan && rec.improvementPlan.trim() 
            ? `<p>${rec.improvementPlan}</p>` 
            : '';
        
        // Create expandable guidance section
        const guidanceId = `guidance-${index}`;
        const guidanceSection = rec.improvementPlanUrl ? `
            <div class="mt-3">
                <button class="btn btn-sm btn-outline-primary" type="button" onclick="toggleGuidance('${guidanceId}', '${rec.improvementPlanUrl}')">
                    <span id="btn-text-${guidanceId}">Show Detailed Guidance</span>
                </button>
                <div id="${guidanceId}" class="mt-2" style="display: none;">
                    <div class="p-3 bg-light border rounded">
                        <div id="guidance-content-${guidanceId}">Loading guidance...</div>
                    </div>
                </div>
            </div>
        ` : '';
        
        recItem.innerHTML = `
            <h5>${transformedTitle}</h5>
            ${improvementPlanHtml}
            <div class="d-flex justify-content-between">
                <span>Pillar: ${rec.pillarName}</span>
                <span style="color: ${riskColor}; font-weight: 500;">Risk: ${rec.risk}</span>
            </div>
            ${guidanceSection}
        `;
        
        recommendationsContainer.appendChild(recItem);
    });
}

// Function to toggle guidance display and load content
async function toggleGuidance(guidanceId, guidanceUrl) {
    const guidanceDiv = document.getElementById(guidanceId);
    const buttonText = document.getElementById(`btn-text-${guidanceId}`);
    const contentDiv = document.getElementById(`guidance-content-${guidanceId}`);
    
    if (guidanceDiv.style.display === 'none') {
        // Show guidance
        guidanceDiv.style.display = 'block';
        buttonText.textContent = 'Hide Detailed Guidance';
        
        // Load content if not already loaded
        if (contentDiv.innerHTML === 'Loading guidance...') {
            try {
                // Fetch the AWS guidance page content
                const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(guidanceUrl)}`);
                const data = await response.json();
                
                if (data.contents) {
                    // Parse the HTML content to extract remediation links
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(data.contents, 'text/html');
                    
                    // Look for common patterns in AWS guidance pages
                    const links = [];
                    
                    // Extract links from various sections
                    const linkElements = doc.querySelectorAll('a[href]');
                    linkElements.forEach(link => {
                        const href = link.getAttribute('href');
                        const text = link.textContent.trim();
                        
                        // Filter for relevant AWS documentation and service links
                        if (href && text && (
                            href.includes('docs.aws.amazon.com') ||
                            href.includes('aws.amazon.com/') ||
                            href.includes('console.aws.amazon.com') ||
                            text.toLowerCase().includes('guide') ||
                            text.toLowerCase().includes('documentation') ||
                            text.toLowerCase().includes('best practice') ||
                            text.toLowerCase().includes('tutorial') ||
                            text.toLowerCase().includes('how to')
                        )) {
                            // Make sure href is absolute
                            const absoluteHref = href.startsWith('http') ? href : `https://aws.amazon.com${href}`;
                            links.push({ text, href: absoluteHref });
                        }
                    });
                    
                    // Remove duplicates
                    const uniqueLinks = links.filter((link, index, self) => 
                        index === self.findIndex(l => l.href === link.href)
                    );
                    
                    if (uniqueLinks.length > 0) {
                        let linksHtml = '<h6>Remediation Resources</h6><ul class="list-unstyled">';
                        uniqueLinks.slice(0, 10).forEach(link => { // Limit to first 10 links
                            linksHtml += `
                                <li class="mb-2">
                                    <a href="${link.href}" target="_blank" class="text-decoration-none">
                                        <i class="fas fa-external-link-alt text-muted me-1"></i>
                                        ${link.text}
                                    </a>
                                </li>
                            `;
                        });
                        linksHtml += '</ul>';
                        
                        contentDiv.innerHTML = `
                            <div class="guidance-content">
                                ${linksHtml}
                                <div class="mt-3 pt-3 border-top">
                                    <small class="text-muted">
                                        <a href="${guidanceUrl}" target="_blank">View complete guidance on AWS</a>
                                    </small>
                                </div>
                            </div>
                        `;
                    } else {
                        // Fallback if no links found
                        contentDiv.innerHTML = `
                            <div class="guidance-content">
                                <h6>AWS Well-Architected Guidance</h6>
                                <p>No specific remediation links could be extracted from this guidance page.</p>
                                <a href="${guidanceUrl}" target="_blank" class="btn btn-primary btn-sm">
                                    <i class="fas fa-external-link-alt"></i> View Full Guidance
                                </a>
                            </div>
                        `;
                    }
                } else {
                    throw new Error('Unable to fetch content');
                }
            } catch (error) {
                console.error('Error fetching guidance content:', error);
                // Fallback content
                contentDiv.innerHTML = `
                    <div class="guidance-content">
                        <h6>AWS Well-Architected Guidance</h6>
                        <p>Unable to load remediation links directly. Please visit the AWS guidance page:</p>
                        <a href="${guidanceUrl}" target="_blank" class="btn btn-primary btn-sm">
                            <i class="fas fa-external-link-alt"></i> Open AWS Guidance
                        </a>
                        <div class="mt-3">
                            <small class="text-muted">
                                The guidance page typically includes:
                                <ul class="mt-2">
                                    <li>Implementation steps and best practices</li>
                                    <li>AWS service recommendations</li>
                                    <li>Code examples and configuration templates</li>
                                    <li>Common pitfalls and how to avoid them</li>
                                </ul>
                            </small>
                        </div>
                    </div>
                `;
            }
        }
    } else {
        // Hide guidance
        guidanceDiv.style.display = 'none';
        buttonText.textContent = 'Show Detailed Guidance';
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
    
    // Use compliance data from the Lambda function (already correctly calculated)
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
        
        // Use pillar compliance from the Lambda function (already correctly calculated)
        const pillarCompliance = pillar.compliance;
        
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
                        <small>Compliance: ${pillarCompliance}%</small>
                        <div class="progress" style="height: 8px;">
                            <div class="progress-bar ${pillarCompliance < 30 ? 'bg-danger' : pillarCompliance < 70 ? 'bg-warning' : 'bg-success'}" 
                                 style="width: ${pillarCompliance}%"></div>
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

// Function to export recommendations to Excel
function exportRecommendationsToExcel() {
    if (!currentWorkloadData || !currentRecommendationsData || currentRecommendationsData.length === 0) {
        alert('No recommendations data available to export. Please load a workload first.');
        return;
    }
    
    if (typeof XLSX === 'undefined') {
        alert('Excel export functionality not available. XLSX library not loaded.');
        return;
    }
    
    try {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Create workload summary sheet
        const summaryData = [
            ['Well-Architected Framework - Recommendations Report'],
            [''],
            ['Workload Information'],
            ['Workload Name', currentWorkloadData.workloadName || 'N/A'],
            ['Workload ID', currentWorkloadData.workloadId || 'N/A'],
            ['Environment', currentWorkloadData.environment || 'N/A'],
            ['Owner', currentWorkloadData.ownerName || 'N/A'],
            ['Generated Date', new Date().toLocaleDateString()],
            [''],
            ['Risk Summary'],
            ['High Risk Items', currentWorkloadData.riskCounts?.high || 0],
            ['Medium Risk Items', currentWorkloadData.riskCounts?.medium || 0],
            ['Compliant Items', currentWorkloadData.riskCounts?.compliant || 0],
            ['Overall Compliance', `${currentWorkloadData.overallCompliance || 0}%`],
            ['']
        ];
        
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths for summary sheet
        summaryWs['!cols'] = [
            { width: 25 },
            { width: 30 }
        ];
        
        // Add summary sheet to workbook
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
        
        // Create recommendations sheet
        const recommendationsData = [
            ['Recommendations and Detailed Guidance'],
            [''],
            ['Question/Area', 'Pillar', 'Risk Level', 'Improvement Plan URL']
        ];
        
        // Add each recommendation
        currentRecommendationsData.forEach(rec => {
            // Transform question title (remove "How do you" and question mark)
            let transformedTitle = rec.title;
            transformedTitle = transformedTitle.replace(/^How do you /i, '');
            transformedTitle = transformedTitle.replace(/\?$/, '');
            transformedTitle = transformedTitle.charAt(0).toUpperCase() + transformedTitle.slice(1);
            
            recommendationsData.push([
                transformedTitle,
                rec.pillarName,
                rec.risk,
                rec.improvementPlanUrl || 'N/A'
            ]);
        });
        
        const recommendationsWs = XLSX.utils.aoa_to_sheet(recommendationsData);
        
        // Set column widths for recommendations sheet
        recommendationsWs['!cols'] = [
            { width: 50 },  // Question/Area
            { width: 20 },  // Pillar
            { width: 15 },  // Risk Level
            { width: 60 }   // Improvement Plan URL
        ];
        
        // Add recommendations sheet to workbook
        XLSX.utils.book_append_sheet(wb, recommendationsWs, 'Recommendations');
        
        // Create detailed guidance sheet with pillar breakdown
        const pillarData = [
            ['Pillar Risk Breakdown'],
            [''],
            ['Pillar', 'High Risk', 'Medium Risk', 'Compliant', 'Compliance %']
        ];
        
        if (currentWorkloadData.pillars) {
            currentWorkloadData.pillars.forEach(pillar => {
                pillarData.push([
                    pillar.name,
                    pillar.riskCounts?.HIGH || 0,
                    pillar.riskCounts?.MEDIUM || 0,
                    pillar.riskCounts?.NONE || 0,
                    `${pillar.compliance || 0}%`
                ]);
            });
        }
        
        const pillarWs = XLSX.utils.aoa_to_sheet(pillarData);
        
        // Set column widths for pillar sheet
        pillarWs['!cols'] = [
            { width: 25 },  // Pillar
            { width: 12 },  // High Risk
            { width: 12 },  // Medium Risk
            { width: 12 },  // Compliant
            { width: 15 }   // Compliance %
        ];
        
        // Add pillar sheet to workbook
        XLSX.utils.book_append_sheet(wb, pillarWs, 'Pillar Breakdown');
        
        // Generate filename with workload name and date
        const workloadName = (currentWorkloadData.workloadName || 'Workload').replace(/[^a-zA-Z0-9]/g, '_');
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `WA_Recommendations_${workloadName}_${dateStr}.xlsx`;
        
        // Save the file
        XLSX.writeFile(wb, filename);
        
        console.log('Excel file exported successfully:', filename);
        
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('Error exporting to Excel. Please try again.');
    }
}

// Make functions available globally for HTML onclick handlers
window.exportRiskSummary = exportRiskSummary;
window.exportPillarSummary = exportPillarSummary;
window.exportRecommendationsToExcel = exportRecommendationsToExcel;
