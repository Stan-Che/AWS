const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    const content = {
        ids: new Array(10).fill(uuidv4())
    };

    const params = {
        Bucket: process.env.uuid_storage,
        Key: new Date().toISOString(),
        Body: JSON.stringify(content),
        ContentType: 'application/json'
    };

    console.log('params', params);

    try {
        const data = await s3.putObject(params).promise();
        console.log('File created successfully', data);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'File created successfully', data }),
        };
    } catch (err) {
        console.error('Error creating file', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error creating file', error: err }),
        };
    }
};