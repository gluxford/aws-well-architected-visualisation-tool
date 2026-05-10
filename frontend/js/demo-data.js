// Demo mode - intercepts API calls and returns embedded sample data
// Works from file:// protocol (no server required)
// Load this script BEFORE app.js to override the API_ENDPOINT behavior

(function() {
    'use strict';

    var WORKLOAD_1 = {"workloadId":"sample-workload-001","workloadName":"E-Commerce Platform (Ops & Reliability Focused)","workloadArn":"arn:aws:wellarchitected:ap-southeast-2:123456789012:workload/sample-workload-001","description":"Production e-commerce platform with strong operational practices and reliability but needs cost and security improvements","environment":"PRODUCTION","ownerName":"Platform Engineering Team","accountIds":["123456789012"],"regions":["ap-southeast-2"],"industry":"Retail","updatedAt":"2026-05-01T10:30:00Z","riskCounts":{"high":8,"medium":12,"compliant":28,"unanswered":0,"notApplicable":7},"overallCompliance":58,"pillars":[{"id":"operationalExcellence","name":"Operational Excellence","riskCounts":{"HIGH":0,"MEDIUM":1,"NONE":8,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":89},{"id":"security","name":"Security","riskCounts":{"HIGH":4,"MEDIUM":3,"NONE":3,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":30},{"id":"reliability","name":"Reliability","riskCounts":{"HIGH":0,"MEDIUM":2,"NONE":7,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":78},{"id":"performanceEfficiency","name":"Performance Efficiency","riskCounts":{"HIGH":1,"MEDIUM":3,"NONE":4,"UNANSWERED":0,"NOT_APPLICABLE":2},"compliance":50},{"id":"costOptimization","name":"Cost Optimization","riskCounts":{"HIGH":3,"MEDIUM":2,"NONE":3,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":38},{"id":"sustainability","name":"Sustainability","riskCounts":{"HIGH":0,"MEDIUM":1,"NONE":3,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":75}],"lensVersion":"2024-04-01","lensStatus":"CURRENT","hasUnansweredQuestions":false,"recommendations":[{"title":"How do you securely operate your workload?","pillarName":"Security","risk":"HIGH","improvementPlan":"Implement AWS Security Hub and enable automated security checks across all accounts.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_securely_operate.html"},{"title":"How do you manage identities for people and machines?","pillarName":"Security","risk":"HIGH","improvementPlan":"Centralize identity management using AWS IAM Identity Center and enforce least-privilege access.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities.html"},{"title":"How do you detect and investigate security events?","pillarName":"Security","risk":"HIGH","improvementPlan":"Enable AWS CloudTrail in all regions and configure Amazon GuardDuty for threat detection.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_detect_investigate_events.html"},{"title":"How do you protect your data at rest?","pillarName":"Security","risk":"HIGH","improvementPlan":"Enable encryption at rest for all data stores using AWS KMS customer managed keys.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_rest.html"},{"title":"How do you manage your usage to stay within budget?","pillarName":"Cost Optimization","risk":"HIGH","improvementPlan":"Implement AWS Budgets with alerts and use Cost Explorer to identify optimization opportunities.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_budget_mgmt.html"},{"title":"How do you select the best pricing model?","pillarName":"Cost Optimization","risk":"HIGH","improvementPlan":"Analyze usage patterns and purchase Savings Plans or Reserved Instances for steady-state workloads.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_pricing_model.html"},{"title":"How do you decommission resources that are no longer needed?","pillarName":"Cost Optimization","risk":"HIGH","improvementPlan":"Implement automated resource lifecycle policies and regularly audit for unused resources.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/cost_decomissioning.html"},{"title":"How do you select the best compute resources?","pillarName":"Performance Efficiency","risk":"HIGH","improvementPlan":"Benchmark workloads and right-size instances using AWS Compute Optimizer recommendations.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute.html"}]};

    var WORKLOAD_2 = {"workloadId":"sample-workload-002","workloadName":"Data Analytics Pipeline (Cost & Security Focused)","workloadArn":"arn:aws:wellarchitected:ap-southeast-2:123456789012:workload/sample-workload-002","description":"Data analytics pipeline with strong cost optimization and balanced security/performance but poor reliability and sustainability","environment":"PRODUCTION","ownerName":"Data Engineering Team","accountIds":["123456789012"],"regions":["us-east-1","eu-west-1"],"industry":"Technology","updatedAt":"2026-04-28T14:15:00Z","riskCounts":{"high":7,"medium":11,"compliant":26,"unanswered":0,"notApplicable":8},"overallCompliance":59,"pillars":[{"id":"operationalExcellence","name":"Operational Excellence","riskCounts":{"HIGH":1,"MEDIUM":3,"NONE":4,"UNANSWERED":0,"NOT_APPLICABLE":2},"compliance":50},{"id":"security","name":"Security","riskCounts":{"HIGH":1,"MEDIUM":2,"NONE":6,"UNANSWERED":0,"NOT_APPLICABLE":2},"compliance":67},{"id":"reliability","name":"Reliability","riskCounts":{"HIGH":3,"MEDIUM":3,"NONE":3,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":33},{"id":"performanceEfficiency","name":"Performance Efficiency","riskCounts":{"HIGH":1,"MEDIUM":2,"NONE":5,"UNANSWERED":0,"NOT_APPLICABLE":2},"compliance":63},{"id":"costOptimization","name":"Cost Optimization","riskCounts":{"HIGH":0,"MEDIUM":1,"NONE":7,"UNANSWERED":0,"NOT_APPLICABLE":1},"compliance":88},{"id":"sustainability","name":"Sustainability","riskCounts":{"HIGH":1,"MEDIUM":0,"NONE":1,"UNANSWERED":0,"NOT_APPLICABLE":0},"compliance":50}],"lensVersion":"2024-04-01","lensStatus":"CURRENT","hasUnansweredQuestions":false,"recommendations":[{"title":"How do you plan your network topology?","pillarName":"Reliability","risk":"HIGH","improvementPlan":"Implement multi-AZ architecture with redundant network paths and use AWS Transit Gateway for centralized routing.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_network_topology.html"},{"title":"How do you design your workload to withstand component failures?","pillarName":"Reliability","risk":"HIGH","improvementPlan":"Implement circuit breakers, retry logic with exponential backoff, and graceful degradation patterns.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_withstand_component_failures.html"},{"title":"How do you test reliability?","pillarName":"Reliability","risk":"HIGH","improvementPlan":"Implement chaos engineering practices using AWS Fault Injection Simulator and run regular game days.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_test_reliability.html"},{"title":"How do you select and use cloud resources in a way that reduces sustainability impact?","pillarName":"Sustainability","risk":"HIGH","improvementPlan":"Use managed services, Graviton processors, and schedule non-production workloads to run only during business hours.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_hardware.html"},{"title":"How do you protect your data in transit?","pillarName":"Security","risk":"HIGH","improvementPlan":"Enforce TLS 1.2+ for all data in transit and use VPC endpoints for AWS service communication.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit.html"},{"title":"How do you prepare for an event that affects availability?","pillarName":"Operational Excellence","risk":"HIGH","improvementPlan":"Create and regularly test runbooks for common failure scenarios and implement automated incident response.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_event_response.html"},{"title":"How do you use compute resources efficiently?","pillarName":"Performance Efficiency","risk":"HIGH","improvementPlan":"Implement auto-scaling policies based on demand patterns and use Spot Instances for fault-tolerant batch processing.","improvementPlanUrl":"https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/perf_compute_efficient.html"}]};

    var WORKLOADS_LIST = {"WorkloadSummaries":[{"WorkloadId":"sample-workload-001","WorkloadArn":"arn:aws:wellarchitected:ap-southeast-2:123456789012:workload/sample-workload-001","WorkloadName":"E-Commerce Platform (Ops & Reliability Focused)","Owner":"123456789012","UpdatedAt":"2026-05-01T10:30:00Z","RiskCounts":{"HIGH":8,"MEDIUM":12,"NONE":28,"UNANSWERED":0,"NOT_APPLICABLE":7}},{"WorkloadId":"sample-workload-002","WorkloadArn":"arn:aws:wellarchitected:ap-southeast-2:123456789012:workload/sample-workload-002","WorkloadName":"Data Analytics Pipeline (Cost & Security Focused)","Owner":"123456789012","UpdatedAt":"2026-04-28T14:15:00Z","RiskCounts":{"HIGH":7,"MEDIUM":11,"NONE":26,"UNANSWERED":0,"NOT_APPLICABLE":8}}]};

    var SAMPLE_WORKLOADS = {
        'sample-workload-001': WORKLOAD_1,
        'sample-workload-002': WORKLOAD_2,
        '_list': WORKLOADS_LIST
    };

    console.log('Demo mode: Sample data loaded (2 workloads embedded inline)');

    // Override the global API_ENDPOINT to use demo mode
    window.WA_API_ENDPOINT = 'DEMO_MODE';

    // Override fetch to intercept API calls
    var originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Only intercept calls to our demo endpoint
        if (url === 'DEMO_MODE' && options && options.method === 'POST') {
            var body = JSON.parse(options.body);
            var operation = body.operation;
            var params = body.params || {};

            console.log('Demo mode: Intercepted API call - ' + operation, params);

            // Simulate network delay
            return new Promise(function(resolve) {
                setTimeout(function() {
                    var responseData;

                    switch (operation) {
                        case 'list_workloads':
                            responseData = SAMPLE_WORKLOADS['_list'];
                            break;

                        case 'get_workload_data':
                            var workloadId = params.WorkloadId;
                            responseData = SAMPLE_WORKLOADS[workloadId];
                            if (!responseData) {
                                resolve(new Response(JSON.stringify({ error: 'Workload ' + workloadId + ' not found in demo data' }), {
                                    status: 404,
                                    headers: { 'Content-Type': 'application/json' }
                                }));
                                return;
                            }
                            break;

                        default:
                            responseData = { message: 'Demo mode: operation "' + operation + '" not supported in demo' };
                    }

                    resolve(new Response(JSON.stringify(responseData), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }, 300);
            });
        }

        // Pass through all other fetch calls
        return originalFetch.apply(this, arguments);
    };
})();
