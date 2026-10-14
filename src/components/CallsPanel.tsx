import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import LoadingDots from "./LoadingDots";
import { Phone, PhoneCall, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";

type Person = { id: string; name: string; username: string; profilePicture?: string; canMessage: boolean };
type Incoming = { callId: string; kind: "audio" | "video"; caller: Person; createdAt: number };
type Props = { socket: Socket | null; person: Person | null; enableIncoming?: boolean };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function startCallTone(kind: "incoming" | "outgoing") {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return () => {};
  let context: AudioContext;
  try { context = new AudioContextClass(); } catch { return () => {}; }
  let stopped = false;
  const playBurst = () => {
    if (stopped || context.state === "closed") return;
    const now = context.currentTime;
    const notes = kind === "incoming"
      ? [{ at: 0, duration: 0.32, frequency: 440 }, { at: 0.42, duration: 0.32, frequency: 480 }, { at: 0.9, duration: 0.32, frequency: 440 }]
      : [{ at: 0, duration: 1.15, frequency: 440 }, { at: 0, duration: 1.15, frequency: 480 }];
    notes.forEach(note => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, now + note.at);
      gain.gain.exponentialRampToValueAtTime(0.075, now + note.at + 0.025);
      gain.gain.setValueAtTime(0.075, now + note.at + note.duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + note.at);
      oscillator.stop(now + note.at + note.duration);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  };
  void context.resume().then(() => { if (!stopped) playBurst(); }).catch(() => {});
  const interval = window.setInterval(playBurst, kind === "incoming" ? 2600 : 5000);
  return () => {
    stopped = true;
    window.clearInterval(interval);
    void context.close().catch(() => {});
  };
}

export default function CallsPanel({ socket, person, enableIncoming = true }: Props) {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<"audio" | "video">("audio");
  const [phase, setPhase] = useState<"idle" | "outgoing" | "incoming" | "connecting" | "connected">("idle");
  const [peerName, setPeerName] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callError, setCallError] = useState("");
  const [nativeCallAction, setNativeCallAction] = useState<{ action: "answer" | "decline"; callId: string } | null>(null);
  const [pendingCallKind, setPendingCallKind] = useState<"audio" | "video" | null>(null);
  const audioTriggerRef = useRef<HTMLButtonElement | null>(null);
  const videoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmPopoutRef = useRef<HTMLDivElement | null>(null);
  const [confirmPopoutPosition, setConfirmPopoutPosition] = useState({ left: 8, top: 8 });
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const localAudio = useRef<HTMLAudioElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeCallRef = useRef("");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useLayoutEffect(() => {
    if (!pendingCallKind) return;
    const reposition = () => {
      const anchor = (pendingCallKind === "audio" ? audioTriggerRef.current : videoTriggerRef.current)?.getBoundingClientRect();
      const popout = confirmPopoutRef.current;
      if (!anchor || !popout) return;
      const margin = 8;
      const gap = 8;
      const width = popout.offsetWidth;
      const height = popout.offsetHeight;
      let left = anchor.left;
      if (left + width > window.innerWidth - margin) left = anchor.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = anchor.bottom + gap;
      if (top + height > window.innerHeight - margin) top = anchor.top - height - gap;
      top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
      setConfirmPopoutPosition({ left, top });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [pendingCallKind, person?.name]);

  useEffect(() => {
    if (!pendingCallKind) return;
    const closeCallConfirmOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".halls-call-trigger-wrap")) return;
      setPendingCallKind(null);
    };
    document.addEventListener("pointerdown", closeCallConfirmOutside);
    return () => document.removeEventListener("pointerdown", closeCallConfirmOutside);
  }, [pendingCallKind]);

  const cleanup = useCallback((reason?: string) => {
    const pc = pcRef.current;
    if (pc) { pc.onicecandidate = null; pc.ontrack = null; pc.close(); }
    pcRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
    if (localAudio.current) localAudio.current.srcObject = null;
    if (remoteAudio.current) remoteAudio.current.srcObject = null;
    activeCallRef.current = "";
    setCallId(""); setIncoming(null); setPhase("idle"); setMuted(false); setCameraOff(false); setSeconds(0);
    if (reason) setCallError(reason);
  }, []);

  const createPeer = useCallback(async (id: string, video: boolean) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) throw new Error("Your HallsChat session has expired. Sign in again before calling.");

    const iceResponse = await fetch(`${apiBase}/api/calls/ice-servers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const icePayload = await iceResponse.json().catch(() => ({})) as { iceServers?: RTCIceServer[]; message?: string };
    if (!iceResponse.ok || !Array.isArray(icePayload.iceServers) || icePayload.iceServers.length === 0) {
      throw new Error(icePayload.message || "Could not prepare secure call connection servers. Please try again.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Request the browser's built-in acoustic echo canceller explicitly.
        echoCancellation: true,
        noiseSuppression: true,
        // Automatic gain control can pump/oscillate on some Android devices and WebViews.
        autoGainControl: false
      },
      video: video ? {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 24, max: 30 },
        facingMode: "user"
      } : false
    });
    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    const pc = new RTCPeerConnection({
      iceServers: icePayload.iceServers
    });
    pcRef.current = pc;
    stream.getTracks().forEach(track => {
      const sender = pc.addTrack(track, stream);
      // Keep speech clear and prioritize it over video when bandwidth is limited.
      if (track.kind === "audio") {
        const parameters = sender.getParameters();
        parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
        parameters.encodings[0].maxBitrate = 48000;
        void sender.setParameters(parameters).catch(() => {
          // Some Android WebViews do not support changing sender parameters.
        });
      } else if (track.kind === "video") {
        const parameters = sender.getParameters();
        parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
        parameters.encodings[0].maxBitrate = 1200000;
        parameters.encodings[0].maxFramerate = 24;
        void sender.setParameters(parameters).catch(() => {
          // Keep the call working if the WebView does not support these hints.
        });
      }
    });
    pc.onicecandidate = event => {
      if (event.candidate) socket?.emit("call:ice", { callId: id, candidate: event.candidate.toJSON() });
    };
    pc.ontrack = event => {
      // Keep incoming audio and video on separate elements. Set video muted BEFORE
      // attaching a stream, so Android WebViews cannot briefly play its audio too.
      if (event.track.kind === "audio" && remoteAudio.current) {
        const audioStream = new MediaStream([event.track]);
        remoteAudio.current.srcObject = audioStream;
        remoteAudio.current.muted = false;
        void remoteAudio.current.play().catch(() => {
          // Playback may require the user's first interaction in some mobile WebViews.
        });
      }
      if (event.track.kind === "video" && remoteVideo.current) {
        remoteVideo.current.muted = true;
        remoteVideo.current.srcObject = new MediaStream([event.track]);
        void remoteVideo.current.play().catch(() => {
          // Ignore autoplay restrictions; the muted video is only the picture.
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setPhase("connected");
      if (["failed", "disconnected"].includes(pc.connectionState) && activeCallRef.current) {
        setCallError("Connection interrupted. Check your network and try again.");
      }
    };
    return pc;
  }, [socket]);

  const startCall = useCallback((callKind: "audio" | "video") => {
    if (!socket?.connected || !person || !person.canMessage) {
      setCallError("Reconnect to HallsChat and choose an available contact before calling.");
      return;
    }
    setCallError("");
    socket.timeout(10000).emit("call:invite", { recipientId: person.id, kind: callKind }, async (timeoutError: Error | null, response: { ok?: boolean; callId?: string; message?: string }) => {
      if (timeoutError) {
        setCallError("The call server didn't respond. Deploy the latest HallsChats backend and confirm VITE_API_URL points to https://hallschats.onrender.com.");
        return;
      }
      if (!response?.ok || !response.callId) {
        setCallError(response?.message || "The call server rejected the request without an explanation. Check the HallsChats backend logs.");
        return;
      }
      activeCallRef.current = response.callId;
      setCallId(response.callId); setKind(callKind); setPeerName(person.name); setPhase("outgoing");
      try {
        const pc = await createPeer(response.callId, callKind === "video");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { callId: response.callId, description: pc.localDescription });
      } catch (error) {
        socket.emit("call:failed", { callId: response.callId });
        cleanup(error instanceof Error ? error.message : "Could not prepare the call. Check microphone/camera permissions and try again.");
      }
    });
  }, [socket, person, createPeer, cleanup]);

  const acceptCall = useCallback(async () => {
    if (!socket || !incoming) return;
    const call = incoming;
    setCallError("");
    try {
      const pc = await createPeer(call.callId, call.kind === "video");
      activeCallRef.current = call.callId;
      setCallId(call.callId); setKind(call.kind); setPeerName(call.caller.name); setIncoming(null); setPhase("connecting");
      socket.timeout(10000).emit("call:accept", { callId: call.callId }, (err: Error | null, response: { ok?: boolean; message?: string }) => {
        if (err || !response?.ok) cleanup(response?.message || "This call is no longer available.");
      });
      // Offers can arrive immediately after acceptance; the listener queues them below.
      const queued = (window as Window & { __hallsQueuedOffer?: { callId: string; description: RTCSessionDescriptionInit } }).__hallsQueuedOffer;
      if (queued?.callId === call.callId) {
        await pc.setRemoteDescription(queued.description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", { callId: call.callId, description: pc.localDescription });
        delete (window as Window & { __hallsQueuedOffer?: unknown }).__hallsQueuedOffer;
      }
    } catch (error) {
      socket.emit("call:decline", { callId: call.callId });
      cleanup(error instanceof Error ? error.message : "Could not prepare the call. Check microphone/camera permissions and try again.");
    }
  }, [socket, incoming, createPeer, cleanup]);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (call: Incoming) => {
      if (!enableIncoming) return;
      if (phaseRef.current !== "idle") {
        socket.emit("call:decline", { callId: call.callId });
        return;
      }
      setIncoming(call); setKind(call.kind); setPeerName(call.caller.name); setPhase("incoming");
    };
    const onAccepted = async (payload: { callId: string }) => {
      if (payload.callId !== activeCallRef.current || !pcRef.current) return;
      setPhase("connecting");
    };
    const onOffer = async (payload: { callId: string; description: RTCSessionDescriptionInit }) => {
      if (!payload?.callId || !payload.description) return;
      if (payload.callId !== activeCallRef.current || !pcRef.current) {
        (window as Window & { __hallsQueuedOffer?: { callId: string; description: RTCSessionDescriptionInit } }).__hallsQueuedOffer = payload;
        return;
      }
      try {
        await pcRef.current.setRemoteDescription(payload.description);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("call:answer", { callId: payload.callId, description: pcRef.current.localDescription });
      } catch { cleanup("Couldn't establish the call. Please try again."); }
    };
    const onAnswer = async (payload: { callId: string; description: RTCSessionDescriptionInit }) => {
      if (payload.callId !== activeCallRef.current || !pcRef.current) return;
      try { await pcRef.current.setRemoteDescription(payload.description); }
      catch { cleanup("The other person's connection could not be established."); }
    };
    const onIce = async (payload: { callId: string; candidate: RTCIceCandidateInit }) => {
      if (payload.callId !== activeCallRef.current || !pcRef.current) return;
      try { await pcRef.current.addIceCandidate(payload.candidate); } catch { /* Ignore late ICE candidates after teardown. */ }
    };
    const onDeclined = (payload: { callId: string }) => {
      if (payload.callId === activeCallRef.current) cleanup("Call declined.");
    };
    const onEnded = (payload: { callId: string; reason?: string }) => {
      if (payload.callId !== activeCallRef.current && payload.callId !== incoming?.callId) return;
      cleanup(payload.reason === "no-answer" ? "No answer." : undefined);
    };
    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:offer", onOffer);
    socket.on("call:answer", onAnswer);
    socket.on("call:ice", onIce);
    socket.on("call:declined", onDeclined);
    socket.on("call:ended", onEnded);
    return () => {
      socket.off("call:incoming", onIncoming); socket.off("call:accepted", onAccepted);
      socket.off("call:offer", onOffer); socket.off("call:answer", onAnswer);
      socket.off("call:ice", onIce); socket.off("call:declined", onDeclined); socket.off("call:ended", onEnded);
    };
  }, [socket, incoming?.callId, cleanup, enableIncoming]);

  // Receive Answer/Decline taps from the native Android lock-screen notification.
  useEffect(() => {
    const handleNativeCallAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; callId?: string }>).detail;
      if ((detail?.action === "answer" || detail?.action === "decline") && typeof detail.callId === "string" && detail.callId) {
        setNativeCallAction({ action: detail.action, callId: detail.callId });
      }
    };
    window.addEventListener("hallschat:native-call-action", handleNativeCallAction);
    return () => window.removeEventListener("hallschat:native-call-action", handleNativeCallAction);
  }, []);

  useEffect(() => {
    if (!incoming || !nativeCallAction || incoming.callId !== nativeCallAction.callId) return;
    const action = nativeCallAction.action;
    setNativeCallAction(null);
    if (action === "decline") {
      socket?.emit("call:decline", { callId: incoming.callId });
      setIncoming(null);
      setPhase("idle");
      setCallError("");
      return;
    }
    void acceptCall();
  }, [incoming?.callId, nativeCallAction, socket, acceptCall]);

  useEffect(() => {
    const toneKind = phase === "incoming" && incoming ? "incoming" : phase === "outgoing" ? "outgoing" : null;
    if (!toneKind) return;
    return startCallTone(toneKind);
  }, [phase, incoming?.callId]);

  useEffect(() => {
    if (phase !== "connected") return;
    const timer = window.setInterval(() => setSeconds(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const endCall = () => {
    if (socket && callId) socket.emit("call:end", { callId });
    cleanup();
  };
  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    streamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; });
    setCameraOff(next);
  };
  const formatDuration = (value: number) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;

  return <>
    {person && <div className="halls-call-triggers">
      <div className="halls-call-trigger-wrap">
        <button ref={audioTriggerRef} className="halls-call-trigger-audio" type="button" title={"Audio call " + person.name} aria-label={"Audio call " + person.name} onClick={() => setPendingCallKind(current => current === "audio" ? null : "audio")} disabled={phase !== "idle"}><Phone size={18} /><span>Audio call</span></button>
        {pendingCallKind === "audio" && phase === "idle" && <div ref={confirmPopoutRef} className="halls-call-confirm-popout" style={confirmPopoutPosition} role="dialog" aria-label="Confirm audio call">
          <strong>Start audio call?</strong>
          <span>Call <b>{person.name}</b> now?</span>
          <div><button type="button" className="halls-call-confirm-cancel" onClick={() => setPendingCallKind(null)}>Cancel</button><button type="button" className="halls-call-confirm-start" onClick={() => { setPendingCallKind(null); startCall("audio"); }}><Phone size={14} /> Start call</button></div>
        </div>}
      </div>
      <div className="halls-call-trigger-wrap">
        <button ref={videoTriggerRef} className="halls-call-trigger-video" type="button" title={"Video call " + person.name} aria-label={"Video call " + person.name} onClick={() => setPendingCallKind(current => current === "video" ? null : "video")} disabled={phase !== "idle"}><Video size={18} /><span>Video call</span></button>
        {pendingCallKind === "video" && phase === "idle" && <div ref={confirmPopoutRef} className="halls-call-confirm-popout" style={confirmPopoutPosition} role="dialog" aria-label="Confirm video call">
          <strong>Start video call?</strong>
          <span>Call <b>{person.name}</b> now?</span>
          <div><button type="button" className="halls-call-confirm-cancel" onClick={() => setPendingCallKind(null)}>Cancel</button><button type="button" className="halls-call-confirm-start" onClick={() => { setPendingCallKind(null); startCall("video"); }}><Video size={14} /> Start call</button></div>
        </div>}
      </div>
    </div>}
    {incoming && phase === "incoming" && <div className="halls-call-backdrop" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="halls-call-card">
        <div className="halls-call-avatar">{incoming.caller.profilePicture ? <img src={incoming.caller.profilePicture} alt="" /> : incoming.caller.name.slice(0,1).toUpperCase()}</div>
        <span className="halls-call-eyebrow">INCOMING {incoming.kind.toUpperCase()} CALL</span>
        <h2>{incoming.caller.name}</h2><p>@{incoming.caller.username}</p><p className="halls-call-ring-time">Ringing…</p>
        <div className="halls-call-actions">
          <button className="halls-call-decline" type="button" onClick={() => { socket?.emit("call:decline", { callId: incoming.callId }); cleanup(); }} aria-label="Decline call"><PhoneOff /></button>
          <button className="halls-call-accept" type="button" onClick={() => void acceptCall()} aria-label="Accept call"><PhoneCall /></button>
        </div>
      </div>
    </div>}
    {phase !== "idle" && phase !== "incoming" && <div className="halls-call-backdrop" role="dialog" aria-modal="true" aria-label={kind + " call"}>
      <div className={"halls-call-stage " + (kind === "video" ? "halls-call-stage-video" : "")}>
        {kind === "video" && <><video ref={remoteVideo} className="halls-call-remote-video" autoPlay playsInline /><video ref={localVideo} className="halls-call-local-video" autoPlay muted playsInline /></>}
        <audio ref={remoteAudio} autoPlay playsInline /><audio ref={localAudio} autoPlay muted playsInline />
        <button className="halls-call-close" type="button" onClick={endCall} aria-label="Close call"><X /></button>
        {kind === "audio" && <div className="halls-call-avatar halls-call-avatar-large">{peerName.slice(0,1).toUpperCase()}</div>}
        <span className="halls-call-eyebrow">{kind.toUpperCase()} CALL</span><h2>{peerName}</h2>
        <p>{phase === "outgoing" ? "Ringing…" : phase === "connecting" ? <LoadingDots /> : formatDuration(seconds)}</p>
        {callError && <p className="halls-call-error">{callError}</p>}
        <div className="halls-call-controls">
          <button type="button" className={muted ? "is-active" : ""} onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff /> : <Mic />}</button>
          {kind === "video" && <button type="button" className={cameraOff ? "is-active" : ""} onClick={toggleCamera} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}>{cameraOff ? <VideoOff /> : <Video />}</button>}
          <button type="button" className="halls-call-hangup" onClick={endCall} aria-label="End call"><PhoneOff /></button>
        </div>
      </div>
    </div>}
    {callError && phase === "idle" && <div className="halls-call-toast" role="status"><span>{callError}</span><button type="button" onClick={() => setCallError("")} aria-label="Dismiss">×</button></div>}
  </>;
}
