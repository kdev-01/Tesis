export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const parseError = async (response) => {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    const body = await response.json();
    const detail = body?.detail;
    let message = body?.message;

    if (!message) {
      if (Array.isArray(detail)) {
        const formatted = detail
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item?.msg) return item.msg;
            if (item?.message) return item.message;
            return null;
          })
          .filter(Boolean);
        message = formatted.length > 0 ? formatted.join('. ') : undefined;
      } else if (typeof detail === 'string') {
        message = detail;
      } else if (detail?.msg) {
        message = detail.msg;
      }
    }

    if (!message) {
      message = 'Ocurrió un error inesperado.';
    }

    return new ApiError(message, {
      status: response.status,
      code: body?.code,
      details: body?.errors ?? (Array.isArray(detail) ? detail : undefined),
    });
  }
  return new ApiError('Error de red', { status: response.status });
};
