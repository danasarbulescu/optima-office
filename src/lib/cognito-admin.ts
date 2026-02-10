import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';

/**
 * Create a Cognito user and send an invite email with a temporary password.
 * Returns the Cognito user's sub (UUID).
 */
export async function createCognitoUser(
  email: string,
  firstName: string,
  lastName: string,
): Promise<string> {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID not configured');

  const result = await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName },
    ],
    DesiredDeliveryMediums: ['EMAIL'],
  }));

  const cognitoUserId = result.User?.Attributes?.find(a => a.Name === 'sub')?.Value;
  if (!cognitoUserId) throw new Error('Failed to get Cognito user sub');
  return cognitoUserId;
}

/** Disable a Cognito user (for archiving). */
export async function disableCognitoUser(email: string): Promise<void> {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID not configured');

  await cognitoClient.send(new AdminDisableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
  }));
}

/** Re-enable a Cognito user (for reactivation). */
export async function enableCognitoUser(email: string): Promise<void> {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID not configured');

  await cognitoClient.send(new AdminEnableUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
  }));
}

/** Delete a Cognito user permanently. */
export async function deleteCognitoUser(email: string): Promise<void> {
  if (!USER_POOL_ID) throw new Error('COGNITO_USER_POOL_ID not configured');

  await cognitoClient.send(new AdminDeleteUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: email,
  }));
}
