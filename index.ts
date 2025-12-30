import express from "express";
import cors from "cors";
import mqtt from "mqtt";
import fs from "fs";
import path from "path";
import { MQTT_URL, MQTT_TOPIC, MQTT_STATUS_TOPIC, MQTT_USERNAME, MQTT_PASSWORD } from "./config";

const TAG_LABELS_FILE = process.env.TAG_LABELS_FILE ?? "tags.csv";

const app = express();
app.use(cors());

let clients = [];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
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

function loadTagLabels(filePath: string): Map<string, string> {
  const labels = new Map<string, string>();
  if (!fs.existsSync(filePath)) {
    console.warn("[TAGS] labels file not found:", filePath);
    return labels;
  }
MQTT_STATUS_TOPIC
  const raw = fs.readFileSync(filePath, "utf8");
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const [tag, label] = parseCsvLine(line);
      if (!tag || !label) return;
      if (tag.toLowerCase() === "tag" && label.toLowerCase() === "label") return;
      labels.set(tag, label);
    });

  console.log("[TAGS] loaded", labels.size, "labels from", filePath);
  return labels;
}

const tagLabels = loadTagLabels(path.resolve(process.cwd(), TAG_LABELS_FILE));

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

// Allow UI to send control signals (e.g., PASS) which will be published to MQTT
app.post('/signal', express.json(), (req, res) => {
  const { gateId, signal } = req.body ?? {};
  if (typeof gateId !== 'string' || typeof signal !== 'string') {
    res.status(400).send('gateId and signal required');
    return;
  }
  const payload = { gateId, signal, timestamp: Date.now() };
  mqttClient.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error('[MQTT] publish failed for /signal:', err);
      res.status(500).send('publish failed');
      return;
    }
    console.log('[HTTP] /signal published to MQTT:', payload);
    res.status(200).send('OK');
  });
});

function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  clients.forEach((res) => res.write(data));
}

const mqttClient = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
});

mqttClient.on("connect", () => {
  console.log("[MQTT] connected:", MQTT_URL);
  mqttClient.subscribe([MQTT_TOPIC, MQTT_STATUS_TOPIC], { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] subscribe error:", err);
      return;
    }
    console.log("[MQTT] subscribed:", MQTT_TOPIC);
    console.log("[MQTT] subscribed:", MQTT_STATUS_TOPIC);
  });
});

mqttClient.on("message", (topic, msg) => {
  let event;
  try {
    event = JSON.parse(msg.toString());
  } catch {
    return;
  }

  console.log("[MQTT] event:", event);

  const tag = typeof event.raw === "string" ? event.raw : undefined;
  const label = tag ? tagLabels.get(tag) : undefined;
  const enriched = label ? { ...event, label } : event;

  broadcast({ active: true, event: { ...enriched, _topic: topic } });

  //setTimeout(() => broadcast({ active: false }), 2000);
});

mqttClient.on("error", (err) => {
  console.error("[MQTT] error:", err);
});

app.listen(3000, () => console.log("Backend on http://localhost:3000"));
