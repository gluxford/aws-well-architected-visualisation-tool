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
        
        // Get workload details
        const workloadData = await callApi('get_workload', {
            WorkloadId: workloadId
        });
        
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
    // Initialize processed data structure
    const processedData = {
        workloadName: workloadData.Workload.WorkloadName,
        workloadDescription: workloadData.Workload.Description || '',
        pillars: [],
        riskCounts: {
            high: 0,
            medium: 0,
            low: 0,
            none: 0
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
                    low: pillar.RiskCounts.LOW || 0,
                    none: pillar.RiskCounts.NONE || 0
                }
            });
            
            // Add to total risk counts
            processedData.riskCounts.high += pillar.RiskCounts.HIGH || 0;
            processedData.riskCounts.medium += pillar.RiskCounts.MEDIUM || 0;
            processedData.riskCounts.low += pillar.RiskCounts.LOW || 0;
            processedData.riskCounts.none += pillar.RiskCounts.NONE || 0;
        });
    }
    
    // Calculate overall compliance percentage
    const totalQuestions = (
        processedData.riskCounts.high + 
        processedData.riskCounts.medium + 
        processedData.riskCounts.low + 
        processedData.riskCounts.none
    );
    
    const totalCompliant = processedData.riskCounts.none + processedData.riskCounts.low;
    processedData.overallCompliance = totalQuestions > 0 ? 
        Math.round((totalCompliant / totalQuestions) * 100) : 0;
    
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
    // Display workload information
    document.getElementById('workload-name').textContent = data.workloadName;
    document.getElementById('report-date').textContent = new Date().toLocaleDateString();
    document.getElementById('reviewer-name').textContent = 'N/A'; // This info isn't in the response
    document.getElementById('account-id').textContent = 'N/A'; // This info isn't in the response
    document.getElementById('region-display').textContent = 'N/A'; // This info isn't in the response
    document.getElementById('industry').textContent = 'N/A'; // This info isn't in the response
    
    // Update risk counts
    document.getElementById('high-risk').textContent = data.riskCounts.high;
    document.getElementById('medium-risk').textContent = data.riskCounts.medium;
    document.getElementById('low-risk').textContent = data.riskCounts.low;
    
    // Update overall compliance percentage
    const compliancePercentage = data.overallCompliance;
    document.getElementById('compliance').textContent = `${compliancePercentage}%`;
    document.getElementById('compliance-bar').style.width = `${compliancePercentage}%`;
    
    // Set compliance bar color based on percentage
    const complianceBar = document.getElementById('compliance-bar');
    if (compliancePercentage < 30) {
        complianceBar.style.backgroundColor = '#d13212'; // Red
    } else if (compliancePercentage < 70) {
        complianceBar.style.backgroundColor = '#ff9900'; // Orange
    } else {
        complianceBar.style.backgroundColor = '#1d8102'; // Green
    }
    
    // Create risk distribution chart
    createRiskChart(data.riskCounts.high, data.riskCounts.medium, data.riskCounts.low, data.riskCounts.none);
    
    // Create pillar chart with real data
    createPillarChart(data.pillars);
    
    // Display pillar summary with real data
    displayPillarSummary(data.pillars);
    
    // Display recommendations with real data
    displayRecommendations(data.recommendations);
}

// Function to create risk distribution chart
function createRiskChart(highRisk, mediumRisk, lowRisk, noRisk) {
    const ctx = document.getElementById('riskChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (riskChart) {
        riskChart.destroy();
    }
    
    riskChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High Risk', 'Medium Risk', 'Low Risk', 'No Risk'],
            datasets: [{
                data: [highRisk, mediumRisk, lowRisk, noRisk],
                backgroundColor: ['#d13212', '#ff9900', '#7dba00', '#1d8102'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Function to create pillar chart with real data
function createPillarChart(pillars) {
    const ctx = document.getElementById('pillarChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (pillarChart) {
        pillarChart.destroy();
    }
    
    pillarChart = new Chart(ctx, {
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
}

// Function to display pillar summary with real data
function displayPillarSummary(pillars) {
    const pillarSummaryContainer = document.getElementById('pillar-summary');
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
                <span class="risk-low">Low: ${pillar.riskCounts.low}</span>
                <span class="risk-none">None: ${pillar.riskCounts.none}</span>
            </div>
        `;
        
        pillarSummaryContainer.appendChild(pillarCard);
    });
}

// Function to display recommendations with real data
function displayRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendations-list');
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
}
