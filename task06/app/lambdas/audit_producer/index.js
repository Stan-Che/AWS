const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const eventNames = {
    INSERT: 'INSERT',
    MODIFY: 'MODIFY',
};

const constructItem = (eventName, key, newValue, oldValue) => {
    return {
        id: uuidv4(),
        itemKey: key,
        modificationTime: new Date().toISOString(),

        ...(eventName === eventNames.INSERT 
            ? { newValue: { key, value: newValue }}
            : { updatedAttribute: "value", oldValue, newValue }
        )
    }
}

exports.handler = async (event) => {
    console.log('event', event);
    console.log('event Records', event.Records);

    for (const record of event.Records) {
        const { eventName, dynamodb: { NewImage = {}, OldImage = {} } } = record;
        const { value: newValue, key } = NewImage;
        const { value: oldValue = {} } = OldImage;
        // console.log('dynamodb content', dynamodb);
        // console.log(`key ${key.S} | new value ${newValue.N}`);
        // console.log(`key ${key.S} | old value ${oldValue.N}`);
        
        // console.log('process.env.target_table', process.env.audit_table);
        
        const params = {
            TableName:  process.env.audit_table,
            Item: constructItem(eventName, key.S, newValue.N, oldValue.N),
        };
        
        console.log('params', params);
        try {
            await dynamoDb.put(params).promise();
            console.log('dynamodb put succeeded');
        } catch (err) {
            console.log('dynamodb put failed', err);
        }
    }
};