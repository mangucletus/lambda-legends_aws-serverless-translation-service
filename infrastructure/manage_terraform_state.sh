#!/bin/bash
# infrastructure/manage_terraform_state.sh
# Script to handle existing resources and state management

set -e

# Configuration
PROJECT_NAME="aws-translate-app"
ENVIRONMENT="dev"
AWS_REGION="${AWS_REGION:-us-east-1}"
SUFFIX="toqpxguz"

echo "🔧 Managing Terraform state for AWS Translate Application"
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Suffix: $SUFFIX"

# Function to check if resource exists in AWS
check_resource_exists() {
    local resource_type=$1
    local resource_name=$2
    
    case $resource_type in
        "iam_policy")
            aws iam get-policy --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/$resource_name" >/dev/null 2>&1
            ;;
        "iam_role")
            aws iam get-role --role-name "$resource_name" >/dev/null 2>&1
            ;;
        "lambda_function")
            aws lambda get-function --function-name "$resource_name" >/dev/null 2>&1
            ;;
        "s3_bucket")
            aws s3api head-bucket --bucket "$resource_name" >/dev/null 2>&1
            ;;
        "cognito_user_pool")
            aws cognito-idp describe-user-pool --user-pool-id "$resource_name" >/dev/null 2>&1
            ;;
        "dynamodb_table")
            aws dynamodb describe-table --table-name "$resource_name" >/dev/null 2>&1
            ;;
        "api_gateway")
            aws apigateway get-rest-api --rest-api-id "$resource_name" >/dev/null 2>&1
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to check if resource exists in Terraform state
check_state_exists() {
    local resource_address=$1
    terraform state show "$resource_address" >/dev/null 2>&1
}

# Function to import existing resource
import_resource() {
    local resource_address=$1
    local resource_id=$2
    
    echo "  📥 Importing $resource_address with ID: $resource_id"
    
    if check_state_exists "$resource_address"; then
        echo "  ✅ Resource already in state: $resource_address"
    else
        if terraform import "$resource_address" "$resource_id"; then
            echo "  ✅ Successfully imported: $resource_address"
        else
            echo "  ❌ Failed to import: $resource_address"
            return 1
        fi
    fi
}

# Function to remove resource from state if it needs to be recreated
remove_from_state() {
    local resource_address=$1
    
    echo "  🗑️  Removing $resource_address from state for recreation"
    
    if check_state_exists "$resource_address"; then
        if terraform state rm "$resource_address"; then
            echo "  ✅ Successfully removed from state: $resource_address"
        else
            echo "  ❌ Failed to remove from state: $resource_address"
            return 1
        fi
    else
        echo "  ℹ️  Resource not in state: $resource_address"
    fi
}

# Function to delete AWS resource if needed
delete_aws_resource() {
    local resource_type=$1
    local resource_name=$2
    
    echo "  🗑️  Deleting AWS resource: $resource_name"
    
    case $resource_type in
        "iam_policy")
            # Detach from roles first
            local account_id=$(aws sts get-caller-identity --query Account --output text)
            local policy_arn="arn:aws:iam::$account_id:policy/$resource_name"
            
            # List and detach from roles
            aws iam list-entities-for-policy --policy-arn "$policy_arn" --query 'PolicyRoles[].RoleName' --output text | while read -r role_name; do
                if [ ! -z "$role_name" ]; then
                    echo "    🔗 Detaching policy from role: $role_name"
                    aws iam detach-role-policy --role-name "$role_name" --policy-arn "$policy_arn" || true
                fi
            done
            
            # Delete the policy
            aws iam delete-policy --policy-arn "$policy_arn" || true
            ;;
        "lambda_function")
            aws lambda delete-function --function-name "$resource_name" || true
            ;;
        *)
            echo "  ⚠️  Don't know how to delete resource type: $resource_type"
            ;;
    esac
}

# Initialize Terraform if not already done
echo "🚀 Initializing Terraform..."
terraform init

# Get current account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Handle existing resources
echo ""
echo "🔍 Checking for existing resources..."

# 1. Random string (import if exists in state, otherwise will use existing value)
echo "1️⃣ Handling random_string.suffix..."
if ! check_state_exists "random_string.suffix"; then
    echo "  📥 Random string not in state, will be managed by lifecycle rules"
fi

# 2. IAM Policies - these need special handling due to description change
echo "2️⃣ Handling IAM policies..."

LAMBDA_POLICY_NAME="${PROJECT_NAME}-lambda-policy-${SUFFIX}"
LAMBDA_DYNAMODB_POLICY_NAME="${PROJECT_NAME}-lambda-dynamodb-policy-${SUFFIX}"

# Check Lambda policy
if check_resource_exists "iam_policy" "$LAMBDA_POLICY_NAME"; then
    echo "  🔍 Found existing Lambda policy: $LAMBDA_POLICY_NAME"
    
    # Get current policy document
    POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$LAMBDA_POLICY_NAME"
    CURRENT_DESCRIPTION=$(aws iam get-policy --policy-arn "$POLICY_ARN" --query 'Policy.Description' --output text)
    
    # Check if description matches what we want
    if [[ "$CURRENT_DESCRIPTION" == *"DynamoDB"* ]]; then
        echo "  ⚠️  Policy description needs update, will recreate"
        remove_from_state "aws_iam_policy.lambda_policy"
        delete_aws_resource "iam_policy" "$LAMBDA_POLICY_NAME"
    else
        echo "  ✅ Policy description is correct"
        import_resource "aws_iam_policy.lambda_policy" "$POLICY_ARN"
    fi
