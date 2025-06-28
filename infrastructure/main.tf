# infrastructure/main.tf
# ENHANCED: Main Terraform configuration with improved Cognito setup and error handling

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Random suffix for unique resource names
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# ===== S3 BUCKETS =====

# Request bucket for translation inputs
resource "aws_s3_bucket" "request_bucket" {
  bucket = "${var.project_name}-requests-${random_string.suffix.result}"

  tags = merge(local.common_tags, {
    Name = "Translation Requests Bucket"
    Type = "Storage"
  })
}

# Response bucket for translation outputs
resource "aws_s3_bucket" "response_bucket" {
  bucket = "${var.project_name}-responses-${random_string.suffix.result}"

  tags = merge(local.common_tags, {
    Name = "Translation Responses Bucket"
    Type = "Storage"
  })
}

# Frontend hosting bucket
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "${var.project_name}-frontend-${random_string.suffix.result}"

  tags = merge(local.common_tags, {
    Name = "Frontend Hosting Bucket"
    Type = "Storage"
  })
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "request_bucket_versioning" {
  bucket = aws_s3_bucket.request_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "response_bucket_versioning" {
  bucket = aws_s3_bucket.response_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "request_bucket_pab" {
  bucket = aws_s3_bucket.request_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "response_bucket_pab" {
  bucket = aws_s3_bucket.response_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configurations
resource "aws_s3_bucket_lifecycle_configuration" "request_bucket_lifecycle" {
  bucket = aws_s3_bucket.request_bucket.id

  rule {
    id     = "delete_old_requests"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = var.s3_lifecycle_requests_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "response_bucket_lifecycle" {
  bucket = aws_s3_bucket.response_bucket.id

  rule {
    id     = "delete_old_responses"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = var.s3_lifecycle_responses_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# S3 CORS configurations
resource "aws_s3_bucket_cors_configuration" "request_bucket_cors" {
  bucket = aws_s3_bucket.request_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "response_bucket_cors" {
  bucket = aws_s3_bucket.response_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "frontend_bucket_cors" {
  bucket = aws_s3_bucket.frontend_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "request_bucket_encryption" {
  bucket = aws_s3_bucket.request_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "response_bucket_encryption" {
  bucket = aws_s3_bucket.response_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ===== DYNAMODB TABLES =====

# User data table
resource "aws_dynamodb_table" "user_data" {
  name         = "${var.project_name}-user-data"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "translation_id"
    type = "S"
  }

  global_secondary_index {
    name            = "TranslationIndex"
    hash_key        = "translation_id"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "User Data Table"
    Type = "Database"
  })
}

# Translation metadata table
resource "aws_dynamodb_table" "translation_metadata" {
  name         = "${var.project_name}-translations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "translation_id"

  attribute {
    name = "translation_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "user_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "Translation Metadata Table"
    Type = "Database"
  })
}

# ===== IAM ROLES AND POLICIES =====

# Lambda execution role
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "Lambda Execution Role"
    Type = "IAM"
  })
}

# Enhanced Lambda policy with comprehensive permissions
resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.project_name}-lambda-policy-${random_string.suffix.result}"
  description = "Enhanced policy for Lambda function with comprehensive AWS service access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogsAccess"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams",
          "logs:DescribeLogGroups"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Sid    = "S3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion",
          "s3:PutObjectAcl"
        ]
        Resource = [
          "${aws_s3_bucket.request_bucket.arn}/*",
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      },
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketVersioning"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          aws_s3_bucket.response_bucket.arn
        ]
      },
      {
        Sid    = "TranslateAccess"
        Effect = "Allow"
        Action = [
          "translate:TranslateText",
          "translate:DescribeTextTranslationJob",
          "translate:StartTextTranslationJob",
          "translate:StopTextTranslationJob",
          "translate:GetTerminology",
          "translate:ListTerminologies",
          "translate:ListLanguages"
        ]
        Resource = "*"
      },
      {
        Sid    = "XRayAccess"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      },
      {
        Sid    = "SQSAccess"
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.lambda_dlq.arn
      }
    ]
  })

  tags = local.common_tags
}

