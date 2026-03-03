import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes to avoid redundant reloads on tab switch
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Refetch when window regains focus, but don't force refetch on every mount
      refetchOnWindowFocus: true,
      refetchOnMount: false,
      // Retry failed requests 1 time
      retry: 1,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  transactions: ['transactions'],
  categories: ['categories'],
  budget: (period, type) => ['budget', period, type],
  periods: ['periods'],
  budgetHistory: ['budgetHistory'],
};
