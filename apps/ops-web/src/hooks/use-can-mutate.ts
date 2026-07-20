'use client';

import { useSession } from 'next-auth/react';

export function useCanMutate() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  return {
    canMutate: !!role && role !== 'READONLY',
    isReadOnly: role === 'READONLY',
    role,
  };
}