# Separate DynamoDB policy for better organization
resource "aws_iam_policy" "lambda_dynamodb_policy" {
  name        = "${var.project_name}-lambda-dynamodb-policy-${random_string.suffix.result}"
  description = "DynamoDB access policy for Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:DescribeTable"
        ]
        Resource = [
          aws_dynamodb_table.user_data.arn,
          aws_dynamodb_table.translation_metadata.arn,
          "${aws_dynamodb_table.user_data.arn}/index/*",
          "${aws_dynamodb_table.translation_metadata.arn}/index/*"
        ]
      }
    ]
  })

  tags = local.common_tags
}

# Attach policies to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy.arn
}

# ===== LAMBDA FUNCTION =====

# Dead letter queue for Lambda (must be defined before Lambda function)
resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${var.project_name}-lambda-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(local.common_tags, {
    Name = "Lambda Dead Letter Queue"
    Type = "Queue"
  })
}

# Package Lambda function
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/../lambda/lambda_deployment.zip"
  excludes    = ["*.pyc", "__pycache__", "*.zip", "*.git*", ".DS_Store"]
}

# CloudWatch log group for Lambda
resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/${var.project_name}-translate-function"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "Lambda Log Group"
    Type = "Monitoring"
  })
}

# Lambda function
resource "aws_lambda_function" "translate_function" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "${var.project_name}-translate-function"
  role          = aws_iam_role.lambda_role.arn
  handler       = "translate_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      REQUEST_BUCKET    = aws_s3_bucket.request_bucket.bucket
      RESPONSE_BUCKET   = aws_s3_bucket.response_bucket.bucket
      USER_DATA_TABLE   = aws_dynamodb_table.user_data.name
      TRANSLATION_TABLE = aws_dynamodb_table.translation_metadata.name
      REGION            = data.aws_region.current.name
      LOG_LEVEL         = "INFO"
      ENVIRONMENT       = var.environment
    }
  }

  # Enable X-Ray tracing
  tracing_config {
    mode = "Active"
  }

  # Enable dead letter queue
  dead_letter_config {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }

  tags = merge(local.common_tags, {
    Name = "Translation Function"
    Type = "Compute"
  })

  depends_on = [
    aws_iam_role_policy_attachment.lambda_policy_attachment,
    aws_iam_role_policy_attachment.lambda_dynamodb_policy_attachment,
    aws_cloudwatch_log_group.lambda_log_group
  ]
}

# Dead letter queue for Lambda
resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${var.project_name}-lambda-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = merge(local.common_tags, {
    Name = "Lambda Dead Letter Queue"
    Type = "Queue"
  })
}

# Lambda permission for S3 trigger
resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.translate_function.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.request_bucket.arn
}

# S3 bucket notification
resource "aws_s3_bucket_notification" "request_bucket_notification" {
  bucket = aws_s3_bucket.request_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.translate_function.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = ""
    filter_suffix       = ".json"
  }

  depends_on = [aws_lambda_permission.allow_bucket]
}

# ===== COGNITO AUTHENTICATION =====

# ENHANCED: Cognito User Pool with improved configuration for email-only authentication
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  # FIXED: Email-only authentication configuration
  # Note: username_attributes and alias_attributes cannot be used together
  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  # Enhanced password policy
  password_policy {
    minimum_length                   = var.cognito_password_minimum_length
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # Account recovery configuration
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "ENFORCED"
  }

  # Device configuration
  device_configuration {
    challenge_required_on_new_device      = false
    device_only_remembered_on_user_prompt = false
  }

  # Email verification configuration
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "AWS Translate - Verify your email"
    email_message        = "Your verification code for AWS Translate is {####}"
  }

  # FIXED: Schema configuration for email-only authentication
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                     = "name"
    attribute_data_type      = "String"
    required                 = false
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  tags = merge(local.common_tags, {
    Name = "User Pool"
    Type = "Authentication"
  })
}

