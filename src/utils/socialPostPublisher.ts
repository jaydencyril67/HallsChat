export type PublishedSocialPost = {
  id: string;
  content: string;
  images?: string[];
  poll?: { question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[] } | null;
  backgroundColor?: string;
  createdAt: string;
  author: { id: string; name: string; username: string; profilePicture?: string } | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount?: number;
};

export type SocialPostPublishPhase = "idle" | "uploading" | "success" | "error";
export type SocialPostPublishState = {
  phase: SocialPostPublishPhase;
  status: string;
  message: string;
  lastPost: PublishedSocialPost | null;
  revision: number;
  failureRevision: number;
  failedInput: SocialPostPublishInput | null;
};

export type SocialPostPublishInput = {
  content: string;
  poll: { question: string; options: string[] } | null;
  backgroundColor?: string;
  images: File[];
};

type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string; message?: string };
import { finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from "./backgroundTasks";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
let state: SocialPostPublishState = { phase: "idle", status: "", message: "", lastPost: null, revision: 0, failureRevision: 0, failedInput: null };
const listeners = new Set<(next: SocialPostPublishState) => void>();

function updateState(patch: Partial<SocialPostPublishState>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener(state));
}

export function getSocialPostPublishState() {
  return state;
}

export function subscribeSocialPostPublishing(listener: (next: SocialPostPublishState) => void) {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

export function dismissSocialPostPublishStatus() {
  updateState({ phase: "idle", status: "", message: "" });
}

export function startSocialPostPublish(input: SocialPostPublishInput, token: string) {
  if (state.phase === "uploading") return;
  updateState({
    phase: "uploading",
    status: input.images.length ? "Preparing your post…" : "Publishing your post…",
    message: "",
    failedInput: null,
  });
  const backgroundTaskId = startBackgroundTask("Publishing post", input.images.length ? "Preparing your post…" : "Publishing your post…");
  void (async () => {
    try {
      const urls: string[] = [];
      for (let index = 0; index < input.images.length; index += 1) {
        const file = input.images[index];
        const preparingStatus = `Preparing image ${index + 1} of ${input.images.length}…`;
        updateState({ status: preparingStatus });
        updateBackgroundTask(backgroundTaskId, preparingStatus);
        const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const authPayload = await authResponse.json().catch(() => ({}));
        if (!authResponse.ok) throw new Error(authPayload.message || `Image ${index + 1} upload could not be prepared.`);
        const auth = authPayload as ImageKitAuth;
        if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) {
          throw new Error(`Image ${index + 1} upload authentication returned incomplete details.`);
        }

        const uploadingStatus = `Uploading image ${index + 1} of ${input.images.length}…`;
        updateState({ status: uploadingStatus });
        updateBackgroundTask(backgroundTaskId, uploadingStatus);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("publicKey", auth.publicKey);
        formData.append("token", auth.token);
        formData.append("signature", auth.signature);
        formData.append("expire", String(auth.expire));
        formData.append("useUniqueFileName", "true");
        const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || typeof payload.url !== "string") {
          throw new Error(payload.message || `Image ${index + 1} couldn't upload. Please try again.`);
        }
        urls.push(payload.url as string);
      }

      updateState({ status: "Publishing post…" });
      updateBackgroundTask(backgroundTaskId, "Publishing post to feed…");
      const response = await fetch(`${apiBase}/api/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: input.content,
          images: urls,
          poll: input.poll,
          backgroundColor: input.backgroundColor
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.post) throw new Error(payload.message || "Your post couldn't be published.");
      updateState({
        phase: "success",
        status: "Your post is live.",
        message: "Your post is live.",
        lastPost: payload.post as PublishedSocialPost,
        failedInput: null,
        revision: state.revision + 1
      });
      finishBackgroundTask(backgroundTaskId);
    } catch (error) {
      updateState({
        phase: "error",
        status: error instanceof Error ? error.message : "Your post couldn't be published.",
        message: error instanceof Error ? error.message : "Your post couldn't be published.",
        failedInput: input,
        failureRevision: state.failureRevision + 1
      });
      finishBackgroundTask(backgroundTaskId, error instanceof Error ? error.message : "Your post couldn't be published.");
    }
  })();
}
