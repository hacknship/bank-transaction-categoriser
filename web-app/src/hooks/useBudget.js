import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API } from '../utils/api';
import { queryKeys } from '../lib/queryClient';

// Get budget for a specific period
export function useBudget(period, type) {
  return useQuery({
    queryKey: queryKeys.budget(period, type),
    queryFn: () => API.getBudgetForPeriod(period, type),
    // Only fetch when period is available
    enabled: !!period,
    // Let global defaults handle caching
  });
}

// Get available periods
export function useAvailablePeriods() {
  return useQuery({
    queryKey: queryKeys.periods,
    queryFn: API.getAvailablePeriods,
    select: (data) => data.periods || [],
  });
}

// Get budget history
export function useBudgetHistory() {
  return useQuery({
    queryKey: queryKeys.budgetHistory,
    queryFn: API.getBudgetHistory,
  });
}

// Update budget template
export function useUpdateBudgetTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: API.updateBudgetTemplate,
    onSuccess: () => {
      // Invalidate all budget queries
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetHistory });
    },
  });
}

// Update snapshot budget (historical)
export function useUpdateSnapshotBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: API.updateSnapshotBudget,
    onSuccess: (_, variables) => {
      // Invalidate specific budget query
      queryClient.invalidateQueries({
        queryKey: queryKeys.budget(variables.period, 'expense')
      });
    },
  });
}
