exports.handler = async ({ requestContext: { http } = {} } = {}) => {
    // console.log('event', event);
    // console.log('http', event?.requestContext?.http);
    const { path, method } = http;
    if (path == "/hello" && method === "GET") {
        return {
            statusCode: 200,
            body: "Hello from Lambda"
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify(`Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`)
    }
};
