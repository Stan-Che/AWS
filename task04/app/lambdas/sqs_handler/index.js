const AWS = require('aws-sdk');
const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

exports.handler = async (event, context) => {
    // Log the received event for debugging
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Process each SQS message
    for (const record of event.Records) {
        const messageBody = record.body;
        
        // Print message content to CloudWatch Logs
        console.log('Message Body:', messageBody);
        
        try {
            // Optional: Delete the message from the queue after processing
            const deleteParams = {
                QueueUrl: "https://sqs.eu-central-1.amazonaws.com/196241772369/cmtr-38ebc472-async_queue",
                ReceiptHandle: record.receiptHandle
            };
            
            await sqs.deleteMessage(deleteParams).promise();
            console.log(`Deleted message with receipt handle: ${record.receiptHandle}`);
        } catch (error) {
            console.error(`Failed to delete message with receipt handle: ${record.receiptHandle}`, error);
        }
    }

    // Return a success response
    return {
        statusCode: 200,
        body: JSON.stringify('Messages processed successfully')
    };
};