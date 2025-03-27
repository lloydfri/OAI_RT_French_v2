import { useState } from "react";
import { CloudLightning, MessageSquare, Mic } from "react-feather";
import Button from "./Button";

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-red-600"}
        icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function ModeToggle({ isManualMode, setIsManualMode }) {
  return (
    <div className="flex items-center">
      <span className={`text-sm ${!isManualMode ? "font-bold" : "text-gray-500"}`}>VAD</span>
      <button 
        className="relative inline-flex h-6 w-11 mx-2 items-center rounded-full bg-gray-200"
        onClick={() => setIsManualMode(!isManualMode)}
      >
        <span 
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
            isManualMode ? "translate-x-6" : "translate-x-1"
          }`}
        />
        <span 
          className={`absolute inset-0 rounded-full ${
            isManualMode ? "bg-green-500" : "bg-blue-500"
          } transition-colors`}
          style={{ opacity: "0.5" }}
        />
      </button>
      <span className={`text-sm ${isManualMode ? "font-bold" : "text-gray-500"}`}>Manual</span>
    </div>
  );
}

function TalkButton({ startVoiceTransmission, stopVoiceTransmission }) {
  const [isTalking, setIsTalking] = useState(false);
  
  const handleMouseDown = (e) => {
    e.preventDefault(); // Prevent default browser handling
    if (!isTalking) {
      console.log("Talk button pressed");
      setIsTalking(true);
      startVoiceTransmission();
    }
  };
  
  const handleMouseUp = (e) => {
    e.preventDefault(); // Prevent default browser handling
    if (isTalking) {
      console.log("Talk button released");
      setIsTalking(false);
      stopVoiceTransmission();
    }
  };
  
  // Ensure we clean up if the pointer leaves the button
  const handleMouseLeave = (e) => {
    if (isTalking) {
      console.log("Talk button: pointer left while active");
      setIsTalking(false);
      stopVoiceTransmission();
    }
  };
  
  return (
    <button
      className={`bg-gray-800 text-white rounded-full p-4 flex items-center gap-1 hover:opacity-90 ${
        isTalking ? "!bg-red-600" : "bg-green-500"
      }`}
      style={{ 
        backgroundColor: isTalking ? "#dc2626" : "#22c55e",
        color: "white",
        transition: "background-color 0.1s"
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseLeave}
    >
      <Mic height={16} />
      {isTalking ? "Talking..." : "Talk"} 
    </button>
  );
}

function SessionActive({ 
  stopSession, 
  sendTextMessage, 
  startVoiceTransmission, 
  stopVoiceTransmission, 
  isManualMode,
  setIsManualMode,
  serverEvents
}) {
  const [message, setMessage] = useState("");

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex items-center justify-center w-full h-full gap-4">
      <ModeToggle isManualMode={isManualMode} setIsManualMode={setIsManualMode} />
      
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="border border-gray-200 rounded-full p-4 flex-1"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      
      <Button
        onClick={() => {
          if (message.trim()) {
            handleSendClientEvent();
          }
        }}
        icon={<MessageSquare height={16} />}
        className="bg-blue-400"
      >
        send text
      </Button>
      
      {isManualMode && (
        <TalkButton 
          startVoiceTransmission={startVoiceTransmission} 
          stopVoiceTransmission={stopVoiceTransmission} 
        />
      )}
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  startVoiceTransmission,
  stopVoiceTransmission,
  isManualMode,
  setIsManualMode,
  serverEvents,
  isSessionActive,
}) {
  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          startVoiceTransmission={startVoiceTransmission}
          stopVoiceTransmission={stopVoiceTransmission}
          isManualMode={isManualMode}
          setIsManualMode={setIsManualMode}
          serverEvents={serverEvents}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}
