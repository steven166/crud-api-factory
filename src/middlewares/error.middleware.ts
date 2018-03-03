import * as winston from "winston";

const statusMessages: any = {
  500: "Internal Server Error",
  404: "Not Found",
  400: "Bad Request",
  405: "Method Not Allowed"
};

export function ErrorMiddleware(error: any, req: any, res: any, next: any) {
  let status = error.status || 500;
  let response: any = {
    status,
  };
  let statusMessage = statusMessages[status];
  if (statusMessage) {
    response.statusMessage = statusMessage;
  }
  if (error.message) {
    response.message = error.message;
  }
  if (error.errors) {
    response.errors = error.errors;
  }
  response.method = req.method;
  response.path = req.path;

  if (status >= 500) {
    winston.error(error);
  }

  if (winston.level === "debug" || winston.level === "silly" || winston.level === "verbose") {
    response.stack = error.stack.split("\n");
  }

  res.header("content-type", "application/json").status(status);
  res.json(response);
}
