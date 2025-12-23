"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MQTT_STATUS_TOPIC = exports.MQTT_TOPIC = exports.MQTT_URL = void 0;
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
function getEnv(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value !== null && value !== void 0 ? value : defaultValue;
}
exports.MQTT_URL = getEnv("MQTT_URL", "mqtt://mqtt:1883");
exports.MQTT_TOPIC = getEnv("MQTT_TOPIC", "kindersecure/gate/events");
exports.MQTT_STATUS_TOPIC = getEnv("MQTT_STATUS_TOPIC", "kindersecure/gate/status");
//# sourceMappingURL=config.js.map