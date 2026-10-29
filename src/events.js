import axios from "axios";

export async function graylogRequest(baseUrl, apiToken, method, path, { data, params } = {}) {
    const response = await axios.request({
        method,
        url: `${baseUrl}/api${path}`,
        data,
        params,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-By': 'graylog-mcp',
        },
        auth: {
            username: apiToken,
            password: 'token',
        },
    });
    return response.data;
}

export const searchEvents = (baseUrl, apiToken, payload) =>
    graylogRequest(baseUrl, apiToken, "POST", "/events/search", { data: payload });

export const fetchEventDefinitions = (baseUrl, apiToken, page, perPage, query) =>
    graylogRequest(baseUrl, apiToken, "GET", "/events/definitions", { params: { page, per_page: perPage, query } });

export const fetchEventNotifications = (baseUrl, apiToken, page, perPage) =>
    graylogRequest(baseUrl, apiToken, "GET", "/events/notifications", { params: { page, per_page: perPage } });
