import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  deleteAccount,
  login,
  logout,
  register,
  resendVerification,
  type User,
  verifyEmail,
} from './api';
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

/**
 * Drops every cached piece of the previous user's data. The current-user query
 * is set to null (not removed) so mounted guards react to it.
 */
function useForgetUser() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData<User | null>(currentUserQueryKey, null);
    const currentUserHash = hashKey(currentUserQueryKey);
    queryClient.removeQueries({ predicate: (query) => query.queryHash !== currentUserHash });
  };
}

export function useLogout() {
  const forgetUser = useForgetUser();
  // Even if the request fails, the previous user's data is dropped.
  return useMutation({ mutationFn: logout, onSettled: forgetUser });
}

/** Deletes the account (decision #82): on success it's like logging out. */
export function useDeleteAccount() {
  const forgetUser = useForgetUser();
  return useMutation({ mutationFn: deleteAccount, onSuccess: forgetUser });
}
