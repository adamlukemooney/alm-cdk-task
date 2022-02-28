import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { S3 } from "aws-sdk";
import { HttpStatus, ApiGatewayProxyHandler, ResourceHandlerMap, MethodHandlerMap } from "./types";

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
        return await methodHandler(event)
    } catch(err) {
        console.error(err)
        return jsonResponse(HttpStatus.ServerError, { error: 'Unexpected server error' })
    }
}

function withS3Bucket(
    event: APIGatewayProxyEvent,
    subHandler: (s3Bucket: string) => Promise<APIGatewayProxyResult>
): Promise<APIGatewayProxyResult> {
    const s3Bucket = process.env.S3_BUCKET
    if(!s3Bucket) throw new Error("S3_BUCKET environment variable has not been specified")
    return subHandler(s3Bucket)
}

function withFileName(
    event: APIGatewayProxyEvent,
    subHandler: (fileName: string) => Promise<APIGatewayProxyResult>
): Promise<APIGatewayProxyResult> {
    const fileName = event.pathParameters?.id
    if(!fileName) return Promise.resolve(jsonResponse(HttpStatus.BadRequest, { error: 'file name must be specified' }))
    return subHandler(fileName)
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
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return jsonResponse(404, { error: 'route not found' })
}

function listFiles(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return withS3Bucket(event, async s3Bucket => {
        const result = await s3.listObjects({
            Bucket: s3Bucket
        }).promise()

        return jsonResponse(200, { files: result.Contents?.map(content => content.Key) })
    })
}

function getFile(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return withS3Bucket(event, s3Bucket => withFileName(event, async fileName => {
        try {
            const result = await s3.getObject({
                Bucket: s3Bucket,
                Key: fileName
            }).promise()

            return {
                statusCode: HttpStatus.OK,
                headers: { 'content-type': '' },
                body: result.Body?.toString() || ''
            }
        } catch(err: any) {
            return mapAwsErrorToResponse(err)
        }
    }))
}

function createFile(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return withS3Bucket(event, s3Bucket => withFileName(event, async fileName => {
        await s3.putObject({
            Bucket: s3Bucket,
            Key: fileName,
            Body: `This file was created on ${new Date().toISOString()}`
        }).promise()

        return emptyResponse
    }))
}

function deleteFile(
    event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
    return withS3Bucket(event, s3Bucket => withFileName(event, async fileName => {
        try {
            await s3.deleteObject({
                Bucket: s3Bucket,
                Key: fileName
            }).promise()

            return emptyResponse
        } catch(err: any) {
            return mapAwsErrorToResponse(err)
        }
    }))
}