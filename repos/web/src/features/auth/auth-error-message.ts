import { ApiError } from "@/lib/api/problem-details";

export function authErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.problem.status === 429
    ? "Too many attempts. Wait a moment and try again."
    : fallback;
}