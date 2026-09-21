export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Record<string, string[]>;
  requestId?: string;
}

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }
}

export async function readProblemDetails(response: Response): Promise<ProblemDetails> {
  const requestId = response.headers.get("X-Request-Id") ?? undefined;
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json") || contentType.includes("application/problem+json")) {
    const value: unknown = await response.json();
    if (isProblemDetails(value)) {
      return { ...value, requestId: value.requestId ?? requestId };
    }
  }

  return {
    title: response.statusText || "Request failed",
    status: response.status,
    requestId,
  };
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ProblemDetails>;
  return typeof candidate.title === "string" && typeof candidate.status === "number";
}