const axios = require('axios');

exports.handler = async ({ requestContext: { http } = {} } = {}) => {
    const { path, method } = http;

    if (path == "/weather" && method === "GET") {
        const params = {
            url: 'https://api.open-meteo.com/v1/forecast',
            latitude: 52.52,
            longitude: 13.41,
            current: 'temperature_2m,wind_speed_10m',
            hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
            // current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',
            // hourly: 'temperature_2m,precipitation',
            // daily: 'weather_code,temperature_2m_max,temperature_2m_min'
        };
    
        const url = `${params.url}?latitude=${params.latitude}&longitude=${params.longitude}&current=${params.current}&hourly=${params.hourly}`;

        console.log('url', url);

        const { data } = await axios.get(url);

        console.log('data', data);
        
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    }

    return {
        statusCode: 400,
        body: JSON.stringify({'statusCode': 400, 'message': `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`})
    }
};