# ENHANCED: Cognito User Pool Client with proper configuration
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-user-pool-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # FIXED: Authentication flows for email-only authentication
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  # Token validity configuration
  access_token_validity  = var.cognito_token_validity_hours
  id_token_validity      = var.cognito_token_validity_hours
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Security configuration
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  # OAuth configuration
  supported_identity_providers = ["COGNITO"]

  # Read and write attributes
  read_attributes  = ["email", "name", "email_verified"]
  write_attributes = ["email", "name"]

  # Note: aws_cognito_user_pool_client does not support tags
}

# ENHANCED: Cognito Identity Pool with improved configuration
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.main.id
    provider_name = aws_cognito_user_pool.main.endpoint
  }

  tags = merge(local.common_tags, {
    Name = "Identity Pool"
    Type = "Authentication"
  })
}

# Authenticated user role
resource "aws_iam_role" "authenticated_role" {
  name = "${var.project_name}-authenticated-role-${random_string.suffix.result}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "Authenticated User Role"
    Type = "IAM"
  })
}

# Enhanced authenticated user policy
resource "aws_iam_policy" "authenticated_policy" {
  name        = "${var.project_name}-authenticated-policy-${random_string.suffix.result}"
  description = "Enhanced policy for authenticated users with secure S3 and API access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.request_bucket.arn}/*",
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
        Condition = {
          StringLike = {
            "s3:ExistingObjectTag/user-id" = ["$${cognito-identity.amazonaws.com:sub}", "public"]
          }
        }
      },
      {
        Sid    = "S3BucketListing"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          aws_s3_bucket.response_bucket.arn
        ]
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "public/*",
              "private/$${cognito-identity.amazonaws.com:sub}/*"
            ]
          }
        }
      },
      {
        Sid    = "APIGatewayAccess"
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = "${aws_api_gateway_rest_api.translate_api.execution_arn}/*/*"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "authenticated_policy_attachment" {
  role       = aws_iam_role.authenticated_role.name
  policy_arn = aws_iam_policy.authenticated_policy.arn
}

# Identity pool role attachment
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.authenticated_role.arn
  }
}

# ===== API GATEWAY =====

# REST API
resource "aws_api_gateway_rest_api" "translate_api" {
  name        = "${var.project_name}-translate-api"
  description = "Enhanced API Gateway for translation service with comprehensive CORS support"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(local.common_tags, {
    Name = "Translation API"
    Type = "API"
  })
}

# API Gateway resource
resource "aws_api_gateway_resource" "translate_resource" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  parent_id   = aws_api_gateway_rest_api.translate_api.root_resource_id
  path_part   = "translate"
}

# POST method
resource "aws_api_gateway_method" "translate_method" {
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  resource_id   = aws_api_gateway_resource.translate_resource.id
  http_method   = "POST"
  authorization = "AWS_IAM"

  request_parameters = {
    "method.request.header.Content-Type" = true
  }
}

# OPTIONS method for CORS
resource "aws_api_gateway_method" "translate_options" {
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  resource_id   = aws_api_gateway_resource.translate_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Lambda integration
resource "aws_api_gateway_integration" "translate_integration" {
  rest_api_id             = aws_api_gateway_rest_api.translate_api.id
  resource_id             = aws_api_gateway_resource.translate_resource.id
  http_method             = aws_api_gateway_method.translate_method.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.translate_function.invoke_arn

  timeout_milliseconds = 29000
}

# OPTIONS integration for CORS
resource "aws_api_gateway_integration" "translate_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Method responses
resource "aws_api_gateway_method_response" "translate_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_method.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

resource "aws_api_gateway_method_response" "translate_options_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

# Integration responses
resource "aws_api_gateway_integration_response" "translate_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_method.http_method
  status_code = aws_api_gateway_method_response.translate_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
  }

  depends_on = [aws_api_gateway_integration.translate_integration]
}

