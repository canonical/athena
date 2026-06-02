import { config } from "@components/config/config.js";

const workshopOllamaBinaryPath = `/var/lib/workshop/sdk/ollama/bin/ollama`;
const localOllamaBinaryPaths = [`/usr/bin/ollama`, `/usr/local/bin/ollama`];

export const getAthenaHomeDirectory = () => {
  return config.runtime.homeDirectory;
};

export const getAthenaOllamaBinaryCandidates = () => {
  return [config.runtime.ollamaBinaryPath, workshopOllamaBinaryPath, ...localOllamaBinaryPaths].filter((value): value is string => Boolean(value));
};
