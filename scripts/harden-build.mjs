import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const distDirectory = resolve("dist");
const files = await collectJavaScript(distDirectory);
const audioRuntimeFiles = files.filter(isAudioRuntime);
const filesToHarden = files.filter((file) => !isAudioRuntime(file));

if (files.length === 0) {
  throw new Error("No JavaScript files were found in dist. Run the production build first.");
}

for (const file of filesToHarden) {
  const source = await readFile(file, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.35,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: "hexadecimal",
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    simplify: true,
    sourceMap: false,
    splitStrings: true,
    splitStringsChunkLength: 8,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayCallsTransformThreshold: 0.5,
    stringArrayEncoding: ["base64"],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.8,
    target: "browser",
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  });

  await writeFile(file, result.getObfuscatedCode(), "utf8");
}

console.log(`Hardened ${filesToHarden.length} JavaScript files; kept ${audioRuntimeFiles.length} audio runtime files optimized.`);

function isAudioRuntime(file) {
  const name = basename(file);
  return name.startsWith("analysis.worker-")
    || name === "pcm-capture-worklet.js"
    || name === "offscreen.js";
}

async function collectJavaScript(directory) {
  const entries = await readdir(directory);
  const matches = [];

  for (const entry of entries) {
    const path = resolve(directory, entry);
    const details = await stat(path);
    if (details.isDirectory()) matches.push(...await collectJavaScript(path));
    else if (entry.endsWith(".js")) matches.push(path);
  }

  return matches;
}
