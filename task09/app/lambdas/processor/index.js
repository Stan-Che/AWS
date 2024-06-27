const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const params = {
        url: 'https://api.open-meteo.com/v1/forecast',
        latitude: 52.52,
        longitude: 13.41,
        current: 'temperature_2m,wind_speed_10m',
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    };

    const url = `${params.url}?latitude=${params.latitude}&longitude=${params.longitude}&current=${params.current}&hourly=${params.hourly}`;

    const { data: {
        elevation,
        generationtime_ms,
        hourly,
        hourly_units: { time, temperature_2m },
        latitude,
        longitude,
        timezone,
        timezone_abbreviation,
        utc_offset_seconds,
     }} = await axios.get(url);

    const dbParams = {
        TableName:  process.env.weather_table,
        Item: {
            id: uuidv4(),
            forecast: {
                elevation,
                generationtime_ms,
                hourly: {
                    time: hourly.time,
                    temperature_2m: hourly.temperature_2m,
                },
                hourly_units: {
                    time, temperature_2m
                },
                latitude,
                longitude,
                timezone,
                timezone_abbreviation,
                utc_offset_seconds,
            }
        },
    };
    
    try {
        await dynamoDb.put(dbParams).promise();
        console.log('dynamodb put succeeded');
    } catch (err) {
        console.log('dynamodb put failed', err);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    return response;
};
