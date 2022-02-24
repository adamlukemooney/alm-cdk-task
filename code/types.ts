import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export type ApiGatewayProxyHandler = (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>

export enum HttpStatus {
    OK = 200,
    NoContent = 204,
    BadRequest = 400,
    NotFound = 404,
    ServerError = 500,
}

export interface MethodHandlerMap {
    [method: string]: ApiGatewayProxyHandler
}

export interface ResourceHandlerMap {
    [route: string]: MethodHandlerMap
}

export class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ValidationError";
    }
}