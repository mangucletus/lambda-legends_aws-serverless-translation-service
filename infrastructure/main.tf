# infrastructure/main.tf
# FIXED: Enhanced infrastructure with proper CORS and API Gateway configuration

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
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
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
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

# Request bucket
resource "aws_s3_bucket" "request_bucket" {
  bucket = "${var.project_name}-requests-${random_string.suffix.result}"
}

# Response bucket
resource "aws_s3_bucket" "response_bucket" {
  bucket = "${var.project_name}-responses-${random_string.suffix.result}"
}

# Frontend hosting bucket
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "${var.project_name}-frontend-${random_string.suffix.result}"
}

# S3 bucket CORS configuration for all buckets
# Request bucket CORS - for translation request uploads
resource "aws_s3_bucket_cors_configuration" "request_bucket_cors" {
  bucket = aws_s3_bucket.request_bucket.id

  cors_rule {
    allowed_headers = [
      "*",
      "Authorization",
      "Content-Type",
      "X-Amz-Date",
      "X-Amz-Security-Token",
      "X-Amz-User-Agent",
      "x-amz-content-sha256",
      "x-amz-date",
      "x-amz-user-agent"
    ]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag", "x-amz-meta-custom-header"]
    max_age_seconds = 3600
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

# Response bucket CORS - for translation response downloads
resource "aws_s3_bucket_cors_configuration" "response_bucket_cors" {
  bucket = aws_s3_bucket.response_bucket.id

  cors_rule {
    allowed_headers = [
      "*",
      "Authorization",
      "Content-Type",
      "X-Amz-Date",
      "X-Amz-Security-Token",
      "X-Amz-User-Agent",
      "x-amz-content-sha256",
      "x-amz-date",
      "x-amz-user-agent"
    ]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag", "x-amz-meta-custom-header"]
    max_age_seconds = 3600
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

# Frontend bucket CORS - for frontend asset serving and potential uploads
resource "aws_s3_bucket_cors_configuration" "frontend_bucket_cors" {
  bucket = aws_s3_bucket.frontend_bucket.id

  cors_rule {
    allowed_headers = [
      "*",
      "Authorization",
      "Content-Type",
      "X-Amz-Date",
      "X-Amz-Security-Token",
      "X-Amz-User-Agent",
      "x-amz-content-sha256",
      "x-amz-date",
      "x-amz-user-agent"
    ]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag", "x-amz-meta-custom-header", "x-amz-version-id"]
    max_age_seconds = 3600
  }

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 86400
  }
}

# S3 bucket public access block settings
resource "aws_s3_bucket_public_access_block" "request_bucket_pab" {
  bucket = aws_s3_bucket.request_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_public_access_block" "response_bucket_pab" {
  bucket = aws_s3_bucket.response_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_public_access_block" "frontend_bucket_pab" {
  bucket = aws_s3_bucket.frontend_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
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

resource "aws_s3_bucket_versioning" "frontend_bucket_versioning" {
  bucket = aws_s3_bucket.frontend_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

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
}

# Lambda policy
resource "aws_iam_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy-${random_string.suffix.result}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          "${aws_s3_bucket.request_bucket.arn}/*",
          aws_s3_bucket.response_bucket.arn,
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "translate:TranslateText"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# ===== LAMBDA FUNCTION =====

# Package Lambda function
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/../lambda/lambda_deployment.zip"
  excludes    = ["*.pyc", "__pycache__", "*.zip"]
}

# Lambda function
resource "aws_lambda_function" "translate_function" {
  filename      = data.archive_file.lambda_zip.output_path
  function_name = "${var.project_name}-translate-function"
  role          = aws_iam_role.lambda_role.arn
  handler       = "translate_function.lambda_handler"
  runtime       = "python3.9"
  timeout       = 60
  memory_size   = 256

  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      REQUEST_BUCKET  = aws_s3_bucket.request_bucket.bucket
      RESPONSE_BUCKET = aws_s3_bucket.response_bucket.bucket
      REGION          = data.aws_region.current.name
    }
  }
}

# ===== COGNITO AUTHENTICATION =====

# User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-user-pool"

  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_uppercase = true
    require_symbols   = false
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-user-pool-client"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]
}

# Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.main.id
    provider_name = aws_cognito_user_pool.main.endpoint
  }
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
}

# Authenticated user policy
resource "aws_iam_policy" "authenticated_policy" {
  name = "${var.project_name}-authenticated-policy-${random_string.suffix.result}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "${aws_s3_bucket.request_bucket.arn}/*",
          "${aws_s3_bucket.response_bucket.arn}/*",
          aws_s3_bucket.request_bucket.arn,
          aws_s3_bucket.response_bucket.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "execute-api:Invoke"
        ]
        Resource = "${aws_api_gateway_rest_api.translate_api.execution_arn}/*/*"
      }
    ]
  })
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

# ===== API GATEWAY WITH FIXED CORS =====

# REST API
resource "aws_api_gateway_rest_api" "translate_api" {
  name        = "${var.project_name}-translate-api"
  description = "API Gateway for translation service"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API resource
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
}

# OPTIONS integration
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
    "method.response.header.Access-Control-Allow-Origin" = true
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

# Integration responses with FIXED CORS headers
resource "aws_api_gateway_integration_response" "translate_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_method.http_method
  status_code = aws_api_gateway_method_response.translate_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
  }

  depends_on = [aws_api_gateway_integration.translate_integration]
}

resource "aws_api_gateway_integration_response" "translate_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.translate_api.id
  resource_id = aws_api_gateway_resource.translate_resource.id
  http_method = aws_api_gateway_method.translate_options.http_method
  status_code = aws_api_gateway_method_response.translate_options_response.status_code

  # FIXED: Include all necessary headers for AWS Amplify/Cognito
  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,Cache-Control'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,OPTIONS,PUT,DELETE'"
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
    aws_api_gateway_integration.translate_integration,
    aws_api_gateway_method.translate_options,
    aws_api_gateway_integration.translate_options_integration,
    aws_api_gateway_integration_response.translate_integration_response,
    aws_api_gateway_integration_response.translate_options_integration_response
  ]

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.translate_resource.id,
      aws_api_gateway_method.translate_method.id,
      aws_api_gateway_integration.translate_integration.id,
      aws_api_gateway_method.translate_options.id,
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
}

# ===== CLOUDFRONT DISTRIBUTION =====

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "frontend_distribution" {
  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend_bucket.bucket}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  enabled             = true
  default_root_object = "index.html"
  comment             = "CloudFront distribution for ${var.project_name} frontend"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
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

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
}

# S3 bucket policy for CloudFront (Frontend bucket)
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
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

# S3 bucket policy for request bucket (for authenticated users)
resource "aws_s3_bucket_policy" "request_bucket_policy" {
  bucket = aws_s3_bucket.request_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.authenticated_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.request_bucket.arn}/*"
      },
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.request_bucket.arn,
          "${aws_s3_bucket.request_bucket.arn}/*"
        ]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.request_bucket_pab]
}

# S3 bucket policy for response bucket (for authenticated users)
resource "aws_s3_bucket_policy" "response_bucket_policy" {
  bucket = aws_s3_bucket.response_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.authenticated_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.response_bucket.arn,
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.response_bucket.arn,
          "${aws_s3_bucket.response_bucket.arn}/*"
        ]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.response_bucket_pab]
}