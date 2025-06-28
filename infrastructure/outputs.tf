# infrastructure/outputs.tf
# SIMPLIFIED: Essential outputs for frontend configuration

# S3 Bucket outputs
output "request_bucket_name" {
  description = "Name of the S3 bucket for translation requests"
  value       = aws_s3_bucket.request_bucket.bucket
}

output "response_bucket_name" {
  description = "Name of the S3 bucket for translation responses"
  value       = aws_s3_bucket.response_bucket.bucket
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket for frontend hosting"
  value       = aws_s3_bucket.frontend_bucket.bucket
}

# Cognito outputs (required for frontend)
output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
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

# API Gateway output
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.translate_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
}

# CloudFront output
output "frontend_url" {
  description = "URL to access the frontend application"
  value       = "https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"
}

# CloudFront distribution ID (for cache invalidation)
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend_distribution.id
}