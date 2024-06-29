const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const clientAppName = 'client-app';

const paths = {
    signup: '/signup',
    signin: '/signin',
    tables: '/tables',
    tableById: '/tables/{tableId}',
    reservations: '/reservations',
}

const mehtods = {
    post: 'POST',
    get: 'GET',
}

const getAppClientIdByUserPoolIdAndAppName = async (userPoolId, clientAppName) => {
    const { UserPoolClients } = await cognito.listUserPoolClients({
        UserPoolId: userPoolId,
        MaxResults: 60
    }).promise();

    const { ClientId } = UserPoolClients.find(client => client.ClientName === clientAppName);
    return ClientId;
}

const getCognitoUserPoolIdByUserPoolName = async (userPoolName) => {
    const data = await cognito.listUserPools({ MaxResults: 60 }).promise();
    const { Id } = data.UserPools.find(pool => pool.Name === userPoolName);
    return Id;
}

const signup = async ({ firstName, lastName, email, password }) => {
    try {
        const userPoolId = await getCognitoUserPoolIdByUserPoolName(process.env.booking_userpool);
        const clientId = await getAppClientIdByUserPoolIdAndAppName(userPoolId, clientAppName);

        // create cognito user
        const createUserParams = {
            UserPoolId: userPoolId,
            Username: email,
            UserAttributes: [
                {
                    Name: 'email',
                    Value: email
                },
                {
                    Name: 'given_name',
                    Value: firstName
                },
                {
                    Name: 'family_name',
                    Value: lastName
                }
            ],
            TemporaryPassword: password,
            MessageAction: 'SUPPRESS'
        };

        await cognito.adminCreateUser(createUserParams).promise();

        // confirm password
        const setPasswordParams = {
            UserPoolId: userPoolId,
            Username: email,
            Password: password,
            Permanent: true
        };
    
        await cognito.adminSetUserPassword(setPasswordParams).promise();

        // get token
        const params = {
            UserPoolId: userPoolId,
            ClientId: clientId,
            AuthFlow: 'ADMIN_NO_SRP_AUTH',
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };
    
        const { AuthenticationResult: {
            IdToken, AccessToken, RefreshToken
        } } = await cognito.adminInitiateAuth(params).promise();
    
        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({
                IdToken,
                AccessToken,
                RefreshToken
            }),
            isBase64Encoded: false,
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

const signin = async ({ email, password }) => {
    try {
        const userPoolId = await getCognitoUserPoolIdByUserPoolName(process.env.booking_userpool);
        const clientId = await getAppClientIdByUserPoolIdAndAppName(userPoolId, clientAppName);

        console.log('userPoolId', userPoolId, 'clientId', clientId);

        const params = {
            AuthFlow: 'USER_PASSWORD_AUTH', // Use 'USER_PASSWORD_AUTH' for standard username/password authentication
            ClientId: clientId,
            AuthParameters: {
                USERNAME: email,
                PASSWORD: password
            }
        };
    
        const { AuthenticationResult: {
            IdToken,
            AccessToken,
            RefreshToken,
            ExpiresIn,
        } } = await cognito.initiateAuth(params).promise();

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({
                idToken: IdToken,
                accessToken: IdToken,
                refreshToken: RefreshToken,
                expiresIn: ExpiresIn
            }),
            isBase64Encoded: false,
        };
    } catch (error) {
        console.log('error during singin', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

const postTables = async ({ id, ...table }) => {
    try {
        const params = {
            TableName:  process.env.tables_table,
            Item: {
                id: String(id),
                ...table
            },
        };

        await dynamoDb.put(params).promise();

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({ id: id }),
            isBase64Encoded: false,
        };

    } catch (error) {
        console.log('error during post tables', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}


const getTables = async () => {
    try {
        const params = {
            TableName: process.env.tables_table,
        };
    
        let tables = [];
        let lastEvaluatedKey = null;
    
        do {
            const data = await dynamoDb.scan(params).promise();
            tables = tables.concat(data.Items);
            lastEvaluatedKey = data.LastEvaluatedKey;
            params.ExclusiveStartKey = lastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({
                tables
            }),
            isBase64Encoded: false,
        };
    } catch (error) {
        console.log('error during getTables', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

const getTableById = async (id) => {
    try {
        const params = {
            TableName: process.env.tables_table,
            Key: { id }
        };
        
        const { Item } = await dynamoDb.get(params).promise();    

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify(Item),
            isBase64Encoded: false,
        };
    } catch (error) {
        console.log('error during getTableById', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

const postReservations = async (reservation) => {
    try {
        const id = uuidv4();
        const params = {
            TableName:  process.env.reservations_table,
            Item: {
                id,
                ...reservation
            },
        };

        await dynamoDb.put(params).promise();

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({ reservationId: id }),
            isBase64Encoded: false,
        };

    } catch (error) {
        console.log('error during post reservation', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

const getReservations = async () => {
    try {
        const params = {
            TableName: process.env.reservations_table,
        };
    
        let reservations = [];
        let lastEvaluatedKey = null;
    
        do {
            const data = await dynamoDb.scan(params).promise();
            reservations = reservations.concat(data.Items);
            lastEvaluatedKey = data.LastEvaluatedKey;
            params.ExclusiveStartKey = lastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify({
                reservations
            }),
            isBase64Encoded: false,
        };
    } catch (error) {
        console.log('error during getReservations', error);

        return {
            statusCode: 400,
            body: JSON.stringify(error)
        };
    }
}

exports.handler = async (event) => {
    console.log('event', event);
    const { resource, httpMethod, body, pathParameters = {} } = event;

    if (resource === paths.signup) {
        return await signup(JSON.parse(body));
    }
    if (resource === paths.signin) {
        return await signin(JSON.parse(body));
    }
    if (resource === paths.tables && httpMethod === mehtods.post) {
        return await postTables(JSON.parse(body));
    }
    if (resource === paths.tables && httpMethod === mehtods.get) {
        return await getTables(JSON.parse(body));
    }
    if (resource === paths.tableById && httpMethod === mehtods.get && pathParameters.tableId) {
        return await getTableById(pathParameters.tableId);
    }
    if (resource === paths.reservations && httpMethod === mehtods.post) {
        return await postReservations(JSON.parse(body));
    }
    if (resource === paths.reservations && httpMethod === mehtods.get) {
        return await getReservations(JSON.parse(body));
    }

    return {
        statusCode: 200,
        headers: {},
        body: 'All good',
        isBase64Encoded: false,
    }
};

// response model for proxy integration
// {
//     statusCode: "...",            // a valid HTTP status code
//     headers: { 
//         custom-header: "..."      // any API-specific custom header
//     },
//     body: "...",                  // a JSON string.
//     isBase64Encoded:  true|false  // for binary support
// }

const a = {
    resource: '/signup',
    path: '/signup',
    httpMethod: 'POST',
    headers: {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'CloudFront-Forwarded-Proto': 'https',
      'CloudFront-Is-Desktop-Viewer': 'true',
      'CloudFront-Is-Mobile-Viewer': 'false',
      'CloudFront-Is-SmartTV-Viewer': 'false',
      'CloudFront-Is-Tablet-Viewer': 'false',
      'CloudFront-Viewer-ASN': '5391',
      'CloudFront-Viewer-Country': 'HR',
      'Content-Type': 'application/json',
      Host: 'eahycynqpj.execute-api.eu-central-1.amazonaws.com',
      'Postman-Token': '66435328-e2fa-475e-af80-3d168eb23678',
      'User-Agent': 'PostmanRuntime/7.39.0',
      Via: '1.1 87b272b7d9b97f38da15c91c833c3292.cloudfront.net (CloudFront)',
      'X-Amz-Cf-Id': 'CSCO2KJ-jKm_JX47leFJ79onmDuk0d0KNMd528rLdhM3nDLewfzDxg==',
      'X-Amzn-Trace-Id': 'Root=1-667e1e53-5981d27e0a6a7b92045a96ee',
      'X-Forwarded-For': '46.188.152.12, 70.132.34.145',
      'X-Forwarded-Port': '443',
      'X-Forwarded-Proto': 'https'
    },
    multiValueHeaders: {
      Accept: [ '*/*' ],
      'Accept-Encoding': [ 'gzip, deflate, br' ],
      'Cache-Control': [ 'no-cache' ],
      'CloudFront-Forwarded-Proto': [ 'https' ],
      'CloudFront-Is-Desktop-Viewer': [ 'true' ],
      'CloudFront-Is-Mobile-Viewer': [ 'false' ],
      'CloudFront-Is-SmartTV-Viewer': [ 'false' ],
      'CloudFront-Is-Tablet-Viewer': [ 'false' ],
      'CloudFront-Viewer-ASN': [ '5391' ],
      'CloudFront-Viewer-Country': [ 'HR' ],
      'Content-Type': [ 'application/json' ],
      Host: [ 'eahycynqpj.execute-api.eu-central-1.amazonaws.com' ],
      'Postman-Token': [ '66435328-e2fa-475e-af80-3d168eb23678' ],
      'User-Agent': [ 'PostmanRuntime/7.39.0' ],
      Via: [
        '1.1 87b272b7d9b97f38da15c91c833c3292.cloudfront.net (CloudFront)'
      ],
      'X-Amz-Cf-Id': [ 'CSCO2KJ-jKm_JX47leFJ79onmDuk0d0KNMd528rLdhM3nDLewfzDxg==' ],
      'X-Amzn-Trace-Id': [ 'Root=1-667e1e53-5981d27e0a6a7b92045a96ee' ],
      'X-Forwarded-For': [ '46.188.152.12, 70.132.34.145' ],
      'X-Forwarded-Port': [ '443' ],
      'X-Forwarded-Proto': [ 'https' ]
    },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    requestContext: {
      resourceId: '6ufn31',
      resourcePath: '/signup',
      httpMethod: 'POST',
      extendedRequestId: 'aDmtIE1WFiAEAbQ=',
      requestTime: '28/Jun/2024:02:22:11 +0000',
      path: '/api/signup',
      accountId: '196241772369',
      protocol: 'HTTP/1.1',
      stage: 'api',
      domainPrefix: 'eahycynqpj',
      requestTimeEpoch: 1719541331740,
      requestId: '35b6f284-6c7f-446f-bbb3-d5ac7717d415',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '46.188.152.12',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'PostmanRuntime/7.39.0',
        user: null
      },
      domainName: 'eahycynqpj.execute-api.eu-central-1.amazonaws.com',
      deploymentId: 'poux5h',
      apiId: 'eahycynqpj'
    },
    body: '{\n' +
      '    "firstName": "John",\n' +
      '    "lastName": "Doe",\n' +
      '    "email": "af@gmail.com",\n' +
      '    "password": "alskfj3242$ASDFA"\n' +
      '}',
    isBase64Encoded: false
  }
  