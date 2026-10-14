import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";

type Participant = { id: string; name?: string; username?: string; profilePicture?: string };
type IncomingHallCall = { callId: string; groupId: string; kind: "audio" | "video"; caller: Participant; startedAt: number };
type PeerState = { pc: RTCPeerConnection; stream?: MediaStream };
type Props = { socket: Socket | null; hallId: string; hallName: string; currentUserId: string };

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const fallbackIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

export default function HallsCallPanel({ socket, hallId, hallName, currentUserId }: Props) {
  const [incoming, setIncoming] = useState<IncomingHallCall | null>(null);
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<"audio" | "video">("audio");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"audio" | "video" | null>(null);
  const [error, setError] = useState("");
  const audioTriggerRef = useRef<HTMLButtonElement | null>(null);
  const videoTriggerRef = useRef<HTMLButtonElement | null>(null);
  const confirmPopoutRef = useRef<HTMLDivElement | null>(null);
  const [confirmPopoutPosition, setConfirmPopoutPosition] = useState({ left: 8, top: 8 });
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(fallbackIceServers);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callIdRef = useRef("");
  const socketRef = useRef<Socket | null>(socket);
  socketRef.current = socket;

  const closePeers = useCallback(() => {
    peersRef.current.forEach(({ pc }) => pc.close());
    peersRef.current.clear();
    pendingIceRef.current.clear();
    setStreams({});
  }, []);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  const resetCall = useCallback((notify: boolean) => {
    const activeId = callIdRef.current;
    if (notify && activeId) socketRef.current?.emit("group-call:leave", { callId: activeId });
    callIdRef.current = "";
    setCallId("");
    setIncoming(null);
    setParticipants([]);
    setMuted(false);
    setCameraOff(false);
    closePeers();
    stopLocal();
  }, [closePeers, stopLocal]);

  const ensurePeer = useCallback((peerId: string) => {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing.pc;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    localStreamRef.current?.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current as MediaStream));
    pc.onicecandidate = event => {
      if (event.candidate) socketRef.current?.emit("group-call:signal", { callId: callIdRef.current, toUserId: peerId, signalType: "ice", payload: event.candidate.toJSON() });
    };
    pc.ontrack = event => {
      const stream = event.streams[0];
      if (stream) {
        const current = peersRef.current.get(peerId);
        if (current) current.stream = stream;
        setStreams(previous => ({ ...previous, [peerId]: stream }));
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pc.close();
        peersRef.current.delete(peerId);
        setStreams(previous => { const next = { ...previous }; delete next[peerId]; return next; });
      }
    };
    peersRef.current.set(peerId, { pc });
    return pc;
  }, []);

  const startLocalMedia = useCallback(async (callKind: "audio" | "video") => {
    // Reuse the backend's ICE/TURN configuration for Hall calls, not STUN-only
    // connectivity. Fall back to public STUN if the ICE endpoint is unavailable.
    const token = localStorage.getItem("hallschat_token");
    if (token) {
      try {
        const response = await fetch(`${apiBase}/api/calls/ice-servers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json().catch(() => ({})) as { iceServers?: RTCIceServer[] };
        if (response.ok && Array.isArray(payload.iceServers) && payload.iceServers.length) {
          iceServersRef.current = payload.iceServers;
        }
      } catch {
        iceServersRef.current = fallbackIceServers;
      }
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        // Avoid aggressive gain pumping, which can create the "wawawa" effect.
        autoGainControl: false
      },
      video: callKind === "video" ? {
        width: { ideal: 640, max: 640 },
        height: { ideal: 480, max: 480 },
        frameRate: { ideal: 20, max: 20 },
        facingMode: "user"
      } : false
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) { localVideoRef.current.srcObject = stream; void localVideoRef.current.play().catch(() => {}); }
  }, []);

  const joinCall = useCallback(async (id: string, callKind: "audio" | "video") => {
    if (!socketRef.current) throw new Error("Reconnect to Halls before calling.");
    await startLocalMedia(callKind);
    const result = await new Promise<{ ok?: boolean; message?: string; participants?: Participant[] }>((resolve, reject) => {
      socketRef.current!.timeout(10000).emit("group-call:join", { callId: id }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; participants?: Participant[] }) => {
        if (timeoutError) return reject(new Error("The Hall call timed out. Try again."));
        resolve(response);
      });
    });
    if (!result.ok) throw new Error(result.message || "Unable to join this Hall call.");
    callIdRef.current = id;
    setCallId(id);
    setKind(callKind);
    setIncoming(null);
    const peers = result.participants || [];
    setParticipants(peers);
    for (const participant of peers) {
      if (!participant.id || participant.id === currentUserId) continue;
      const pc = ensurePeer(participant.id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit("group-call:signal", { callId: id, toUserId: participant.id, signalType: "offer", payload: pc.localDescription });
    }
  }, [currentUserId, ensurePeer, startLocalMedia]);

  const startCall = useCallback(async (callKind: "audio" | "video") => {
    if (!socket || busy || callIdRef.current) return;
    setBusy(true); setError("");
    try {
      await startLocalMedia(callKind);
      const result = await new Promise<{ ok?: boolean; message?: string; callId?: string }>((resolve, reject) => {
        socket.timeout(10000).emit("group-call:start", { groupId: hallId, kind: callKind }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; callId?: string }) => {
          if (timeoutError) return reject(new Error("Unable to start the Hall call. Try again."));
          resolve(response);
        });
      });
      if (!result.ok || !result.callId) throw new Error(result.message || "Unable to start the Hall call.");
      callIdRef.current = result.callId;
      setCallId(result.callId); setKind(callKind);
      const joinResult = await new Promise<{ ok?: boolean; message?: string; participants?: Participant[] }>((resolve, reject) => {
        socket.timeout(10000).emit("group-call:join", { callId: result.callId }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; participants?: Participant[] }) => {
          if (timeoutError) return reject(new Error("The Hall call timed out. Try again."));
          resolve(response);
        });
      });
      if (!joinResult.ok) throw new Error(joinResult.message || "Unable to enter the Hall call.");
      setParticipants(joinResult.participants || []);
    } catch (e) {
      const id = callIdRef.current;
      if (id) socket.emit("group-call:leave", { callId: id });
      callIdRef.current = ""; setCallId("");
      closePeers(); stopLocal();
      setError(e instanceof Error ? e.message : "Unable to start the Hall call.");
    } finally { setBusy(false); }
  }, [socket, hallId, busy, startLocalMedia, closePeers, stopLocal]);

  useLayoutEffect(() => {
    if (!confirmKind) return;
    const reposition = () => {
      const anchor = (confirmKind === "audio" ? audioTriggerRef.current : videoTriggerRef.current)?.getBoundingClientRect();
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
  }, [confirmKind, hallName]);

  useEffect(() => {
    if (!confirmKind) return;
    const closeCallConfirmOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".halls-call-trigger-wrap, .halls-call-confirm-popout")) return;
      setConfirmKind(null);
    };
    document.addEventListener("pointerdown", closeCallConfirmOutside);
    return () => document.removeEventListener("pointerdown", closeCallConfirmOutside);
  }, [confirmKind]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (event: IncomingHallCall) => {
      if (event.groupId !== hallId || event.caller?.id === currentUserId || callIdRef.current) return;
      setIncoming(event);
    };
    const onPeerJoined = (event: { callId: string; participant: Participant }) => {
      if (event.callId !== callIdRef.current || !event.participant?.id) return;
      setParticipants(previous => previous.some(p => p.id === event.participant.id) ? previous : [...previous, event.participant]);
    };
    const onPeerLeft = (event: { callId: string; userId: string }) => {
      if (event.callId !== callIdRef.current) return;
      const peer = peersRef.current.get(event.userId);
      peer?.pc.close(); peersRef.current.delete(event.userId); pendingIceRef.current.delete(event.userId);
      setStreams(previous => { const next = { ...previous }; delete next[event.userId]; return next; });
      setParticipants(previous => previous.filter(p => p.id !== event.userId));
    };
    const onSignal = async (event: { callId: string; fromUserId: string; signalType: "offer" | "answer" | "ice"; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }) => {
      if (event.callId !== callIdRef.current || !event.fromUserId || event.fromUserId === currentUserId) return;
      try {
        const pc = ensurePeer(event.fromUserId);
        if (event.signalType === "offer") {
          await pc.setRemoteDescription(event.payload as RTCSessionDescriptionInit);
          const queued = pendingIceRef.current.get(event.fromUserId) || [];
          for (const candidate of queued) await pc.addIceCandidate(candidate);
          pendingIceRef.current.delete(event.fromUserId);
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          socket.emit("group-call:signal", { callId: event.callId, toUserId: event.fromUserId, signalType: "answer", payload: pc.localDescription });
        } else if (event.signalType === "answer") {
          await pc.setRemoteDescription(event.payload as RTCSessionDescriptionInit);
          const queued = pendingIceRef.current.get(event.fromUserId) || [];
          for (const candidate of queued) await pc.addIceCandidate(candidate);
          pendingIceRef.current.delete(event.fromUserId);
        } else {
          const candidate = event.payload as RTCIceCandidateInit;
          if (pc.remoteDescription) await pc.addIceCandidate(candidate);
          else pendingIceRef.current.set(event.fromUserId, [...(pendingIceRef.current.get(event.fromUserId) || []), candidate]);
        }
      } catch (e) { setError(e instanceof Error ? e.message : "A participant connection failed."); }
    };
    const onEnded = (event: { callId: string; groupId?: string }) => {
      if (event.groupId !== hallId || (callIdRef.current && event.callId !== callIdRef.current)) return;
      resetCall(false);
      setError("The Hall call has ended.");
    };
    socket.on("group-call:incoming", onIncoming);
    socket.on("group-call:peer-joined", onPeerJoined);
    socket.on("group-call:peer-left", onPeerLeft);
    socket.on("group-call:signal", onSignal);
    socket.on("group-call:ended", onEnded);
    return () => {
      socket.off("group-call:incoming", onIncoming); socket.off("group-call:peer-joined", onPeerJoined);
      socket.off("group-call:peer-left", onPeerLeft); socket.off("group-call:signal", onSignal); socket.off("group-call:ended", onEnded);
    };
  }, [socket, hallId, currentUserId, ensurePeer, resetCall]);

  useEffect(() => () => {
    if (callIdRef.current) socketRef.current?.emit("group-call:leave", { callId: callIdRef.current });
    peersRef.current.forEach(({ pc }) => pc.close()); peersRef.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => {});
    }
  }, [callId, kind]);

  const leave = () => resetCall(true);
  const active = Boolean(callId);
  return <>
    <div className="halls-call-triggers">
      <div className="halls-call-trigger-wrap">
        <button ref={audioTriggerRef} className="halls-call-trigger-audio" type="button" title="Start Hall audio call" aria-label="Start Hall audio call" disabled={!socket || busy || active} onClick={() => setConfirmKind(current => current === "audio" ? null : "audio")}><Phone size={18} /><span>Audio call</span></button>
      </div>
      <div className="halls-call-trigger-wrap">
        <button ref={videoTriggerRef} className="halls-call-trigger-video" type="button" title="Start Hall video call" aria-label="Start Hall video call" disabled={!socket || busy || active} onClick={() => setConfirmKind(current => current === "video" ? null : "video")}><Video size={18} /><span>Video call</span></button>
      </div>
    </div>
    {confirmKind && !active && <div ref={confirmPopoutRef} className="halls-call-confirm-popout" style={confirmPopoutPosition} role="dialog" aria-label={`Confirm Hall ${confirmKind} call`}>
      <strong>Start Hall {confirmKind} call?</strong>
      <span>Call <b>{hallName}</b> now?</span>
      <div><button type="button" className="halls-call-confirm-cancel" onClick={() => setConfirmKind(null)}>Cancel</button><button type="button" className="halls-call-confirm-start" onClick={() => { const selectedKind = confirmKind; setConfirmKind(null); void startCall(selectedKind); }}>{confirmKind === "video" ? <Video size={14} /> : <Phone size={14} />} Start call</button></div>
    </div>}
    {error && <div role="status" style={{ position: "fixed", zIndex: 10020, left: 12, right: 12, bottom: 90, maxWidth: 420, margin: "0 auto", padding: "10px 12px", borderRadius: 10, background: "var(--theme-toast-danger-bg)", color: "var(--theme-toast-error-text)", fontSize: ".78rem", border: "1px solid var(--theme-toast-error-border)" }}>{error}<button type="button" onClick={() => setError("")} style={{ float: "right", background: "none", border: 0, color: "inherit" }}><X size={14}/></button></div>}
    {incoming && !active && <div className="halls-call-backdrop" role="dialog" aria-modal="true" aria-label="Incoming Hall call">
      <div className="halls-call-card">
        <div className="halls-call-avatar">{(incoming.caller?.name || incoming.caller?.username || hallName || "G").slice(0, 1).toUpperCase()}</div>
        <span className="halls-call-eyebrow">INCOMING HALL {incoming.kind.toUpperCase()} CALL</span>
        <h2>{incoming.caller?.name || incoming.caller?.username || "A Hall member"}</h2>
        <p>{hallName}</p>
        <p className="halls-call-ring-time">Hall call ringing…</p>
        <div className="halls-call-actions">
          <button className="halls-call-decline" type="button" onClick={() => { socket?.emit("group-call:dismiss", { callId: incoming.callId }); setIncoming(null); }} aria-label="Dismiss Hall call"><PhoneOff /></button>
          <button className="halls-call-accept" type="button" disabled={busy} onClick={() => { setIncoming(null); setError(""); setBusy(true); void joinCall(incoming.callId, incoming.kind).catch(e => { resetCall(true); setError(e instanceof Error ? e.message : "Unable to join call."); }).finally(() => setBusy(false)); }} aria-label="Join Hall call"><Phone /></button>
        </div>
      </div>
    </div>}
    {active && <div role="dialog" aria-modal="true" aria-label="Hall call" style={{ position: "fixed", zIndex: 10025, inset: 0, display: "flex", flexDirection: "column", background: "var(--theme-bg)", color: "var(--theme-text)" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", borderBottom: "1px solid var(--theme-line)" }}>
        <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hallName}</strong><span style={{ fontSize: ".75rem", color: "var(--theme-muted)" }}>{kind === "video" ? "Video" : "Audio"} call · {participants.length + 1} here</span></div>
        <button type="button" onClick={leave} aria-label="Close Hall call" style={{ border: 0, background: "transparent", color: "inherit" }}><X size={21}/></button>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, alignContent: "center" }}>
        {kind === "video" && <div style={{ position: "relative", minHeight: 150, aspectRatio: "3 / 4", overflow: "hidden", borderRadius: 15, background: "var(--theme-surface-raised)" }}><video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}/><span style={{ position: "absolute", left: 8, bottom: 8, fontSize: ".75rem", color: "var(--theme-call-video-text)", textShadow: "var(--theme-call-video-text-shadow)", background: "var(--theme-call-video-overlay)", padding: "3px 6px", borderRadius: 6 }}>You</span></div>}
        {participants.map(person => <div key={person.id} style={{ position: "relative", minHeight: kind === "video" ? 150 : 110, aspectRatio: kind === "video" ? "3 / 4" : undefined, overflow: "hidden", borderRadius: 15, background: "var(--theme-surface-raised)", display: "grid", placeItems: "center" }}>
          {streams[person.id] && kind === "video" ? <video autoPlay playsInline muted ref={el => { if (el && el.srcObject !== streams[person.id]) { el.muted = true; el.srcObject = streams[person.id]; void el.play().catch(() => {}); } }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}/> : <div style={{ width: 50, height: 50, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--theme-avatar-gradient)", color: "var(--theme-avatar-fallback-text)", fontSize: "1.2rem", fontWeight: 800 }}>{(person.name || person.username || "P").slice(0,1).toUpperCase()}</div>}
          {streams[person.id] && <audio autoPlay ref={el => { const remote = streams[person.id]; if (el && remote) { const existing = el.srcObject as MediaStream | null; const audioTrackId = remote.getAudioTracks()[0]?.id; if (!existing || existing.getAudioTracks()[0]?.id !== audioTrackId) { el.srcObject = new MediaStream(remote.getAudioTracks()); void el.play().catch(() => {}); } } }} />}
          <span style={{ position: "absolute", left: 8, bottom: 8, fontSize: ".75rem", color: "var(--theme-call-video-text)", textShadow: "var(--theme-call-video-text-shadow)", background: "var(--theme-call-video-overlay)", padding: "3px 6px", borderRadius: 6 }}>{person.name || person.username || "Participant"}</span>
        </div>)}
        {kind === "audio" && <video ref={localVideoRef} autoPlay playsInline muted style={{ display: "none" }}/>}
      </div>
      <footer style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, padding: "14px 12px calc(env(safe-area-inset-bottom, 0px) + 18px)", borderTop: "1px solid var(--theme-line)" }}>
        <button type="button" onClick={() => { const next = !muted; setMuted(next); localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); }} aria-label={muted ? "Unmute microphone" : "Mute microphone"} style={{ width: 48, height: 48, border: 0, borderRadius: "50%", background: muted ? "var(--theme-danger-action-bg)" : "var(--theme-surface-hover)", color: muted ? "var(--theme-danger-action-text)" : "var(--theme-text)" }}>{muted ? <MicOff size={20}/> : <Mic size={20}/>}</button>
        {kind === "video" && <button type="button" onClick={() => { const next = !cameraOff; setCameraOff(next); localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; }); }} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} style={{ width: 48, height: 48, border: 0, borderRadius: "50%", background: cameraOff ? "var(--theme-danger-action-bg)" : "var(--theme-surface-hover)", color: cameraOff ? "var(--theme-danger-action-text)" : "var(--theme-text)" }}>{cameraOff ? <VideoOff size={20}/> : <Video size={20}/>}</button>}
        <button type="button" onClick={leave} aria-label="Leave Hall call" style={{ width: 58, height: 48, border: 0, borderRadius: 24, background: "var(--theme-call-end)", color: "var(--theme-primary-contrast)" }}><PhoneOff size={21}/></button>
      </footer>
    </div>}
  </>;
}
