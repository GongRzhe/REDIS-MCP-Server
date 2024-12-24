/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Client } from "./index.js";
import { z } from "zod";
import { RequestSchema, NotificationSchema, ResultSchema } from "../types.js";
/*
Test that custom request/notification/result schemas can be used with the Client class.
*/
test("should typecheck", () => {
    const GetWeatherRequestSchema = RequestSchema.extend({
        method: z.literal("weather/get"),
        params: z.object({
            city: z.string(),
        }),
    });
    const GetForecastRequestSchema = RequestSchema.extend({
        method: z.literal("weather/forecast"),
        params: z.object({
            city: z.string(),
            days: z.number(),
        }),
    });
    const WeatherForecastNotificationSchema = NotificationSchema.extend({
        method: z.literal("weather/alert"),
        params: z.object({
            severity: z.enum(["warning", "watch"]),
            message: z.string(),
        }),
    });
    const WeatherRequestSchema = GetWeatherRequestSchema.or(GetForecastRequestSchema);
    const WeatherNotificationSchema = WeatherForecastNotificationSchema;
    const WeatherResultSchema = ResultSchema.extend({
        temperature: z.number(),
        conditions: z.string(),
    });
    // Create a typed Client for weather data
    const weatherClient = new Client({
        name: "WeatherClient",
        version: "1.0.0",
    });
    // Typecheck that only valid weather requests/notifications/results are allowed
    false &&
        weatherClient.request({
            method: "weather/get",
            params: {
                city: "Seattle",
            },
        }, WeatherResultSchema);
    false &&
        weatherClient.notification({
            method: "weather/alert",
            params: {
                severity: "warning",
                message: "Storm approaching",
            },
        });
});
//# sourceMappingURL=index.test.js.map