/**
 * Application lifecycle boundary.
 * Owns start/stop semantics but not trading logic.
 */

export function createLifecycle({
  scheduler,
  stopPolling,
  getOpenPositions,
  logger = () => {},
  exit = (code) => process.exit(code),
}) {
  let shuttingDown = false;

  async function shutdown(signal = "UNKNOWN") {
    if (shuttingDown) return;
    shuttingDown = true;
    logger("shutdown", `Received ${signal}. Shutting down...`);

    try {
      scheduler?.stop();
      stopPolling?.();
      const positions = await getOpenPositions?.();
      if (positions) {
        logger("shutdown", `Open positions at shutdown: ${positions.total_positions ?? positions.positions?.length ?? 0}`);
      }
    } catch (error) {
      logger("shutdown_error", `Shutdown cleanup failed: ${error.message}`);
    } finally {
      exit(0);
    }
  }

  function installSignalHandlers() {
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }

  return {
    shutdown,
    installSignalHandlers,
    isShuttingDown: () => shuttingDown,
  };
}
