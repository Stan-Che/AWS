// Import the AWS SDK
const AWS = require('aws-sdk');

// Export the handler function
exports.handler = async (event, context) => {
    // Log the received event for debugging
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Process each SNS message
    for (const record of event.Records) {
        if (record.Sns) {
            const message = record.Sns.Message;
            // Print message content to CloudWatch Logs
            console.log('SNS Message:', message);
        } else {
            console.error('Record does not contain SNS data:', record);
        }
    }

    // Return a success response
    return {
        statusCode: 200,
        body: JSON.stringify('SNS messages processed successfully')
    };
};