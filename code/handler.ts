import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { S3 } from "aws-sdk";
import { HttpStatus, ApiGatewayProxyHandler, ResourceHandlerMap, MethodHandlerMap, ValidationError } from "./types";

const emptyResponse: APIGatewayProxyResult = { statusCode: HttpStatus.NoContent, headers: {}, body: '' }
const s3 = new S3()

const resourceHandlerMap: ResourceHandlerMap = {
    "/v0/files": {
        GET: listFiles
    },
    "/v0/files/{id}": {
        GET: getFile,
        POST: createFile,
        DELETE: deleteFile
    }
}

export async function handler(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const methodHandlerMap: MethodHandlerMap = resourceHandlerMap[event.resource] || {}
    const methodHandler: ApiGatewayProxyHandler = methodHandlerMap[event.httpMethod] || handleRouteNotFound

    try {
        return await methodHandler(event, context)
    } catch(err) {
        if(err instanceof ValidationError) {
            return jsonResponse(HttpStatus.BadRequest, { error: err.message })
        } else {
            console.error(err)
            return jsonResponse(HttpStatus.ServerError, { error: 'Unexpected server error' })
        }
    }
}

function getS3BucketName(): string {
    if (process.env.S3_BUCKET) return process.env.S3_BUCKET

    throw new Error("S3_BUCKET environment variable has not been specified")
}

function extractFileName(event: APIGatewayProxyEvent): string {
    const fileName = event.pathParameters?.id
    if(!fileName) throw new ValidationError('file name must be specified')
    return fileName
}

function jsonResponse(statusCode: HttpStatus, body: any): APIGatewayProxyResult {
    return {
        statusCode,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    }
}

function mapAwsErrorToResponse(err: any) {
    if (err.code && err.code === 'NoSuchKey') {
        return jsonResponse(HttpStatus.NotFound, { error: 'no such file exists' })
    }
    throw err
}

async function handleRouteNotFound(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    return jsonResponse(404, { error: 'route not found' })
}

async function listFiles(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    const result = await s3.listObjects({
        Bucket: getS3BucketName()
    }).promise()

    return jsonResponse(200, { files: result.Contents?.map(content => content.Key) })
}

async function getFile(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    try {
        const result = await s3.getObject({
            Bucket: getS3BucketName(),
            Key: extractFileName(event)
        }).promise()

        return {
            statusCode: HttpStatus.OK,
            headers: { 'content-type': '' },
            body: result.Body?.toString() || ''
        }
    } catch(err: any) {
        return mapAwsErrorToResponse(err)
    }
}

async function createFile(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    await s3.putObject({
        Bucket: getS3BucketName(),
        Key: extractFileName(event),
        Body: `This file was created on ${new Date().toISOString()}`
    }).promise()

    return emptyResponse
}

async function deleteFile(
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> {
    try {
        await s3.deleteObject({
            Bucket: getS3BucketName(),
            Key: extractFileName(event)
        }).promise()

        return emptyResponse
    } catch(err: any) {
        return mapAwsErrorToResponse(err)
    }
}