import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { RemovalPolicy } from 'aws-cdk-lib';

const backend = defineBackend({ auth });

// Disable self-signup: only admins can create users
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// DynamoDB table for caching P&L data fetched from CData
const cacheStack = backend.createStack('PLCacheStack');
const plCacheTable = new dynamodb.Table(cacheStack, 'PLCache', {
  partitionKey: { name: 'entityId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  removalPolicy: RemovalPolicy.DESTROY,
});

// DynamoDB table for entity (QuickBooks company) registry
const entitiesTable = new dynamodb.Table(cacheStack, 'Entities', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});
entitiesTable.addGlobalSecondaryIndex({
  indexName: 'byClient',
  partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
});

// DynamoDB table for client registry
const clientsTable = new dynamodb.Table(cacheStack, 'Clients', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// DynamoDB table for user-client membership mapping
const clientMembershipsTable = new dynamodb.Table(cacheStack, 'ClientMemberships', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// DynamoDB table for reporting packages (per-client)
const packagesTable = new dynamodb.Table(cacheStack, 'Packages', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});
packagesTable.addGlobalSecondaryIndex({
  indexName: 'byClient',
  partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
});

// DynamoDB table for dashboards within packages
const dashboardsTable = new dynamodb.Table(cacheStack, 'Dashboards', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});
dashboardsTable.addGlobalSecondaryIndex({
  indexName: 'byPackage',
  partitionKey: { name: 'packageId', type: dynamodb.AttributeType.STRING },
});
dashboardsTable.addGlobalSecondaryIndex({
  indexName: 'byClient',
  partitionKey: { name: 'clientId', type: dynamodb.AttributeType.STRING },
});

// DynamoDB table for widget instances on dashboards
const dashboardWidgetsTable = new dynamodb.Table(cacheStack, 'DashboardWidgets', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});
dashboardWidgetsTable.addGlobalSecondaryIndex({
  indexName: 'byDashboard',
  partitionKey: { name: 'dashboardId', type: dynamodb.AttributeType.STRING },
});

// DynamoDB table for widget type display name overrides
const widgetTypeMetaTable = new dynamodb.Table(cacheStack, 'WidgetTypeMeta', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

// IAM role for Amplify Hosting SSR compute (Next.js API routes)
const computeRole = new iam.Role(cacheStack, 'SSRComputeRole', {
  assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
});
plCacheTable.grantReadWriteData(computeRole);
entitiesTable.grantReadWriteData(computeRole);
clientsTable.grantReadWriteData(computeRole);
clientMembershipsTable.grantReadWriteData(computeRole);
packagesTable.grantReadWriteData(computeRole);
dashboardsTable.grantReadWriteData(computeRole);
dashboardWidgetsTable.grantReadWriteData(computeRole);
widgetTypeMetaTable.grantReadWriteData(computeRole);

// Sandbox sync tool needs ListTables + read/write access to all Amplify DynamoDB tables
computeRole.addToPolicy(new iam.PolicyStatement({
  actions: ['dynamodb:ListTables'],
  resources: ['*'],
}));
computeRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'dynamodb:GetItem',
    'dynamodb:PutItem',
    'dynamodb:DeleteItem',
    'dynamodb:Scan',
    'dynamodb:BatchWriteItem',
  ],
  resources: [`arn:aws:dynamodb:*:*:table/amplify-*`],
}));

backend.addOutput({
  custom: {
    plCacheTableName: plCacheTable.tableName,
    entitiesTableName: entitiesTable.tableName,
    clientsTableName: clientsTable.tableName,
    clientMembershipsTableName: clientMembershipsTable.tableName,
    packagesTableName: packagesTable.tableName,
    dashboardsTableName: dashboardsTable.tableName,
    dashboardWidgetsTableName: dashboardWidgetsTable.tableName,
    widgetTypeMetaTableName: widgetTypeMetaTable.tableName,
    ssrComputeRoleArn: computeRole.roleArn,
  },
});
