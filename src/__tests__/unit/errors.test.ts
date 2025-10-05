import { describe, it, expect } from "vitest";
import {
  classifyError,
  isTemporaryError,
  isAuthenticationError,
} from "../../utils";

describe("classifyError", () => {
  it("classifies 401 errors as UNAUTHORIZED", () => {
    const error = classifyError(
      { message: "Unauthorized access", statusCode: 401 },
      "/activities/123",
    );

    expect(error.errorCode).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(401);
    expect(error.isRetryable).toBe(false);
    expect(error.endpoint).toBe("/activities/123");
  });

  it("classifies 429 errors as RATE_LIMITED and retryable", () => {
    const error = classifyError({
      message: "Rate limit exceeded",
      statusCode: 429,
    });

    expect(error.errorCode).toBe("RATE_LIMITED");
    expect(error.statusCode).toBe(429);
    expect(error.isRetryable).toBe(true);
  });

  it("classifies 503 errors as SERVICE_UNAVAILABLE and retryable", () => {
    const error = classifyError({
      message: "Service unavailable",
      statusCode: 503,
    });

    expect(error.errorCode).toBe("SERVICE_UNAVAILABLE");
    expect(error.isRetryable).toBe(true);
  });

  it("classifies 500 errors as SERVER_ERROR and retryable", () => {
    const error = classifyError({
      message: "Internal server error",
      statusCode: 500,
    });

    expect(error.errorCode).toBe("SERVER_ERROR");
    expect(error.isRetryable).toBe(true);
  });

  it("classifies 404 errors as NOT_FOUND and not retryable", () => {
    const error = classifyError({
      message: "Activity not found",
      statusCode: 404,
    });

    expect(error.errorCode).toBe("NOT_FOUND");
    expect(error.isRetryable).toBe(false);
  });

  it("handles Error objects", () => {
    const error = classifyError(new Error("Token expired"));

    expect(error.errorCode).toBe("TOKEN_EXPIRED");
    expect(error.message).toBe("Token expired");
  });

  it("handles string errors", () => {
    const error = classifyError("Connection timeout");

    expect(error.errorCode).toBe("TIMEOUT");
    expect(error.message).toBe("Connection timeout");
  });

  it("handles unknown errors", () => {
    const error = classifyError(null);

    expect(error.errorCode).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("Unknown error occurred");
  });
});

describe("isTemporaryError", () => {
  it("identifies timeout errors as temporary", () => {
    expect(isTemporaryError("Connection timeout")).toBe(true);
    expect(isTemporaryError("Request timeout (504)")).toBe(true);
  });

  it("identifies rate limit errors as temporary", () => {
    expect(isTemporaryError("Rate limit exceeded")).toBe(true);
    expect(isTemporaryError("Error 429: too many requests")).toBe(true);
  });

  it("identifies service unavailable errors as temporary", () => {
    expect(isTemporaryError("Service unavailable")).toBe(true);
    expect(isTemporaryError("503 error")).toBe(true);
  });

  it("identifies permanent errors correctly", () => {
    expect(isTemporaryError("Not found")).toBe(false);
    expect(isTemporaryError("Unauthorized")).toBe(false);
    expect(isTemporaryError("Invalid request")).toBe(false);
  });
});

describe("isAuthenticationError", () => {
  it("identifies 401 errors as authentication errors", () => {
    expect(isAuthenticationError("Unauthorized 401")).toBe(true);
    expect(isAuthenticationError("unauthorized access")).toBe(true);
  });

  it("identifies 403 errors as authentication errors", () => {
    expect(isAuthenticationError("Forbidden 403")).toBe(true);
    expect(isAuthenticationError("forbidden resource")).toBe(true);
  });

  it("identifies token errors as authentication errors", () => {
    expect(isAuthenticationError("Token expired")).toBe(true);
    expect(isAuthenticationError("Invalid token")).toBe(true);
  });

  it("identifies permission errors as authentication errors", () => {
    expect(isAuthenticationError("Permission denied")).toBe(true);
    expect(isAuthenticationError("No authentication provided")).toBe(true);
  });

  it("does not classify other errors as authentication errors", () => {
    expect(isAuthenticationError("Not found")).toBe(false);
    expect(isAuthenticationError("Rate limit exceeded")).toBe(false);
    expect(isAuthenticationError("Server error")).toBe(false);
  });
});
