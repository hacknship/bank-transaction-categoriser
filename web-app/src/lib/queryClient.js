import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 30 minutes even if unused
      gcTime: 30 * 60 * 1000,
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
      // Retry failed requests 1 time
      retry: 1,
      // Don't refetch on mount if data exists (use cache)
      refetchOnMount: 'always',
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
