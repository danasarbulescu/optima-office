import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { auth } from './auth/resource';
import { dashboardApi } from './functions/dashboard-api/resource';

const backend = defineBackend({
  auth,
  dashboardApi,
});

// Disable self-signup: only admins can create users
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// Create HTTP API with Cognito authorizer
const apiStack = backend.createStack('api-stack');

const userPoolAuthorizer = new HttpUserPoolAuthorizer(
  'userPoolAuth',
  backend.auth.resources.userPool,
  { userPoolClients: [backend.auth.resources.userPoolClient] },
);

const lambdaIntegration = new HttpLambdaIntegration(
  'DashboardLambdaIntegration',
  backend.dashboardApi.resources.lambda,
);

const httpApi = new HttpApi(apiStack, 'DashboardHttpApi', {
  apiName: 'dashboardApi',
  corsPreflight: {
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.OPTIONS],
    allowOrigins: ['*'],
    allowHeaders: ['*'],
  },
  createDefaultStage: true,
});

httpApi.addRoutes({
  path: '/dashboard',
  methods: [HttpMethod.GET],
  integration: lambdaIntegration,
  authorizer: userPoolAuthorizer,
});

// Export API endpoint to amplify_outputs.json
const apiName = httpApi.httpApiName ?? 'dashboardApi';
backend.addOutput({
  custom: {
    API: {
      [apiName]: {
        endpoint: httpApi.url,
        region: Stack.of(httpApi).region,
        apiName: apiName,
      },
    },
  },
});