resource "aws_api_gateway_integration_response" "translate_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  status_code = aws_api_gateway_method_response.translate_options_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT,DELETE'"
  }

  depends_on = [aws_api_gateway_integration.translate_options_integration]
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.translate_function.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.translate_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "translate_deployment" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id

  depends_on = [
    aws_api_gateway_method.translate_method,
    aws_api_gateway_method.translate_options,
    aws_api_gateway_integration.translate_integration,
    aws_api_gateway_integration.translate_options_integration,
    aws_api_gateway_method_response.translate_response,
    aws_api_gateway_method_response.translate_options_response,
    aws_api_gateway_integration_response.translate_integration_response,
    aws_api_gateway_integration_response.translate_options_integration_response
  ]

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.translate_resource.id,
      aws_api_gateway_method.translate_method.id,
      aws_api_gateway_method.translate_options.id,
      aws_api_gateway_integration.translate_integration.id,
      aws_api_gateway_integration.translate_options_integration.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway stage
resource "aws_api_gateway_stage" "translate_stage" {
  deployment_id = aws_api_gateway_deployment.translate_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.translate_api.id
  stage_name    = var.environment

  # Enable logging if specified
  dynamic "access_log_settings" {
    for_each = var.enable_api_gateway_logs ? [1] : []
    content {
      destination_arn = aws_cloudwatch_log_group.api_gateway_logs[0].arn
      format = jsonencode({
        requestId      = "$requestId"
        ip             = "$sourceIp"
        caller         = "$caller"
        user           = "$user"
        requestTime    = "$requestTime"
        httpMethod     = "$httpMethod"
        resourcePath   = "$resourcePath"
        status         = "$status"
        protocol       = "$protocol"
        responseLength = "$responseLength"
      })
    }
  }

  tags = merge(local.common_tags, {
    Name = "Translation API Stage"
    Type = "API"
  })
}

# API Gateway CloudWatch log group
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  count             = var.enable_api_gateway_logs ? 1 : 0
  name              = "/aws/apigateway/${var.project_name}-translate-api"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "API Gateway Log Group"
    Type = "Monitoring"
  })
}

# ===== CLOUDFRONT DISTRIBUTION =====

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "Enhanced OAC for frontend S3 bucket with security headers"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Enhanced CloudFront distribution
resource "aws_cloudfront_distribution" "frontend_distribution" {
  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  enabled             = true
  is_ipv6_enabled     = var.enable_cloudfront_ipv6
  default_root_object = "index.html"
  comment             = "CloudFront distribution for ${var.project_name} frontend"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # Service worker cache behavior
  ordered_cache_behavior {
    path_pattern           = "/service-worker.js"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = false
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
      headers = ["Content-Type"]
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 300
  }

  # Static assets cache behavior
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 86400
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # Manifest cache behavior
  ordered_cache_behavior {
    path_pattern           = "/manifest.json"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
      headers = ["Content-Type"]
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  price_class = var.cloudfront_price_class

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # Enhanced error pages
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 300
  }

  tags = merge(local.common_tags, {
    Name = "Frontend Distribution"
    Type = "CDN"
  })
}

# S3 bucket policy for CloudFront
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn
          }
        }
      }
    ]
  })
}

# ===== MONITORING AND ALARMS =====

# CloudWatch alarm for Lambda errors
resource "aws_cloudwatch_metric_alarm" "lambda_error_alarm" {
  alarm_name          = "${var.project_name}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.translate_function.function_name
  }

  tags = local.common_tags
}

# CloudWatch alarm for Lambda duration
resource "aws_cloudwatch_metric_alarm" "lambda_duration_alarm" {
  alarm_name          = "${var.project_name}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "60"
  statistic           = "Average"
  threshold           = "30000"
  alarm_description   = "This metric monitors lambda duration"
  alarm_actions       = []

  dimensions = {
    FunctionName = aws_lambda_function.translate_function.function_name
  }

  tags = local.common_tags
}