else
    echo "  ℹ️  Lambda policy does not exist, will be created"
fi

# Check Lambda DynamoDB policy
if check_resource_exists "iam_policy" "$LAMBDA_DYNAMODB_POLICY_NAME"; then
    echo "  🔍 Found existing Lambda DynamoDB policy: $LAMBDA_DYNAMODB_POLICY_NAME"
    POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$LAMBDA_DYNAMODB_POLICY_NAME"
    import_resource "aws_iam_policy.lambda_dynamodb_policy" "$POLICY_ARN"
else
    echo "  ℹ️  Lambda DynamoDB policy does not exist, will be created"
fi

# 3. IAM Role
echo "3️⃣ Handling IAM role..."
LAMBDA_ROLE_NAME="${PROJECT_NAME}-lambda-role-${SUFFIX}"
if check_resource_exists "iam_role" "$LAMBDA_ROLE_NAME"; then
    echo "  🔍 Found existing Lambda role: $LAMBDA_ROLE_NAME"
    import_resource "aws_iam_role.lambda_role" "$LAMBDA_ROLE_NAME"
else
    echo "  ℹ️  Lambda role does not exist, will be created"
fi

# 4. S3 Buckets
echo "4️⃣ Handling S3 buckets..."
BUCKETS=(
    "request_bucket:${PROJECT_NAME}-requests-${SUFFIX}"
    "response_bucket:${PROJECT_NAME}-responses-${SUFFIX}"
    "frontend_bucket:${PROJECT_NAME}-frontend-${SUFFIX}"
)

for bucket_info in "${BUCKETS[@]}"; do
    IFS=':' read -r bucket_resource bucket_name <<< "$bucket_info"
    
    if check_resource_exists "s3_bucket" "$bucket_name"; then
        echo "  🔍 Found existing S3 bucket: $bucket_name"
        import_resource "aws_s3_bucket.$bucket_resource" "$bucket_name"
    else
        echo "  ℹ️  S3 bucket does not exist: $bucket_name"
    fi
done

# 5. DynamoDB Tables
echo "5️⃣ Handling DynamoDB tables..."
TABLES=(
    "user_data:${PROJECT_NAME}-user-data"
    "translation_metadata:${PROJECT_NAME}-translations"
)

for table_info in "${TABLES[@]}"; do
    IFS=':' read -r table_resource table_name <<< "$table_info"
    
    if check_resource_exists "dynamodb_table" "$table_name"; then
        echo "  🔍 Found existing DynamoDB table: $table_name"
        import_resource "aws_dynamodb_table.$table_resource" "$table_name"
    else
        echo "  ℹ️  DynamoDB table does not exist: $table_name"
    fi
done

# 6. Lambda Function
echo "6️⃣ Handling Lambda function..."
LAMBDA_FUNCTION_NAME="${PROJECT_NAME}-translate-function"
if check_resource_exists "lambda_function" "$LAMBDA_FUNCTION_NAME"; then
    echo "  🔍 Found existing Lambda function: $LAMBDA_FUNCTION_NAME"
    import_resource "aws_lambda_function.translate_function" "$LAMBDA_FUNCTION_NAME"
else
    echo "  ℹ️  Lambda function does not exist, will be created"
fi

# 7. API Gateway
echo "7️⃣ Handling API Gateway..."
# Note: API Gateway import requires the API ID, which we need to discover
API_NAME="${PROJECT_NAME}-translate-api"
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id" --output text 2>/dev/null || echo "")

if [ ! -z "$API_ID" ] && [ "$API_ID" != "None" ]; then
    echo "  🔍 Found existing API Gateway: $API_NAME (ID: $API_ID)"
    import_resource "aws_api_gateway_rest_api.translate_api" "$API_ID"
else
    echo "  ℹ️  API Gateway does not exist, will be created"
fi

# 8. Cognito Resources
echo "8️⃣ Handling Cognito resources..."
USER_POOL_NAME="${PROJECT_NAME}-user-pool"
USER_POOLS=$(aws cognito-idp list-user-pools --max-items 50 --query "UserPools[?Name=='$USER_POOL_NAME'].Id" --output text 2>/dev/null || echo "")

if [ ! -z "$USER_POOLS" ] && [ "$USER_POOLS" != "None" ]; then
    echo "  🔍 Found existing Cognito User Pool: $USER_POOL_NAME"
    import_resource "aws_cognito_user_pool.main" "$USER_POOLS"
    
    # Also try to import the client
    CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOLS" --query "UserPoolClients[0].ClientId" --output text 2>/dev/null || echo "")
    if [ ! -z "$CLIENT_ID" ] && [ "$CLIENT_ID" != "None" ]; then
        import_resource "aws_cognito_user_pool_client.main" "$CLIENT_ID"
    fi
else
    echo "  ℹ️  Cognito User Pool does not exist, will be created"
fi

echo ""
echo "✅ Resource management completed!"
echo ""
echo "🚀 Ready to run terraform apply"
echo ""

# Optional: Show current state
echo "📋 Current Terraform state:"
terraform state list || echo "No resources in state yet"

echo ""
echo "💡 Next steps:"
echo "   1. Run: terraform plan"
echo "   2. Review the plan carefully"
echo "   3. Run: terraform apply"