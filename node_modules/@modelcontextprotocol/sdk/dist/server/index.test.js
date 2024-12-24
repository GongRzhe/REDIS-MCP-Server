/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-constant-binary-expression */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { Server } from "./index.js";
import { z } from "zod";
import { RequestSchema, NotificationSchema, ResultSchema } from "../types.js";
/*
Test that custom request/notification/result schemas can be used with the Server class.
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
    // Create a typed Server for weather data
    const weatherServer = new Server({
        name: "WeatherServer",
        version: "1.0.0",
    });
    // Typecheck that only valid weather requests/notifications/results are allowed
    weatherServer.setRequestHandler(GetWeatherRequestSchema, (request) => {
        return {
            temperature: 72,
            conditions: "sunny",
        };
    });
    weatherServer.setNotificationHandler(WeatherForecastNotificationSchema, (notification) => {
        console.log(`Weather alert: ${notification.params.message}`);
    });
});
//# sourceMappingURL=index.test.js.map