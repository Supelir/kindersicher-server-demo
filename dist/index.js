"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mqtt_1 = __importDefault(require("mqtt"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const TAG_LABELS_FILE = (_a = process.env.TAG_LABELS_FILE) !== null && _a !== void 0 ? _a : "tags.csv";
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
let clients = [];
function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === "\"") {
            if (inQuotes && line[i + 1] === "\"") {
                current += "\"";
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === ";" && !inQuotes) {
            values.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    values.push(current.trim());
    return values;
}
function loadTagLabels(filePath) {
    const labels = new Map();
    if (!fs_1.default.existsSync(filePath)) {
        console.warn("[TAGS] labels file not found:", filePath);
        return labels;
    }
    const raw = fs_1.default.readFileSync(filePath, "utf8");
    raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .forEach((line) => {
        const [tag, label] = parseCsvLine(line);
        if (!tag || !label)
            return;
        if (tag.toLowerCase() === "tag" && label.toLowerCase() === "label")
            return;
        labels.set(tag, label);
    });
    console.log("[TAGS] loaded", labels.size, "labels from", filePath);
    return labels;
}
const tagLabels = loadTagLabels(path_1.default.resolve(process.cwd(), TAG_LABELS_FILE));
app.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    clients.push(res);
    req.on("close", () => {
        clients = clients.filter((c) => c !== res);
    });
});
app.post("/reset", (req, res) => {
    console.log("[HTTP] /reset called");
    broadcast({ active: false });
    res.status(200).send("OK");
});
function broadcast(obj) {
    const data = `data: ${JSON.stringify(obj)}\n\n`;
    clients.forEach((res) => res.write(data));
}
const mqttClient = mqtt_1.default.connect(config_1.MQTT_URL);
mqttClient.on("connect", () => {
    console.log("[MQTT] connected:", config_1.MQTT_URL);
    mqttClient.subscribe([config_1.MQTT_TOPIC, config_1.MQTT_STATUS_TOPIC], { qos: 1 }, (err) => {
        if (err) {
            console.error("[MQTT] subscribe error:", err);
            return;
        }
        console.log("[MQTT] subscribed:", config_1.MQTT_TOPIC);
        console.log("[MQTT] subscribed:", config_1.MQTT_STATUS_TOPIC);
    });
});
mqttClient.on("message", (topic, msg) => {
    let event;
    try {
        event = JSON.parse(msg.toString());
    }
    catch (_a) {
        return;
    }
    console.log("[MQTT] event:", event);
    const tag = typeof event.raw === "string" ? event.raw : undefined;
    const label = tag ? tagLabels.get(tag) : undefined;
    const enriched = label ? Object.assign(Object.assign({}, event), { label }) : event;
    broadcast({ active: true, event: Object.assign(Object.assign({}, enriched), { _topic: topic }) });
    //setTimeout(() => broadcast({ active: false }), 2000);
});
mqttClient.on("error", (err) => {
    console.error("[MQTT] error:", err);
});
app.listen(3000, () => console.log("Backend on http://localhost:3000"));
//# sourceMappingURL=index.js.map