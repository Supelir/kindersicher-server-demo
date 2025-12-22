import { config } from "dotenv";

config();

function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value ?? defaultValue!;
}


export const MQTT_URL = getEnv("MQTT_URL", "mqtt://mqtt:1883");
export const MQTT_USERNAME = getEnv("MQTT_USERNAME", "");
export const MQTT_PASSWORD = getEnv("MQTT_PASSWORD", "");
export const MQTT_TOPIC = getEnv("MQTT_TOPIC", "kindersecure/gate/events");
export const MQTT_STATUS_TOPIC = getEnv(
  "MQTT_STATUS_TOPIC",
  "kindersecure/gate/status",
);
