import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";
import { verifyFirebaseIdToken } from "../firebase/firebase-admin";

interface VerifiedToken {
  uid: string;
  email?: string | null;
}

interface CreateRequireAuthOptions {
  ownerEmail?: string | null;
  verifyIdToken?: (idToken: string) => Promise<VerifiedToken>;
}

function createAuthRequiredError() {
  return new AppError({
    statusCode: 401,
    code: "AUTH_REQUIRED",
    message: "認証が必要です。"
  });
}

function createAuthForbiddenError() {
  return new AppError({
    statusCode: 403,
    code: "AUTH_FORBIDDEN",
    message: "この操作は実行できません。"
  });
}

function createInternalError() {
  return new AppError({
    statusCode: 500,
    code: "INTERNAL_ERROR",
    message: "システムエラーが発生しました。"
  });
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
