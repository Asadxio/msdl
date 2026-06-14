import { auth } from '@/lib/firebase';

type FirestoreDebugContext = {
  collection: string;
  operation: 'listen' | 'get' | 'add' | 'set' | 'update' | 'delete' | 'count';
  path?: string;
  query?: string;
  role?: string | null;
  status?: string | null;
};

function getErrorCode(error: unknown): string {
  const maybe = error as { code?: unknown } | undefined;
  return typeof maybe?.code === 'string' ? maybe.code : 'unknown';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const maybe = error as { message?: unknown } | undefined;
  return typeof maybe?.message === 'string' ? maybe.message : 'Unknown Firestore error';
}

export function logFirestoreFailure(context: FirestoreDebugContext, error: unknown): void {
  console.log('[FirestoreDebug]', {
    collection: context.collection,
    operation: context.operation,
    path: context.path || '',
    query: context.query || '',
    uid: auth.currentUser?.uid,
    role: context.role || null,
    status: context.status || null,
    errorCode: getErrorCode(error),
    errorMessage: getErrorMessage(error),
  });
}
