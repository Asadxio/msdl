import {
  QueryDocumentSnapshot,
  DocumentData,
  query,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  getDocs,
  QueryConstraint,
  CollectionReference,
} from 'firebase/firestore';

export const ADMIN_MIN_PAGE_SIZE = 10;
export const ADMIN_MAX_PAGE_SIZE = 100;
export const ADMIN_DEFAULT_PAGE_SIZE = 25;

export function clampPageSize(size?: number): number {
  const n = Number(size || ADMIN_DEFAULT_PAGE_SIZE);
  return Math.min(ADMIN_MAX_PAGE_SIZE, Math.max(ADMIN_MIN_PAGE_SIZE, Number.isFinite(n) ? n : ADMIN_DEFAULT_PAGE_SIZE));
}

export type CursorState = {
  first: QueryDocumentSnapshot<DocumentData> | null;
  last: QueryDocumentSnapshot<DocumentData> | null;
};

export async function fetchCursorPage<T>(input: {
  ref: CollectionReference<DocumentData>;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  direction?: 'next' | 'prev';
  extra?: QueryConstraint[];
}) {
  const orderField = input.orderField || 'created_at';
  const direction = input.orderDirection || 'desc';
  const pageSize = clampPageSize(input.pageSize);
  const constraints: QueryConstraint[] = [orderBy(orderField, direction), ...(input.extra || [])];
  if (input.cursor && input.direction === 'prev') {
    constraints.push(endBefore(input.cursor), limitToLast(pageSize));
  } else if (input.cursor && input.direction === 'next') {
    constraints.push(startAfter(input.cursor), limit(pageSize));
  } else {
    constraints.push(limit(pageSize));
  }
  const snap = await getDocs(query(input.ref, ...constraints));
  const docs = snap.docs;
  const items = docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
  return {
    items,
    nextCursor: docs.length ? docs[docs.length - 1] : null,
    prevCursor: docs.length ? docs[0] : null,
    hasMore: docs.length >= pageSize,
  };
}
