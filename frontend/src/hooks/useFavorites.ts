import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '../api/favorites';
import { useAuthStore } from '../store/authStore';

export function useFavoriteKeys() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['favorite-keys'],
    queryFn: favoritesApi.keys,
    enabled: isAuthenticated(),
    staleTime: 60_000,
  });
}

export function useFavorites() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['favorites'],
    queryFn: favoritesApi.list,
    enabled: isAuthenticated(),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: favoritesApi.toggle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-keys'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}
