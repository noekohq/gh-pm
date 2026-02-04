import { main as roadmapMain } from "./lib/build-roadmap";

const args = process.argv.slice(2); // Get command line arguments, excluding 'bun' and 'index.ts'

if (args.length === 0) {
  console.log("Usage: bun run index.ts <command>");
  console.log("Commands:");
  console.log("  roadmap - Generates the GitHub roadmap.");
  // Add other commands here as they are implemented
} else {
  const command = args[0];
  switch (command) {
    case "roadmap":
      roadmapMain();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log("Run 'bun run index.ts' for a list of available commands.");
  }
}
