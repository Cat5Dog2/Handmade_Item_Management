import { useEffect } from "react";
import type { Location, NavigateFunction } from "react-router-dom";

interface SafeParseSchema<TData> {
  safeParse(
    input: unknown
  ): { data: TData; success: true } | { success: false };
}

export interface PageNotice {
  message: string;
  type: "error" | "success";
}

export interface ListQueryParseResult<TQuery> {
  errorMessage: string | null;
  query: TQuery;
}

export function parseListQuery<TParsedQuery, TQuery>(
  schema: SafeParseSchema<TParsedQuery>,
  searchParams: URLSearchParams,
  defaultQuery: TQuery,
  errorMessage: string,
  normalizeQuery: (query: TParsedQuery) => TQuery
): ListQueryParseResult<TQuery> {
  const parsedQuery = schema.safeParse(
    Object.fromEntries(searchParams.entries())
  );

  if (!parsedQuery.success) {
    return {
      errorMessage,
      query: defaultQuery
    };
  }

  return {
    errorMessage: null,
    query: normalizeQuery(parsedQuery.data)
  };
}

export function useNavigationNotice(
  location: Location,
  navigate: NavigateFunction,
  setNotice: (notice: PageNotice) => void
) {
  useEffect(() => {
    const nextNotice =
      typeof location.state === "object" &&
      location.state !== null &&
      "notice" in location.state
        ? (location.state.notice as PageNotice | null | undefined)
        : null;

    if (!nextNotice) {
      return;
    }

    setNotice(nextNotice);
    navigate(
      {
        pathname: location.pathname,
        search: location.search
      },
      {
        replace: true,
        state: null
      }
    );
  }, [location.pathname, location.search, location.state, navigate, setNotice]);
}
