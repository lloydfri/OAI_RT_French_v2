import { ArrowUp, ArrowDown } from "react-feather";
import { useState, useRef } from "react";

function Event({ event, timestamp }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isClient = event.event_id && !event.event_id.startsWith("event_");

  return (
    <div className="flex flex-col gap-2 p-2 rounded-md bg-gray-50">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isClient ? (
          <ArrowDown className="text-blue-400" />
        ) : (
          <ArrowUp className="text-green-400" />
        )}
        <div className="text-sm text-gray-500">
          {isClient ? "client:" : "server:"}
          &nbsp;{event.type} | {timestamp}
        </div>
      </div>
      <div
        className={`text-gray-500 bg-gray-200 p-2 rounded-md overflow-x-auto ${
          isExpanded ? "block" : "hidden"
        }`}
      >
        <pre className="text-xs">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="flex flex-col border border-gray-200 rounded-md shadow-sm h-80 flex-1">
      <div className="bg-gray-100 p-2 font-semibold border-b border-gray-200">
        {title}
      </div>
      <div className="overflow-y-auto p-2 flex-1">
        {children}
      </div>
    </div>
  );
}

export default function EventLog({ events }) {
  const [transcript, setTranscript] = useState("");
  const normalEvents = [];
  const deltaEvents = {};
  let currentTranscript = "";
  
  // Process events for display (don't update state here)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    
    if (event.type.endsWith("delta")) {
      // Check if we have this delta type
      const deltaType = event.type;
      const newDeltaText = event.delta || '';
      
      // Process all delta events and accumulate them
      if (deltaEvents[deltaType]) {
        // Append delta text (since we're processing from oldest to newest)
        deltaEvents[deltaType].delta = (deltaEvents[deltaType].delta || '') + newDeltaText;
      } else {
        // First delta of this type we've seen
        deltaEvents[deltaType] = {...event};
      }

      // Add to transcript if it's an audio transcript delta
      if (deltaType === "response.audio_transcript.delta") {
        currentTranscript = currentTranscript + newDeltaText;
      }
    } else if (event.type === "response.audio_transcript.done") {
      // Add newlines to separate transcripts
      currentTranscript = currentTranscript + "\n\n";
      // Add the done event to normal events list
      normalEvents.unshift(
        <Event key={event.event_id || `${event.type}-${Date.now()}`} event={event} timestamp={event.timestamp} />
      );
    } else {
      // Add non-delta events to normal events list
      normalEvents.unshift(
        <Event key={event.event_id || `${event.type}-${Date.now()}`} event={event} timestamp={event.timestamp} />
      );
    }
  }

  // Update transcript state if it changed
  if (currentTranscript !== transcript) {
    setTranscript(currentTranscript);
  }
  
  // Create a list of accumulated delta events for display
  const deltaEventsDisplay = Object.entries(deltaEvents).map(([deltaType, deltaEvent]) => (
    <Event 
      key={`delta-${deltaType}`} 
      event={deltaEvent} 
      timestamp={deltaEvent.timestamp} 
    />
  ));

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-3 gap-4 h-[500px]">
        <Panel title="Normal Events">
          {normalEvents.length > 0 ? 
            normalEvents : 
            <div className="text-gray-500">No events yet...</div>
          }
        </Panel>
        
        <Panel title="Transcript">
          <div className="whitespace-pre-wrap text-gray-700">
            {transcript || "Awaiting transcript..."}
          </div>
        </Panel>
        
        <Panel title="Delta Events">
          {deltaEventsDisplay.length > 0 ? 
            deltaEventsDisplay : 
            <div className="text-gray-500">No delta events yet...</div>
          }
        </Panel>
      </div>
    </div>
  );
}
