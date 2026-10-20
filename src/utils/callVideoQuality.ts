export type CallVideoProfile = {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
  label: "data-saver" | "balanced" | "high";
};

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
};

/**
 * Pick a conservative starting profile from available device/network hints.
 * These hints are advisory only; WebRTC congestion control still governs the
 * actual bitrate when the network changes during a call.
 */
export function getCallVideoProfile(): CallVideoProfile {
  const nav = navigator as NavigatorWithHints;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 0;
  const connection = nav.connection;
  const downlink = connection?.downlink || 0;
  const constrainedNetwork = connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    (downlink > 0 && downlink < 1.2);

  if (constrainedNetwork || (memory > 0 && memory <= 2) || cores <= 4) {
    return { width: 426, height: 240, frameRate: 15, maxBitrate: 280_000, label: "data-saver" };
  }

  if (cores >= 8 && memory >= 6 && (!downlink || downlink >= 3) &&
      connection?.effectiveType !== "3g") {
    return { width: 1280, height: 720, frameRate: 30, maxBitrate: 1_500_000, label: "high" };
  }

  return { width: 640, height: 480, frameRate: 24, maxBitrate: 650_000, label: "balanced" };
}

export function configureCallVideoSender(sender: RTCRtpSender, profile: CallVideoProfile): void {
  try {
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    parameters.encodings[0].maxBitrate = profile.maxBitrate;
    parameters.encodings[0].maxFramerate = profile.frameRate;
    parameters.degradationPreference = "maintain-framerate";
    void sender.setParameters(parameters).catch(() => {
      // Older Android WebViews may not support sender parameter tuning.
    });
  } catch {
    // Keep calls working if this browser does not support these controls.
  }
}
