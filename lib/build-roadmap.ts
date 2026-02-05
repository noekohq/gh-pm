import { GoogleGenAI } from "@google/genai";
import { $ } from "bun";

export interface GitHubProjectItem {
  id: string;
  content: {
    title: string;
    body: string;
    url: string;
    number: number;
    labels?: string[];
  };
  "Roadmap Horizon"?: "Now" | "Next" | "Shipped";
}

export interface ProjectResponse {
  items: GitHubProjectItem[];
}

const STATUS_MAP: Record<"Now" | "Next" | "Shipped", string> = {
  Now: "Now",
  Next: "Next",
  Shipped: "Shipped",
};

export interface RoadmapItem {
  id: string;
  title: string;
  summary: string;
  status: keyof typeof STATUS_MAP;
  url: string;
  labels: string[];
}

// --- CONFIG ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ORG_NAME = process.env.GH_ORG_NAME;
const PROJECT_NUMBER = process.env.GH_PROJECT_NO;
const TARGET_FIELD = (process.env.GH_TARGET_FIELD || "roadmap Horizon") as keyof GitHubProjectItem;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!ORG_NAME) {
  throw new Error("No GH_ORG_NAME defined");
}
if (!PROJECT_NUMBER) {
  throw new Error("No GH_PROJECT_NO defined");
}
if (!TARGET_FIELD) {
  throw new Error("No GH_TARGET_FIELD defined");
}
if (!GEMINI_MODEL) {
  throw new Error("No GEMINI_MODEL defined");
}
if (!GEMINI_API_KEY) {
  throw new Error("No GEMINI_API_KEY provided");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function main() {
  const data =
    (await $`gh project item-list ${PROJECT_NUMBER} --owner ${ORG_NAME} --format json`
      .quiet()
      .json()) as ProjectResponse;

  console.info(`Received ${data.items.length} total items. Filtering...`);
  // Bun.write("./data/test.json", JSON.stringify(data.items));
  // return;

  const roadmap: RoadmapItem[] = [];

  for (const item of data.items) {
    const horizonValue = item[TARGET_FIELD] as keyof typeof STATUS_MAP;
    if (!horizonValue) continue;

    const publicStatus = STATUS_MAP[horizonValue];
    if (!publicStatus) continue;

    console.info(
      `⚡ Processing: ${item.content.title} [${horizonValue} -> ${publicStatus}]`,
    );

    const summary = await generateSummary(
      item.content.title,
      item.content.body,
      publicStatus,
    );

    roadmap.push({
      id: item.id,
      title: item.content.title,
      summary,
      status: publicStatus as keyof typeof STATUS_MAP,
      url: item.content.url,
      labels: item.content.labels || [],
    });
  }

  const order = { Shipped: 0, Now: 1, Next: 2 };
  roadmap.sort((a, b) => order[a.status] - order[b.status]);

  // Split and limit Shipped (Done) items
  const shipped = roadmap.filter(i => i.status === "Shipped").slice(0, 10);
  const others = roadmap.filter(i => i.status !== "Shipped");
  const finalRoadmap = [...shipped, ...others];

  const outputDir = "generated";
  if (!(await Bun.file(outputDir).exists())) {
    await $`mkdir -p ${outputDir}`;
  }

  await Bun.write(`${outputDir}/roadmap.json`, JSON.stringify(finalRoadmap, null, 2));
  console.log(`✅ Roadmap saved with ${finalRoadmap.length} items.`);
}

async function generateSummary(title: string, body: string, status: string) {
  try {
    if (!GEMINI_MODEL) {
      throw new Error("Can't generate summary with no GEMINI_MODEL defined");
    }
    const prompt = `
      You are a Product Marketing Manager writing a public roadmap.

      Task: Write EXACTLY ONE sentence summarizing this feature for a user.
      Context: This feature is currently '${status}'.

      Constraints:
      1. STRICTLY ONE sentence only.
      2. No lists, no bullet points, no "Here are options."
      3. No technical jargon (e.g., "transclusions", "latency").
      4. Use an exciting but professional tone.
      5. Output ONLY the summary text. Nothing else.

      Input Ticket:
      Title: "${title}"
      Body: "${body ? body.slice(0, 500) : ""}"
    `;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });
    if (!response) {
      throw new Error("Couldn't generate summary.");
    }
    return response.text?.trim() || title;
  } catch {
    return title;
  }
}

main();
