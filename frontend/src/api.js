export async function api(path, employeeId = "", options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Cannot reach the service. Your information has been kept. Please try again.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      data?.message ||
        "The service could not complete this request. Please try again.",
    );
    error.review = data?.review;
    error.status = response.status;
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
  if (!data)
    throw new Error(
      "The service returned an unexpected response. Please try again.",
    );
  return data;
}
