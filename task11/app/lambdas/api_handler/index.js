const AWS = require('aws-sdk');
const awsServerlessExpress = require('aws-serverless-express');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const userPoolName = process.env.booking_userpool;
const tablesTbl = process.env.tables_table;
const reservationsTbl = process.env.reservations_table;


const validator = require('validator');

const isPasswordValid = (password) => {
    const regex = new RegExp(/^[a-z0-9.$%_\-^*]+$/i);
    return password.length >= 12 && password.match(regex) !== null;
}

let getUserPoolId = async (userPoolName) => {
    let isTruncated = null;
    let nextToken = null;
    let poolId = null;

    do {
        const params = { MaxResults: 60 };
        if (nextToken) params.NextToken = nextToken;

        const pools = await cognito.listUserPools(params).promise();
        isTruncated = pools.NextToken ? true : false;
        nextToken = pools.NextToken;

        pools.UserPools.forEach(pool => {
            if (pool.Name === userPoolName) {
                poolId = pool.Id;
                isTruncated = false; // Immediately exit pagination when we have found the User Pool.
            }
        });
    } while (isTruncated);

    return poolId;
};

const getClientId = async (userPoolId, clientName) => {
    let isTruncated = null;
    let nextToken = null;
    let clientId = null;

    do {
        const params = {
            MaxResults: 60,
            UserPoolId: userPoolId
        };

        if (nextToken) {
            params.NextToken = nextToken;
        }

        const clientsResponse = await cognito.listUserPoolClients(params).promise();
        isTruncated = clientsResponse.NextToken ? true : false;
        nextToken = clientsResponse.NextToken;

        clientsResponse.UserPoolClients.forEach(client => {
            if (client.ClientName === clientName) {
                clientId = client.ClientId;
                isTruncated = false; // Immediately exit pagination when we have found the User Pool Client.
            }
        });

    } while (isTruncated);

    return clientId;
};

const setCorsHeaders = (res) => {
    res.set({
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Accept-Version': '*'
    });
}

var userPoolId = '';
var userPoolClientId = '';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/signin', async (req, res) => {

    setCorsHeaders(res);

    const { email, password } = req.body;

    if (!validator.isEmail(email)) {
        return res.status(400).send({ error: 'Invalid Email Address.' });
    }

    if (userPoolId == ''){
        userPoolId = await getUserPoolId(userPoolName);
        console.log(`User Pool Id: ${userPoolId}`);
        if (userPoolClientId == ''){
           userPoolClientId = await getClientId(userPoolId, 'client-app');
           console.log(`Client Id: ${userPoolClientId}`);
        }
    }

    let authParams = {
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        ClientId: userPoolClientId,
        UserPoolId: userPoolId,
        AuthParameters: {
            'USERNAME': email,
            'PASSWORD': password
        }
    };

    let authResponse = {};
    try {
        authResponse = await cognito.adminInitiateAuth(authParams).promise();

        if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            const challengeResponse = await cognito.adminRespondToAuthChallenge({
                ClientId: userPoolClientId,
                ChallengeName: 'NEW_PASSWORD_REQUIRED',
                UserPoolId: userPoolId,
                ChallengeResponses: {
                    'USERNAME': email,
                    'NEW_PASSWORD': password   // In this case, the initial password will continue to be used
                },
                Session: authResponse.Session   // This is required to match the original auth session
            }).promise();

            authResponse = challengeResponse;   // Overwrite the original auth response with the final auth response
        }

        res.send({ accessToken: authResponse.AuthenticationResult.IdToken });
    } catch (err) {
        res.status(400).send({ error: err.message });
    }
});

app.post('/signup',async (req, res) =>{

    setCorsHeaders(res);

    const { firstName, lastName, email, password } = req.body;  // get details from request body

    if (!validator.isEmail(email)) {
        return res.status(400).send({ error: 'Invalid Email Address.' });
    }

    if (userPoolId == ''){
        userPoolId = await getUserPoolId(userPoolName);
        console.log(`User Pool Id: ${userPoolId}`);
        if (userPoolClientId == ''){
           userPoolClientId = await getClientId(userPoolId, 'client-app');
           console.log(`Client Id: ${userPoolClientId}`);
        }
    }

    // validate password using schema
    if (!isPasswordValid(password)) {
        console.log(`Password Invalid: ${password}`);
        return res.status(400).send({ error: 'Invalid Password.' });
    }

    let params = {
        UserPoolId: userPoolId ,
        Username: email ,
        MessageAction: 'SUPPRESS',
        TemporaryPassword: password,
        UserAttributes: [
            {
                Name: 'given_name',
                Value: firstName
            },
            {
                Name: 'family_name',
                Value: lastName
            },
            {
                Name: 'email',
                Value: email
            }
        ]
      };

    cognito.adminCreateUser(params, function(err, data) {
    if(err){
         //error from cognito
        res.status(400).send({ error: err });
        } else {
          res.status(200).send('User created');
        }
      });
});

