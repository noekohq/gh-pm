# GitHub Roadmap Generator

This project provides a script to generate a public-facing roadmap from a GitHub Project, utilizing Google's Gemini AI for concise summaries of each roadmap item.

## Features

*   Fetches items from a specified GitHub Project.
*   Uses Google Gemini AI to generate user-friendly summaries for each item.
*   Outputs a sorted `roadmap.json` file in the `data/` directory.

## Setup

Before running the script, ensure you have the following installed and configured:

1.  **Bun**: This project uses the Bun runtime. If you don't have it, install it from [bun.sh](https://bun.sh/).
2.  **GitHub CLI (`gh`)**: The script relies on the GitHub CLI for interacting with GitHub Projects.
    *   Install `gh` from [cli.github.com](https://cli.github.com/).
    *   Authenticate `gh` by running `gh auth login`.
3.  **Environment Variables**: Set the following environment variables in your shell or a `.env` file:
    *   `GH_ORG_NAME`: The name of your GitHub organization or user (e.g., `google-gemini`).
    *   `GH_PROJECT_NO`: The number of the GitHub Project you want to fetch (e.g., `1`).
    *   `GEMINI_API_KEY`: Your Google Gemini API key. Obtain one from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Usage

To generate the roadmap, run the script from the project root:

```bash
bun run index.ts roadmap
```

This will fetch project items, generate summaries, and save the output to `data/roadmap.json`.