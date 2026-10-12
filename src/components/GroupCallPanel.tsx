import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Users, X } from "lucide-react";

type Participant = { id: string; name?: string; username?: string; profilePicture?: string };
type IncomingGroupCall = { callId: string; groupId: string; kind: "audio" | "video"; caller: Participant; startedAt: number };
type PeerState = { pc: RTCPeerConnection; stream?: MediaStream };
type Props = { socket: Socket | null; groupId: string; groupName: string; currentUserId: string };

const rtcConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };

export default function GroupCallPanel({ socket, groupId, groupName, currentUserId }: Props) {
  const [incoming, setIncoming] = useState<IncomingGroupCall | null>(null);
  const [callId, setCallId] = useState("");
  const [kind, setKind] = useState<"audio" | "video">("audio");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const callIdRef = useRef("");
  const kindRef = useRef<"audio" | "video">("audio");
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
    const pc = new RTCPeerConnection(rtcConfig);
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: callKind === "video" ? { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 24 }, facingMode: "user" } : false });
    localStreamRef.current = stream;
    if (localVideoRef.current) { localVideoRef.current.srcObject = stream; void localVideoRef.current.play().catch(() => {}); }
  }, []);

  const joinCall = useCallback(async (id: string, callKind: "audio" | "video") => {
    if (!socketRef.current) throw new Error("Reconnect to the group before calling.");
    await startLocalMedia(callKind);
    const result = await new Promise<{ ok?: boolean; message?: string; participants?: Participant[] }>((resolve, reject) => {
      socketRef.current!.timeout(10000).emit("group-call:join", { callId: id }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; participants?: Participant[] }) => {
        if (timeoutError) return reject(new Error("The group call timed out. Try again."));
        resolve(response);
      });
    });
    if (!result.ok) throw new Error(result.message || "Unable to join this group call.");
    callIdRef.current = id;
    kindRef.current = callKind;
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
        socket.timeout(10000).emit("group-call:start", { groupId, kind: callKind }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; callId?: string }) => {
          if (timeoutError) return reject(new Error("Unable to start the group call. Try again."));
          resolve(response);
        });
      });
      if (!result.ok || !result.callId) throw new Error(result.message || "Unable to start the group call.");
      callIdRef.current = result.callId;
      kindRef.current = callKind;
      setCallId(result.callId); setKind(callKind);
      const joinResult = await new Promise<{ ok?: boolean; message?: string; participants?: Participant[] }>((resolve, reject) => {
        socket.timeout(10000).emit("group-call:join", { callId: result.callId }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; participants?: Participant[] }) => {
          if (timeoutError) return reject(new Error("The group call timed out. Try again."));
          resolve(response);
        });
      });
      if (!joinResult.ok) throw new Error(joinResult.message || "Unable to enter the group call.");
      setParticipants(joinResult.participants || []);
    } catch (e) {
      const id = callIdRef.current;
      if (id) socket.emit("group-call:leave", { callId: id });
      callIdRef.current = ""; setCallId("");
      closePeers(); stopLocal();
      setError(e instanceof Error ? e.message : "Unable to start the group call.");
    } finally { setBusy(false); }
  }, [socket, groupId, busy, startLocalMedia, closePeers, stopLocal]);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = (event: IncomingGroupCall) => {
      if (event.groupId !== groupId || event.caller?.id === currentUserId || callIdRef.current) return;
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
      if (event.groupId !== groupId || (callIdRef.current && event.callId !== callIdRef.current)) return;
      resetCall(false);
      setError("The group call has ended.");
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
  }, [socket, groupId, currentUserId, ensurePeer, resetCall]);

  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      void localVideoRef.current.play().catch(() => {});
    }
  }, [callId, kind]);

  const leave = () => resetCall(true);
  const active = Boolean(callId);
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button type="button" title="Start group audio call" aria-label="Start group audio call" disabled={!socket || busy || active} onClick={() => void startCall("audio")} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: "1px solid rgba(255,210,219,.13)", borderRadius: 10, background: "rgba(255,255,255,.035)", color: "#ffe9ed", padding: 0 }}><Phone size={17}/></button>
      <button type="button" title="Start group video call" aria-label="Start group video call" disabled={!socket || busy || active} onClick={() => void startCall("video")} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: "1px solid rgba(255,210,219,.13)", borderRadius: 10, background: "rgba(255,255,255,.035)", color: "#ffe9ed", padding: 0 }}><Video size={17}/></button>
    </div>
    {error && <div role="status" style={{ position: "fixed", zIndex: 10020, left: 12, right: 12, bottom: 90, maxWidth: 420, margin: "0 auto", padding: "10px 12px", borderRadius: 10, background: "#32151d", color: "#ffe9ed", fontSize: ".78rem", border: "1px solid rgba(255,150,170,.25)" }}>{error}<button type="button" onClick={() => setError("")} style={{ float: "right", background: "none", border: 0, color: "inherit" }}><X size={14}/></button></div>}
    {incoming && !active && <div role="dialog" aria-modal="true" aria-label="Incoming group call" style={{ position: "fixed", zIndex: 10030, inset: 0, display: "grid", placeItems: "center", padding: 18, background: "rgba(5,3,5,.78)", backdropFilter: "blur(12px)" }}>
      <div style={{ width: "100%", maxWidth: 340, padding: 22, textAlign: "center", borderRadius: 20, border: "1px solid rgba(255,210,219,.16)", background: "#1d0b11", color: "#fff0f3" }}>
        <div style={{ width: 62, height: 62, margin: "0 auto 12px", display: "grid", placeItems: "center", borderRadius: "50%", background: "rgba(190,35,58,.2)" }}>{incoming.kind === "video" ? <Video size={25}/> : <Phone size={25}/>}</div>
        <strong style={{ display: "block", fontSize: "1rem" }}>{incoming.caller?.name || "A group member"}</strong>
        <p style={{ margin: "7px 0 18px", color: "rgba(246,220,225,.7)", fontSize: ".8rem" }}>Incoming {incoming.kind} call in {groupName}</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button type="button" disabled={busy} onClick={() => { setIncoming(null); setError(""); setBusy(true); void joinCall(incoming.callId, incoming.kind).catch(e => { setError(e instanceof Error ? e.message : "Unable to join call."); stopLocal(); }).finally(() => setBusy(false)); }} style={{ flex: 1, minHeight: 42, border: 0, borderRadius: 11, background: "#198754", color: "white", fontWeight: 750 }}><Phone size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>Join</button>
          <button type="button" onClick={() => setIncoming(null)} style={{ flex: 1, minHeight: 42, border: 0, borderRadius: 11, background: "#9d293c", color: "white", fontWeight: 750 }}><PhoneOff size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>Dismiss</button>
        </div>
      </div>
    </div>}
    {active && <div role="dialog" aria-modal="true" aria-label="Group call" style={{ position: "fixed", zIndex: 10025, inset: 0, display: "flex", flexDirection: "column", background: "#10080c", color: "#fff0f3" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupName}</strong><span style={{ fontSize: ".75rem", color: "rgba(255,255,255,.62)" }}>{kind === "video" ? "Video" : "Audio"} call · {participants.length + 1} here</span></div>
        <button type="button" onClick={leave} aria-label="Close group call" style={{ border: 0, background: "transparent", color: "inherit" }}><X size={21}/></button>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(135px,1fr))", gap: 10, alignContent: "center" }}>
        {kind === "video" && <div style={{ position: "relative", minHeight: 150, aspectRatio: "3 / 4", overflow: "hidden", borderRadius: 15, background: "#25141b" }}><video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}/><span style={{ position: "absolute", left: 8, bottom: 8, fontSize: ".75rem", textShadow: "0 1px 3px #000" }}>You</span></div>}
        {participants.map(person => <div key={person.id} style={{ position: "relative", minHeight: kind === "video" ? 150 : 110, aspectRatio: kind === "video" ? "3 / 4" : undefined, overflow: "hidden", borderRadius: 15, background: "#25141b", display: "grid", placeItems: "center" }}>
          {streams[person.id] && kind === "video" ? <video autoPlay playsInline ref={el => { if (el && el.srcObject !== streams[person.id]) { el.srcObject = streams[person.id]; void el.play().catch(() => {}); } }} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}/> : <div style={{ width: 50, height: 50, display: "grid", placeItems: "center", borderRadius: "50%", background: "#67283a", fontSize: "1.2rem", fontWeight: 800 }}>{(person.name || person.username || "P").slice(0,1).toUpperCase()}</div>}
          {streams[person.id] && <video autoPlay playsInline ref={el => { if (el && el.srcObject !== streams[person.id]) { el.srcObject = streams[person.id]; void el.play().catch(() => {}); } }} style={kind === "video" ? { display: "none" } : { position: "absolute", width: 1, height: 1, opacity: 0 }}/> }
          <span style={{ position: "absolute", left: 8, bottom: 8, fontSize: ".75rem", textShadow: "0 1px 3px #000" }}>{person.name || person.username || "Participant"}</span>
        </div>)}
        {kind === "audio" && <video ref={localVideoRef} autoPlay playsInline muted style={{ display: "none" }}/>}
      </div>
      <footer style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, padding: "14px 12px calc(env(safe-area-inset-bottom, 0px) + 18px)", borderTop: "1px solid rgba(255,255,255,.1)" }}>
        <button type="button" onClick={() => { const next = !muted; setMuted(next); localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !next; }); }} aria-label={muted ? "Unmute microphone" : "Mute microphone"} style={{ width: 48, height: 48, border: 0, borderRadius: "50%", background: muted ? "#fff0f3" : "#33212a", color: muted ? "#231018" : "#fff0f3" }}>{muted ? <MicOff size={20}/> : <Mic size={20}/>}</button>
        {kind === "video" && <button type="button" onClick={() => { const next = !cameraOff; setCameraOff(next); localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !next; }); }} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} style={{ width: 48, height: 48, border: 0, borderRadius: "50%", background: cameraOff ? "#fff0f3" : "#33212a", color: cameraOff ? "#231018" : "#fff0f3" }}>{cameraOff ? <VideoOff size={20}/> : <Video size={20}/>}</button>}
        <button type="button" onClick={leave} aria-label="Leave group call" style={{ width: 58, height: 48, border: 0, borderRadius: 24, background: "#c92e48", color: "white" }}><PhoneOff size={21}/></button>
      </footer>
    </div>}
  </>;
}
