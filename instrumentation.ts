export async function register() {
  // Only in the Node.js runtime, and only for the actual server process —
  // this must not run during `next build`'s static analysis/edge bundling.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startConnectionHealthJob } = await import("@/services/gateway/connection-health-job");
    startConnectionHealthJob();
  }
}