app.all('/tables', async (req, res) => {

    setCorsHeaders(res);

    //const accessToken = req.headers.authorization.split(' ')[1];

    try {
        // Validate the access token
        /*const getUserParams = {
            AccessToken: accessToken
        };

        console.log(getUserParams);

        let user = await cognito.getUser(getUserParams).promise();*/

        if(req.method === 'GET') {
            // Perform the DynamoDB query to get all tables
            const params = {
                TableName: tablesTbl
            };

            let tables = await dynamodb.scan(params).promise();

            res.send(JSON.stringify({tables: tables.Items}));
        }

        if(req.method === 'POST') {
            const { id, number, places, isVip, minOrder } = req.body;

            // store the new table into DynamoDB
            const params = {
                TableName: tablesTbl,
                Item: { id, number, places, isVip, minOrder}
            };

            await dynamodb.put(params).promise();

            res.send({ id });
        }
    } catch(err) {
        res.status(400).send({ error: "Failed with error: " + err });
    }
});

// other code...

app.get('/tables/:tableId', async (req, res) => {

    setCorsHeaders(res);

    //const accessToken = req.headers.authorization.split(' ')[1];

    /*let getUserParams = {
        AccessToken: accessToken
    };*/

    try {
        //let user = await cognito.getUser(getUserParams).promise();

        // Perform the DynamoDB query to get the table data
        let params = {
            TableName: tablesTbl,
            Key: {
                'id': parseInt(req.params.tableId, 10)
            }
        };

        let tableData = await dynamodb.get(params).promise();

        res.send(tableData.Item);
    } catch(err) {
        res.status(400).send({ error: "Failed with error: " + err });
    }
});

app.all('/reservations', async (req, res) => {

    setCorsHeaders(res);

    //const accessToken = req.headers.authorization.split(' ')[1];

    try {
        /*let getUserParams = {
            AccessToken: accessToken
        };

        let user = await cognito.getUser(getUserParams).promise();*/

        if(req.method === 'GET') {
            // Perform the DynamoDB query to get all tables
            const params = {
                TableName: reservationsTbl
            };

            let reservations = await dynamodb.scan(params).promise();

            let filteredReservations = reservations.Items.map(item => {
            return {
                   tableNumber: item.tableNumber,
                   clientName: item.clientName,
                   phoneNumber: item.phoneNumber,
                   date: item.date,
                   slotTimeStart: item.slotTimeStart,
                   slotTimeEnd: item.slotTimeEnd
                   }
            });

            res.send(JSON.stringify({ reservations: filteredReservations}));

        }

        if(req.method === 'POST') {
            const { tableNumber, clientName, phoneNumber, date, slotTimeStart, slotTimeEnd } = req.body;

            const reservationId = uuidv4();

            // Check if the table exists in "Tables" table
            let tableParams = {
                TableName: tablesTbl,
                FilterExpression: '#number = :number',
                ExpressionAttributeNames: {
                    '#number': 'number'
                },
                ExpressionAttributeValues: {
                    ':number': tableNumber
                }
            };

            let tablesData = await dynamodb.scan(tableParams).promise();

            if (!tablesData.Items || tablesData.Items.length === 0) {
                return res.status(400).send({ error: `Table with number ${tableNumber} does not exist.` });
            }

            // Check for overlapping reservations
            let reservationParams = {
                TableName: reservationsTbl,
                FilterExpression: "#tableNumber = :tableNumber AND #date = :date AND ((#start >= :start AND #start < :end) OR (#end > :start AND #end <= :end))",
                ExpressionAttributeNames: {
                    "#tableNumber": "tableNumber",
                    "#date": "date",
                    "#start": "slotTimeStart",
                    "#end": "slotTimeEnd"
                },
                ExpressionAttributeValues: {
                    ":tableNumber": tableNumber,
                    ":date": date,
                    ":start": slotTimeStart,
                    ":end": slotTimeEnd
                }
            };

            let overlapData = await dynamodb.scan(reservationParams).promise();

            if (overlapData.Items && overlapData.Items.length > 0) {
                return res.status(400).send({ error: `Table with number ${tableNumber} already has a booking in the requested slot.` });
            }

            // Store the new reservation into DynamoDB
            let params = {
                TableName: reservationsTbl,
                Item: {
                    id: reservationId,
                    tableNumber,
                    clientName,
                    phoneNumber,
                    date,
                    slotTimeStart,
                    slotTimeEnd
                }
            };

            await dynamodb.put(params).promise();

            res.send({ reservationId: reservationId });
        }
    } catch(err) {
        res.status(400).send({ error: "Failed with error: " + err });
    }
});

const server = awsServerlessExpress.createServer(app);

exports.handler = (event, context) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);
  awsServerlessExpress.proxy(server, event, context);
}