import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

export type ApiGatewayProxyHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>

export enum HttpStatus {
    OK = 200,
    NoContent = 204,
    BadRequest = 400,
    NotFound = 404,
    ServerError = 500,
}

export type MethodHandlerMap = Record<string, ApiGatewayProxyHandler>

export type ResourceHandlerMap = Record<string, MethodHandlerMap>