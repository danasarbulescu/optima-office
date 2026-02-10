import { cookies } from 'next/headers';
import { fetchAuthSession } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from '@/utils/amplify-utils';
import { getMembershipForUser } from './client-membership';
import { getClientUser } from './client-users';
import { AuthContext } from './types';

/**
 * Get the authenticated user's client context.
 * Replaces the duplicated checkAuth() pattern across API routes.
 *
 * @param selectedClientId - For internal users, the client they want to view.
 *   Ignored for external users (they're locked to their assigned client).
 */
export async function getAuthContext(selectedClientId?: string | null): Promise<AuthContext | null> {
  const session = await runWithAmplifyServerContext({
    nextServerContext: { cookies },
    operation: async (contextSpec) => {
      try {
        return await fetchAuthSession(contextSpec);
      } catch {
        return null;
      }
    },
  });

  if (!session?.tokens) return null;

  // Extract userId from the Cognito ID token
  const userId = session.tokens.idToken?.payload?.sub as string | undefined;
  if (!userId) return null;

  // Look up user's client membership
  const membership = await getMembershipForUser(userId);
  if (!membership) return null;

  const isInternal = membership.clientId === '*';

  // Resolve the active client
  let clientId: string;
  if (isInternal) {
    // Internal users can switch clients; use selectedClientId or fallback to "*"
    clientId = selectedClientId || '*';
  } else {
    // External users are locked to their assigned client
    clientId = membership.clientId;
  }

  // Resolve package authorization for client users
  let authorizedPackageIds: string[] | null = null;
  if (membership.clientUserId) {
    const clientUser = await getClientUser(membership.clientUserId);
    if (clientUser && clientUser.status === 'archived') {
      return null; // Archived client users cannot access the app
    }
    if (clientUser) {
      authorizedPackageIds = clientUser.authorizedPackageIds;
    }
  }

  return {
    userId,
    clientId,
    role: membership.role,
    isInternal,
    authorizedPackageIds,
  };
}
