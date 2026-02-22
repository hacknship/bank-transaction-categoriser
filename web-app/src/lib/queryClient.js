import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Budget data should be fresh - categories can be renamed
      staleTime: 0,
      // Keep data briefly
      gcTime: 60 * 1000,
      // Always refetch when window regains focus
      refetchOnWindowFocus: true,
      // Refetch on mount to ensure fresh data
      refetchOnMount: 'always',
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
