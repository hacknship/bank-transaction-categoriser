import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { API } from '../utils/api';
import { queryKeys } from '../lib/queryClient';

// Get all transactions (legacy - for backwards compat)
export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: () => API.getTransactions({ useBudgetDate: 'true' }),
    select: (data) => data.transactions || [],
  });
}

// Get paginated transactions with infinite scroll
export function useInfiniteTransactions(filters = {}, useBudgetDate = 'false') {
  return useInfiniteQuery({
    queryKey: [...queryKeys.transactions, 'infinite', filters, useBudgetDate],
    queryFn: async ({ pageParam = 0 }) => {
      const params = {
        limit: '20',
        offset: String(pageParam),
        useBudgetDate,
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
export function useTransactionTotals(filters = {}, useBudgetDate = 'false') {
  return useQuery({
    queryKey: [...queryKeys.transactions, 'totals', filters, useBudgetDate],
    queryFn: () => API.getTransactionTotals({ ...filters, useBudgetDate }),
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

// Save a transaction with Optimistic Updates
export function useSaveTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: API.saveTransaction,
    // When mutate is called:
    onMutate: async (newTx) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: queryKeys.transactions });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData([...queryKeys.transactions, 'infinite']);

      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: queryKeys.transactions }, (old) => {
        if (!old) return old;

        // For infinite queries
        if (old.pages) {
          console.log('Optimistically updating infinite query pages...');
          return {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              transactions: page.transactions?.map(tx =>
                tx.tx_id === newTx.txId ? {
                  ...tx,
                  category: newTx.category !== undefined ? newTx.category : tx.category,
                  notes: newTx.notes !== undefined ? newTx.notes : tx.notes,
                  budget_date: newTx.budgetDate !== undefined ? newTx.budgetDate : tx.budget_date
                } : tx
              )
            }))
          };
        }

        return old;
      });

      // Return a context object with the snapshotted value
      return { previousData };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (err, newTx, context) => {
      queryClient.setQueriesData({ queryKey: queryKeys.transactions }, context.previousData);
    },
    // Always refetch after error or success:
    onSettled: () => {
      // Invalidate both infinite and totals
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
      // Invalidate relevant tracker queries
      queryClient.invalidateQueries({ queryKey: ['budget'] });
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
