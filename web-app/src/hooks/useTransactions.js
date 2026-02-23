import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { API } from '../utils/api';
import { queryKeys } from '../lib/queryClient';

// Get all transactions (legacy - for backwards compat)
export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: API.getTransactions,
    select: (data) => data.transactions || [],
  });
}

// Get paginated transactions with infinite scroll
export function useInfiniteTransactions(filters = {}) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.transactions, 'infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        limit: '20',
        offset: String(pageParam),
        ...filters
      };
      return API.getTransactions(params);
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.hasMore) return undefined;
      return lastPage.pagination.offset + lastPage.pagination.limit;
    },
    select: (data) => {
      // Flatten all pages
      const allTransactions = data.pages.flatMap(page => page.transactions || []);
      return {
        transactions: allTransactions,
        pagination: data.pages[data.pages.length - 1]?.pagination,
        pages: data.pages
      };
    }
  });
}

// Get transaction totals
export function useTransactionTotals(filters = {}) {
  return useQuery({
    queryKey: [...queryKeys.transactions, 'totals', filters],
    queryFn: () => API.getTransactionTotals(filters),
    select: (data) => data.totals || { count: 0, outgoing: 0, incoming: 0, net: 0 },
  });
}

// Get all categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: API.getCategories,
    select: (data) => data.categories || [],
  });
}

// Save a transaction
export function useSaveTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: API.saveTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

// Delete a transaction
export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: API.deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}
