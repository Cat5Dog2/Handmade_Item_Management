import type { RequestHandler } from "express";
import {
  createAuthForbiddenError,
  createAuthRequiredError,
  createInternalError
} from "../errors/api-errors";
import { verifyFirebaseIdToken } from "../firebase/firebase-admin";

interface VerifiedToken {
  uid: string;
  email?: string | null;
}

interface CreateRequireAuthOptions {
  ownerEmail?: string | null;
  verifyIdToken?: (idToken: string) => Promise<VerifiedToken>;
}

function extractBearerToken(authorizationHeader?: string) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function normalizeOwnerEmail(ownerEmail?: string | null) {
  const normalized = ownerEmail?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return normalized;
}

export function createRequireAuth(
  options: CreateRequireAuthOptions = {}
): RequestHandler {
  const verifyIdToken = options.verifyIdToken ?? verifyFirebaseIdToken;
  const ownerEmail = normalizeOwnerEmail(
    options.ownerEmail ?? process.env.APP_OWNER_EMAIL
  );

  return async (request, _response, next) => {
    const idToken = extractBearerToken(request.header("Authorization"));

    if (!idToken) {
      next(createAuthRequiredError());
      return;
    }

    if (!ownerEmail) {
      next(createInternalError());
      return;
    }

    try {
      const decodedToken = await verifyIdToken(idToken);
      const decodedEmail = decodedToken.email?.trim().toLowerCase();

      if (!decodedEmail || decodedEmail !== ownerEmail) {
        next(createAuthForbiddenError());
        return;
      }

      request.authContext = {
        actorUid: decodedToken.uid,
        email: decodedEmail
      };

      next();
    } catch {
      next(createAuthRequiredError());
    }
  };
}

export const requireAuth = createRequireAuth();
