import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Phone, PhoneCall, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera, X } from "lucide-react";

type Person = { id: string; name: string; username: string; profilePicture?: string };
type Incoming = { callId: string; kind: "audio" | "video"; caller: Person; createdAt: number };
type Props = { socket: Socket | null; currentUserId: string; person: Person | null };

export default function CallsPanel({ socket, currentUserId, person }: Props) {
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<"audio" | "video">("audio");
  const [phase, setPhase] = useState<"idle" | "outgoing" | "incoming" | "connecting" | "connected">("idle");
  const [peerName, setPeerName] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [callError, setCallError] = useState("");
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const localAudio = useRef<HTMLAudioElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeCallRef = useRef("");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    streamRef.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    });
    pcRef.current = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = event => {
      if (event.candidate) socket?.emit("call:ice", { callId: id, candidate: event.candidate.toJSON() });
    };
    pc.ontrack = event => {
      const remote = event.streams[0];
      if (remoteVideo.current) remoteVideo.current.srcObject = remote;
      if (remoteAudio.current) remoteAudio.current.srcObject = remote;
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
      if (timeoutError || !response?.ok || !response.callId) {
        setCallError(response?.message || "Couldn't start the call. Please try again.");
        return;
      }
      activeCallRef.current = response.callId;
      setCallId(response.callId); setKind(callKind); setPeerName(person.name); setPhase("outgoing");
      try {
        const pc = await createPeer(response.callId, callKind === "video");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("call:offer", { callId: response.callId, description: pc.localDescription });
      } catch {
        socket.emit("call:end", { callId: response.callId });
        cleanup("Microphone or camera access failed. Allow permissions and try again.");
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
    } catch {
      socket.emit("call:decline", { callId: call.callId });
      cleanup("Microphone or camera access failed. Allow permissions and try again.");
    }
  }, [socket, incoming, createPeer, cleanup]);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (call: Incoming) => {
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
  }, [socket, incoming?.callId, cleanup]);

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
      <button type="button" title="Audio call" aria-label={"Audio call " + person.name} onClick={() => startCall("audio")} disabled={phase !== "idle"}><Phone size={18} /></button>
      <button type="button" title="Video call" aria-label={"Video call " + person.name} onClick={() => startCall("video")} disabled={phase !== "idle"}><Video size={18} /></button>
    </div>}
    {incoming && phase === "incoming" && <div className="halls-call-backdrop" role="dialog" aria-modal="true" aria-label="Incoming call">
      <div className="halls-call-card">
        <div className="halls-call-avatar">{incoming.caller.profilePicture ? <img src={incoming.caller.profilePicture} alt="" /> : incoming.caller.name.slice(0,1).toUpperCase()}</div>
        <span className="halls-call-eyebrow">INCOMING {incoming.kind.toUpperCase()} CALL</span>
        <h2>{incoming.caller.name}</h2><p>@{incoming.caller.username}</p>
        <div className="halls-call-actions">
          <button className="halls-call-decline" type="button" onClick={() => { socket?.emit("call:decline", { callId: incoming.callId }); cleanup(); }} aria-label="Decline call"><PhoneOff /></button>
          <button className="halls-call-accept" type="button" onClick={() => void acceptCall()} aria-label="Accept call"><PhoneCall /></button>
        </div>
      </div>
    </div>}
    {phase !== "idle" && phase !== "incoming" && <div className="halls-call-backdrop" role="dialog" aria-modal="true" aria-label={kind + " call"}>
      <div className={"halls-call-stage " + (kind === "video" ? "halls-call-stage-video" : "")}>
        {kind === "video" && <><video ref={remoteVideo} className="halls-call-remote-video" autoPlay playsInline /><video ref={localVideo} className="halls-call-local-video" autoPlay muted playsInline /></>}
        <audio ref={remoteAudio} autoPlay /><audio ref={localAudio} autoPlay />
        <button className="halls-call-close" type="button" onClick={endCall} aria-label="Close call"><X /></button>
        {kind === "audio" && <div className="halls-call-avatar halls-call-avatar-large">{peerName.slice(0,1).toUpperCase()}</div>}
        <span className="halls-call-eyebrow">{kind.toUpperCase()} CALL</span><h2>{peerName}</h2>
        <p>{phase === "outgoing" ? "Calling…" : phase === "connecting" ? "Connecting…" : formatDuration(seconds)}</p>
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
