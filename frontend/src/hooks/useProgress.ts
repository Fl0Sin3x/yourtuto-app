import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { progressApi } from '../api/progress';
import { useAuthStore } from '../store/authStore';

export function useProgressKeys() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['progress-keys'],
    queryFn: progressApi.keys,
    enabled: isAuthenticated(),
    staleTime: Infinity,
  });
}

export function useProgress() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['progress'],
    queryFn: progressApi.list,
    enabled: isAuthenticated(),
  });
}

export function useToggleProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: progressApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-keys'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useToggleDone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: progressApi.toggleDone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress'] });
      queryClient.invalidateQueries({ queryKey: ['progress-stats'] });
    },
  });
}
