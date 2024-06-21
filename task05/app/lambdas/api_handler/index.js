const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const { principalId, content } = event;

    const item = {
        id: uuidv4(),
        principalId,
        createdAt: new Date().toISOString(),
        body: content
    };

    console.log('process.env.target_table', process.env.target_table);

    const params = {
        TableName:  process.env.target_table,
        Item: item
    };

    try {
        // Save the item to DynamoDB
        await dynamoDb.put(params).promise();
        console.log('Item saved successfully:', item);

        // Return a success response
        return {
            statusCode: 201,
            body: JSON.stringify(item)
        };
    } catch (error) {
        console.error('Error saving item:', error);

        // Return an error response
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error saving item', error: error.message })
        };
    }
};