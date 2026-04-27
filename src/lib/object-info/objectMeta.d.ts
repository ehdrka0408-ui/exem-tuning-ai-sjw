import type { ObjectMeta } from './index'
export const OBJECT_META: Record<string, ObjectMeta>
export function getObjectMeta(name: string): ObjectMeta | null
