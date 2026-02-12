import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  Type,
} from "@google/genai";
import { $ } from "bun";

interface ICardContent {
  title: string;
  summary: string;
}

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
const TARGET_FIELD = (process.env.GH_TARGET_FIELD ||
  "roadmap Horizon") as keyof GitHubProjectItem;
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

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function main() {
  const data =
    (await $`gh project item-list ${PROJECT_NUMBER} --owner ${ORG_NAME} --limit 100 --format json`
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

    const content = await generateContent(
      item.content.title,
      item.content.body,
      publicStatus,
    );

    roadmap.push({
      id: item.id,
      title: content?.title || item.content.title,
      summary: content?.summary || "",
      status: publicStatus as keyof typeof STATUS_MAP,
      url: item.content.url,
      labels: item.content.labels || [],
    });
  }

  const order = { Shipped: 0, Now: 1, Next: 2 };
  roadmap.sort((a, b) => order[a.status] - order[b.status]);

  // Split and limit Shipped (Done) items
  const shipped = roadmap.filter((i) => i.status === "Shipped").slice(0, 10);
  const others = roadmap.filter((i) => i.status !== "Shipped");
  const finalRoadmap = [...shipped, ...others];

  const outputDir = "out";
  if (!(await Bun.file(outputDir).exists())) {
    await $`mkdir -p ${outputDir}`;
  }

  await Bun.write(
    `${outputDir}/roadmap.json`,
    JSON.stringify(finalRoadmap, null, 2),
  );
  console.log(`✅ Roadmap saved with ${finalRoadmap.length} items.`);
}

async function generateContent(
  title: string,
  body: string,
  status: string,
): Promise<ICardContent | undefined> {
  try {
    if (!GEMINI_MODEL) {
      throw new Error("Can't generate summary with no GEMINI_MODEL defined");
    }
    const prompt = `
You are a Product Marketing Manager writing a public roadmap.
Your task is to generate a user-friendly title and a one-sentence summary for a feature.

Context: This feature is currently '${status}'.

Constraints:
1. The summary must be STRICTLY ONE sentence.
2. No technical jargon (e.g., "transclusions", "latency").
3. Use an exciting but professional tone.

Input Ticket:
Title: "${title}"
Body: "${body ? body.slice(0, 2000) : ""}"
`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A user-friendly title for the feature.",
            },
            summary: {
              type: Type.STRING,
              description: "A one-sentence summary of the feature.",
            },
          },
          required: ["title", "summary"],
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      },
    });

    const jsonText = response.text;
    if (jsonText) {
      return JSON.parse(jsonText) as ICardContent;
    }
    return undefined;
  } catch (e) {
    console.error(`Couldn't generate content for "${title}"`, e);
    return undefined;
  }
}

main();
