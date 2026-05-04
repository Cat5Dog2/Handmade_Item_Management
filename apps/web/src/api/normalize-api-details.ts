import type { ApiErrorDetail } from "@handmade/shared";

export interface NormalizedApiDetail {
  field: string;
  message: string;
}

export function normalizeApiDetails(
  details: ApiErrorDetail[] | null | undefined
): NormalizedApiDetail[] {
  if (!details?.length) {
    return [];
  }

  return details.flatMap((detail) => {
    const field = detail.field?.trim();
    const message = detail.message?.trim();

    if (!field || !message) {
      return [];
    }

    return [
      {
        field,
        message
      }
    ];
  });
}

