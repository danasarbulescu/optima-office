let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const cmd = input.tool_input?.command || "";
    if (/git\s+push|&&\s*git\s+push/.test(cmd)) {
      console.log(
        JSON.stringify({
          systemMessage:
            "A git push was just executed. You MUST now run the deployment watch script in the background (run_in_background=true): npx tsx scripts/check-deployments.ts --watch. Do NOT block on the result with TaskOutput. Note the task ID so you can check it later. At the start of subsequent responses, check the background task non-blockingly (TaskOutput block=false). Only report the result once the deployment has completed (SUCCEED or FAILED) — do NOT mention it while still running.",
        })
      );
    }
  } catch {}
});
