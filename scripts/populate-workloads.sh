#!/bin/bash
# Populate Well-Architected workloads with answers to create demo risk profiles
# Workload 1: Good Ops/Reliability, Poor Security/Cost, Balanced Perf/Sustainability
# Workload 2: Good Cost, Balanced Security/Perf, Poor Reliability/Sustainability

PROFILE="mymlpg-audit"
REGION="ap-southeast-2"
WL1="efedbf3300a8ea6be8d648fbeca25952"
WL2="a22fe56bde587e928903e61f9e4c0644"

# Function to answer a question with ALL best practices (compliant)
answer_all() {
  local workload_id=$1
  local question_id=$2
  
  choices=$(aws wellarchitected get-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Choices[?!ends_with(ChoiceId, `_no`)].ChoiceId' \
    --output json 2>/dev/null)
  
  if [ -z "$choices" ] || [ "$choices" = "[]" ]; then
    echo "  SKIP $question_id (no choices found)"
    return
  fi
  
  risk=$(aws wellarchitected update-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --selected-choices "$choices" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Risk' \
    --output text 2>/dev/null)
  
  echo "  $question_id -> $risk"
}

# Function to answer a question with NONE of the best practices (high risk)
answer_none() {
  local workload_id=$1
  local question_id=$2
  
  # Find the "none of these" choice
  none_choice=$(aws wellarchitected get-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Choices[?ends_with(ChoiceId, `_no`)].ChoiceId | [0]' \
    --output text 2>/dev/null)
  
  if [ -z "$none_choice" ] || [ "$none_choice" = "None" ]; then
    echo "  SKIP $question_id (no 'none' choice found)"
    return
  fi
  
  risk=$(aws wellarchitected update-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --selected-choices "[\"$none_choice\"]" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Risk' \
    --output text 2>/dev/null)
  
  echo "  $question_id -> $risk"
}

# Function to answer with roughly half the best practices (medium risk)
answer_half() {
  local workload_id=$1
  local question_id=$2
  
  # Get first 2 choices (partial compliance)
  choices=$(aws wellarchitected get-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Choices[?!ends_with(ChoiceId, `_no`)].ChoiceId | [:2]' \
    --output json 2>/dev/null)
  
  if [ -z "$choices" ] || [ "$choices" = "[]" ]; then
    echo "  SKIP $question_id (no choices found)"
    return
  fi
  
  risk=$(aws wellarchitected update-answer \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --question-id "$question_id" \
    --selected-choices "$choices" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Answer.Risk' \
    --output text 2>/dev/null)
  
  echo "  $question_id -> $risk"
}

# Get all questions per pillar
get_questions() {
  local workload_id=$1
  local pillar_id=$2
  
  aws wellarchitected list-answers \
    --workload-id "$workload_id" \
    --lens-alias wellarchitected \
    --pillar-id "$pillar_id" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'AnswerSummaries[].QuestionId' \
    --output text 2>/dev/null
}

echo "=== WORKLOAD 1: E-Commerce Platform ==="
echo ""

echo "Operational Excellence (GOOD - all compliant):"
for q in $(get_questions $WL1 operationalExcellence); do
  answer_all $WL1 "$q"
done

echo ""
echo "Reliability (GOOD - all compliant):"
for q in $(get_questions $WL1 reliability); do
  answer_all $WL1 "$q"
done

echo ""
echo "Security (POOR - none selected):"
for q in $(get_questions $WL1 security); do
  answer_none $WL1 "$q"
done

echo ""
echo "Cost Optimization (POOR - none selected):"
for q in $(get_questions $WL1 costOptimization); do
  answer_none $WL1 "$q"
done

echo ""
echo "Performance Efficiency (BALANCED - half selected):"
for q in $(get_questions $WL1 performanceEfficiency); do
  answer_half $WL1 "$q"
done

echo ""
echo "Sustainability (BALANCED - half selected):"
for q in $(get_questions $WL1 sustainability); do
  answer_half $WL1 "$q"
done

echo ""
echo "=== WORKLOAD 2: Data Analytics Pipeline ==="
echo ""

echo "Cost Optimization (GOOD - all compliant):"
for q in $(get_questions $WL2 costOptimization); do
  answer_all $WL2 "$q"
done

echo ""
echo "Security (BALANCED - half selected):"
for q in $(get_questions $WL2 security); do
  answer_half $WL2 "$q"
done

echo ""
echo "Performance Efficiency (BALANCED - half selected):"
for q in $(get_questions $WL2 performanceEfficiency); do
  answer_half $WL2 "$q"
done

echo ""
echo "Reliability (POOR - none selected):"
for q in $(get_questions $WL2 reliability); do
  answer_none $WL2 "$q"
done

echo ""
echo "Sustainability (POOR - none selected):"
for q in $(get_questions $WL2 sustainability); do
  answer_none $WL2 "$q"
done

echo ""
echo "Operational Excellence (BALANCED - half selected):"
for q in $(get_questions $WL2 operationalExcellence); do
  answer_half $WL2 "$q"
done

echo ""
echo "Done! Both workloads populated."
