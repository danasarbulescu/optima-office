import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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
  partitionKey: { name: 'companyId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',
  removalPolicy: RemovalPolicy.DESTROY,
});

// DynamoDB table for client/company registry
const clientsTable = new dynamodb.Table(cacheStack, 'Clients', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.DESTROY,
});

backend.addOutput({
  custom: {
    plCacheTableName: plCacheTable.tableName,
    clientsTableName: clientsTable.tableName,
  },
});
