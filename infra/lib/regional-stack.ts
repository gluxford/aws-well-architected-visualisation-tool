import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';
import { DeploymentConfig } from './config';

export interface RegionalStackProps extends cdk.StackProps {
  config: DeploymentConfig;
  allowedOrigin?: string;
}

export class RegionalStack extends cdk.Stack {
  public readonly s3BucketArn: string;
  public readonly s3BucketDomainName: string;
  public readonly cognitoUserPoolId: string;
  public readonly cognitoClientId: string;
  public readonly apiUrl: string;
  public readonly userPool: cognito.UserPool;
  public readonly proxyLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: RegionalStackProps) {
    super(scope, id, props);

    const { config } = props;

    // --- S3 Bucket (Task 2.1) ---
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `${config.projectName}-frontend-assets`,
      websiteIndexDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.s3BucketArn = websiteBucket.bucketArn;
    this.s3BucketDomainName = websiteBucket.bucketRegionalDomainName;

    // --- Cognito User Pool (Task 2.2) ---
    const mfaMapping: Record<string, cognito.Mfa> = {
      required: cognito.Mfa.REQUIRED,
      optional: cognito.Mfa.OPTIONAL,
      off: cognito.Mfa.OFF,
    };

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${config.projectName}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      mfa: mfaMapping[config.mfa],
      mfaSecondFactor: config.mfa !== 'off'
        ? { sms: false, otp: true }
        : undefined,
      passwordPolicy: {
        minLength: 8,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.cognitoUserPoolId = this.userPool.userPoolId;

    // --- Cognito User Pool Client (Task 2.3) ---
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    this.cognitoClientId = userPoolClient.userPoolClientId;

    // --- IAM Role for Lambda Execution (Task 2.4) ---
    const lambdaExecutionRole = new iam.Role(this, 'ProxyLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `${config.projectName}-proxy-lambda-role`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    lambdaExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['wellarchitected:*'],
        resources: ['*'],
      })
    );

    // --- Proxy Lambda (Task 3.4) ---
    this.proxyLambda = new lambda.Function(this, 'ProxyLambda', {
      functionName: `${config.projectName}-proxy`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/proxy')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ALLOWED_ORIGIN: props.allowedOrigin || '*',
      },
    });

    // --- PreSignup Lambda (Task 3.5) - Conditional ---
    if (config.emailRestriction.enabled) {
      const preSignupRole = new iam.Role(this, 'PreSignupLambdaRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        roleName: `${config.projectName}-pre-signup-lambda-role`,
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      });

      const preSignupLambda = new lambda.Function(this, 'PreSignupLambda', {
        functionName: `${config.projectName}-pre-signup`,
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'lambda_function.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/pre-signup')),
        role: preSignupRole,
        environment: {
          ALLOWED_DOMAINS: config.emailRestriction.allowedDomains?.join(',') ?? '',
        },
      });

      // --- Wire PreSignup Lambda as Cognito trigger (Task 3.6) ---
      this.userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignupLambda);
    }

    // --- API Gateway (Tasks 4.1 - 4.4) ---

    // Task 4.1: REST API Gateway with /proxy resource
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${config.projectName}-api`,
      deploy: false,
    });

    const proxyResource = api.root.addResource('proxy');

    // Task 4.2: POST method with Lambda proxy integration
    proxyResource.addMethod('POST', new apigateway.LambdaIntegration(this.proxyLambda, {
      proxy: true,
    }));

    // Task 4.3: OPTIONS method with MOCK integration for CORS preflight
    proxyResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
            'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.WHEN_NO_MATCH,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // Task 4.4: API Gateway deployment and stage
    const deployment = new apigateway.Deployment(this, 'ApiDeployment', {
      api,
    });

    const stage = new apigateway.Stage(this, 'ApiStage', {
      deployment,
      stageName: 'prod',
    });

    api.deploymentStage = stage;

    this.apiUrl = `${stage.urlForPath('/proxy')}`;
  }
}
