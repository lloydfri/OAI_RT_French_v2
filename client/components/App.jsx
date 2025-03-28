import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import ArticlePanel from "./ArticlePanel";

// Combined tool registration with both tools
const combinedToolRegistration = {
  type: "session.update",
  session: {
    tools: [
      {
        type: "function",
        name: "display_article",
        description: "Call this function when a user gives you a URL, implicitly asking you to have a conversation about the article on that URL.",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            url: {
              type: "string",
              description: "URL of the article to fetch and display.",
            },
          },
          required: ["url"],
        },
      },
      {
        type: "function",
        name: "display_color_palette",
        description: "Appelez cette fonction lorsqu'un utilisateur demande une palette de couleurs. Vous DEVEZ générer des valeurs hexadécimales pour les couleurs (comme #FF0000).",
        parameters: {
          type: "object",
          strict: true,
          properties: {
            theme: {
              type: "string",
              description: "Description du thème pour la palette de couleurs.",
            },
            colors: {
              type: "array",
              description: "Tableau de cinq codes hexadécimaux de couleurs basés sur le thème. Exemple: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF']",
              items: {
                type: "string",
                description: "Code hexadécimal de couleur (ex: #FF0000 pour rouge)",
              },
              minItems: 5,
              maxItems: 5
            },
          },
          required: ["theme", "colors"],
        },
      }
    ],
    tool_choice: "auto",
  },
};

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const audioTrack = useRef(null);
  const mediaStream = useRef(null);
  const hasRegisteredTools = useRef(false);
  const audioSender = useRef(null);
  const [isManualMode, setIsManualMode] = useState(false);

  // Handle mode changes
  useEffect(() => {
    if (!isSessionActive || !peerConnection.current || !audioTrack.current) return;
    
    if (isManualMode) {
      // Switching to Manual mode - disable the track but DON'T remove it
      console.log("Switching to Manual mode: Disabling audio track");
      if (audioTrack.current) {
        audioTrack.current.enabled = false;
      }
    } else {
      // Switching to VAD mode - enable the track
      console.log("Switching to VAD mode: Enabling audio track");
      if (audioTrack.current) {
        audioTrack.current.enabled = true;
      }
    }
  }, [isManualMode, isSessionActive]);

  async function startSession() {
    // Reset the tool registration flag
    hasRegisteredTools.current = false;
    
    // Get a session token for OpenAI Realtime API
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    // Check if client_secret is available and handle different formats
    const EPHEMERAL_KEY = data.client_secret?.value || data.client_secret || '';
    
    if (!EPHEMERAL_KEY) {
      console.error("Failed to get valid token:", data);
      return;
    }

    // Create a peer connection
    const pc = new RTCPeerConnection();

    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Get microphone stream but don't add track yet for manual mode
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStream.current = ms;
      audioTrack.current = ms.getTracks()[0];
      
      // Always add the track, but disable it in Manual mode
      audioSender.current = pc.addTrack(audioTrack.current, ms);
      console.log("Initial setup: Added audio track");
      
      // If in Manual mode, disable the track initially
      if (isManualMode) {
        audioTrack.current.enabled = false;
        console.log("Initial setup: Disabled track for Manual mode");
      } else {
        audioTrack.current.enabled = true;
        console.log("Initial setup: Enabled track for VAD mode");
      }
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
    
    // Set up event listener for when the channel opens
    dc.addEventListener("open", () => {
      // Wait a short time before registering tools
      if (!hasRegisteredTools.current) {
        setTimeout(() => {
          console.log("Registering all tools from App.jsx");
          // Send unified tool registration with both tools
          dc.send(JSON.stringify(combinedToolRegistration));
          hasRegisteredTools.current = true;
        }, 1000);
      }
    });
  }

  // Start voice transmission (for manual mode)
  function startVoiceTransmission() {
    if (!isSessionActive || !audioTrack.current) {
      console.error("Cannot start voice transmission: missing prerequisites");
      return;
    }
    
    try {
      console.log("Starting voice transmission: Enabling track");
      // Just enable the track instead of adding/removing
      audioTrack.current.enabled = true;
      
      // Log transmission start event
      const transmissionStartEvent = {
        type: "client.voice_transmission.start",
        timestamp: new Date().toLocaleTimeString(),
        event_id: crypto.randomUUID()
      };
      setEvents(prev => [transmissionStartEvent, ...prev]);
    } catch (err) {
      console.error("Error starting voice transmission:", err);
    }
  }

  // Stop voice transmission (for manual mode)
  function stopVoiceTransmission() {
    if (!isSessionActive || !audioTrack.current) {
      console.error("Cannot stop voice transmission: missing prerequisites");
      return;
    }
    
    try {
      console.log("Stopping voice transmission: Disabling track");
      // Just disable the track instead of removing it
      audioTrack.current.enabled = false;
      
      // Log transmission stop event
      const transmissionStopEvent = {
        type: "client.voice_transmission.stop",
        timestamp: new Date().toLocaleTimeString(),
        event_id: crypto.randomUUID()
      };
      setEvents(prev => [transmissionStopEvent, ...prev]);
    } catch (err) {
      console.error("Error stopping voice transmission:", err);
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      
      peerConnection.current.close();
    }

    if (audioTrack.current) {
      audioTrack.current.stop();
      audioTrack.current = null;
    }
    
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }

    audioSender.current = null;
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // No logging to improve performance

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    // No logging to improve performance
    
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        // No logging to improve performance
        
        setEvents((prev) => [event, ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        // Suppress all logging
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>console temps réel</h1>
        </div>
      </nav>
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[760px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              startVoiceTransmission={startVoiceTransmission}
              stopVoiceTransmission={stopVoiceTransmission}
              isManualMode={isManualMode}
              setIsManualMode={setIsManualMode}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[380px] right-[380px] bottom-0 p-4 pt-0 overflow-y-auto">
          <ArticlePanel
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
          />
        </section>
        <section className="absolute top-0 w-[380px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          <ToolPanel
            sendClientEvent={sendClientEvent}
            sendTextMessage={sendTextMessage}
            events={events}
            isSessionActive={isSessionActive}
          />
        </section>
      </main>
    </>
  );
}
