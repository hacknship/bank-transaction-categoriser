import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../utils/api';
import { queryKeys } from '../lib/queryClient';

// Get all transactions
export function useTransactions() {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: API.getTransactions,
    select: (data) => data.transactions || [],
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
      // Invalidate and refetch transactions
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
