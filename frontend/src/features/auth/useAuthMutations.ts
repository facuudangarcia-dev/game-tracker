import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { login, logout, register, resendVerification, type User, verifyEmail } from './api';
import { currentUserQueryKey } from './queryKeys';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => queryClient.setQueryData<User | null>(currentUserQueryKey, user),
  });
}

/** Registration doesn't log in: the email must be verified first. */
export function useRegister() {
  return useMutation({ mutationFn: register });
}

export function useVerifyEmail() {
  return useMutation({ mutationFn: verifyEmail });
}

export function useResendVerification() {
  return useMutation({ mutationFn: resendVerification });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    // Even if the request fails, drop every cached piece of the previous user's data.
    // The current-user query is set to null (not removed) so mounted guards react to it.
    onSettled: () => {
      queryClient.setQueryData<User | null>(currentUserQueryKey, null);
      const currentUserHash = hashKey(currentUserQueryKey);
      queryClient.removeQueries({ predicate: (query) => query.queryHash !== currentUserHash });
    },
  });
}
