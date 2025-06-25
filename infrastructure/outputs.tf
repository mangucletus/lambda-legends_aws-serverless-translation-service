# infrastructure/outputs.tf
# Terraform output values for AWS Translate Application

# S3 Bucket Outputs
output "request_bucket_name" {
  description = "Name of the S3 bucket for translation requests"
  value       = aws_s3_bucket.request_bucket.bucket
}

output "request_bucket_arn" {
  description = "ARN of the S3 bucket for translation requests"
  value       = aws_s3_bucket.request_bucket.arn
}

output "response_bucket_name" {
  description = "Name of the S3 bucket for translation responses"
  value       = aws_s3_bucket.response_bucket.bucket
}

output "response_bucket_arn" {
  description = "ARN of the S3 bucket for translation responses"
  value       = aws_s3_bucket.response_bucket.arn
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend hosting"
  value       = aws_s3_bucket.frontend_bucket.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket for frontend hosting"
  value       = aws_s3_bucket.frontend_bucket.arn
}

# Lambda Function Outputs
output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.translate_function.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.translate_function.arn
}

output "lambda_function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.translate_function.invoke_arn
}

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "ARN of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_client_id" {
  description = "ID of the Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.main.id
  sensitive   = true
}

output "cognito_identity_pool_id" {
  description = "ID of the Cognito Identity Pool"
  value       = aws_cognito_identity_pool.main.id
}

output "cognito_user_pool_domain" {
  description = "Domain name of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.domain
}

# API Gateway Outputs
output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.translate_api.id
}

output "api_gateway_execution_arn" {
  description = "Execution ARN of the API Gateway"
  value       = aws_api_gateway_rest_api.translate_api.execution_arn
}

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.translate_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
}

output "api_gateway_stage_name" {
  description = "Stage name of the API Gateway deployment"
  value       = aws_api_gateway_stage.translate_stage.stage_name
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend_distribution.id
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend_distribution.arn
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend_distribution.domain_name
}

output "frontend_url" {
  description = "Complete URL to access the frontend application"
  value       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"
}

# IAM Role Outputs
output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_role.arn
}

output "authenticated_role_arn" {
  description = "ARN of the authenticated user role"
  value       = aws_iam_role.authenticated_role.arn
}

# CloudWatch Outputs
output "lambda_log_group_name" {
  description = "Name of the Lambda function CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda_log_group.name
}

output "lambda_log_group_arn" {
  description = "ARN of the Lambda function CloudWatch log group"
  value       = aws_cloudwatch_log_group.lambda_log_group.arn
}

# Random Suffix Output
output "resource_suffix" {
  description = "Random suffix used for resource naming"
  value       = random_string.suffix.result
}

# AWS Account and Region Info
output "aws_account_id" {
  description = "AWS Account ID where resources are created"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS Region where resources are created"
  value       = data.aws_region.current.name
}

# Configuration for Frontend Application
output "frontend_config" {
  description = "Configuration object for the React frontend application"
  value = {
    region              = data.aws_region.current.name
    userPoolId          = aws_cognito_user_pool.main.id
    userPoolWebClientId = aws_cognito_user_pool_client.main.id
    identityPoolId      = aws_cognito_identity_pool.main.id
    apiGatewayUrl       = "https://${aws_api_gateway_rest_api.translate_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
    requestBucketName   = aws_s3_bucket.request_bucket.bucket
    responseBucketName  = aws_s3_bucket.response_bucket.bucket
    cloudfrontUrl       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"
  }
  sensitive = true
}

# Project Information
output "project_info" {
  description = "Project metadata and information"
  value = {
    project_name         = var.project_name
    environment          = var.environment
    terraform_version    = "~> 1.0"
    aws_provider_version = "~> 5.0"
    deployment_timestamp = timestamp()
  }
}

# Resource Summary
output "resource_summary" {
  description = "Summary of created AWS resources"
  value = {
    s3_buckets = {
      request_bucket  = aws_s3_bucket.request_bucket.bucket
      response_bucket = aws_s3_bucket.response_bucket.bucket
      frontend_bucket = aws_s3_bucket.frontend_bucket.bucket
    }
    lambda_functions = {
      translate_function = aws_lambda_function.translate_function.function_name
    }
    cognito_resources = {
      user_pool     = aws_cognito_user_pool.main.id
      identity_pool = aws_cognito_identity_pool.main.id
    }
    api_gateway             = aws_api_gateway_rest_api.translate_api.id
    cloudfront_distribution = aws_cloudfront_distribution.frontend_distribution.id
  }
}