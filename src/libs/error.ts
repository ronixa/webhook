export class ApiError extends Error {
  constructor(
    message = "UNKNOWN_ERROR",
    name = "UNKNOWN_ERROR",
    code = 500,
    extra = {},
    devMessage = "",
  ) {
    super(message);

    this.name = name;
    this.cause = name;
    this.code = code;
    this.extra = extra;
    this.devMessage = devMessage;
  }
}
