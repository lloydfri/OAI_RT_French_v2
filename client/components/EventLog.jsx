import { ArrowUp, ArrowDown } from "react-feather";
import { useState, useEffect, useRef } from "react";

function Event({ event, timestamp }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isClient = event.event_id && !event.event_id.startsWith("event_");

  return (
    <div className="rounded-md bg-gray-50 p-2 w-full">
      <div 
        className="grid grid-cols-[20px_1fr] items-start gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="text-center">
          {isClient ? (
            <ArrowDown className="text-blue-400 inline-block" />
          ) : (
            <ArrowUp className="text-green-400 inline-block" />
          )}
        </div>
        <div 
          className="text-sm text-gray-500" 
          style={{ 
            wordWrap: 'break-word', 
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            hyphens: 'auto',
            width: '100%'
          }}
        >
          {isClient ? "client:" : "serveur:"}
          &nbsp;{event.type} | {timestamp}
        </div>
      </div>
      {isExpanded && (
        <div className="mt-2 text-gray-500 bg-gray-200 p-2 rounded-md">
          <pre 
            className="text-xs"
            style={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              width: '100%'
            }}
          >
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children, contentRef }) {
  return (
    <div className="flex flex-col border border-gray-200 rounded-md shadow-sm h-full overflow-hidden">
      <div className="bg-gray-100 p-2 font-semibold border-b border-gray-200">
        {title}
      </div>
      <div 
        ref={contentRef}
        className="overflow-y-auto p-2 flex-1 w-full" 
        style={{ height: 'calc(100% - 40px)' }}
      >
        <div className="w-full max-w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function EventLog({ events }) {
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef(null);
  const normalEvents = [];
  const deltaEvents = {};
  let currentTranscript = "";
  
  // Process events for display (don't update state here)
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    
    if (event.type.endsWith("delta")) {
      // Check if we have this delta type
      const deltaType = event.type;
      let newDeltaText = event.delta || '';
      
      // Fix potential spacing issues with question marks in French text
      if (deltaType === "response.audio_transcript.delta" && newDeltaText.includes(' ?')) {
        newDeltaText = newDeltaText.replace(' ?', '?');
      }
      
      // Process all delta events and accumulate them
      if (deltaEvents[deltaType]) {
        // Append delta text (since we're processing from oldest to newest)
        deltaEvents[deltaType].delta = (deltaEvents[deltaType].delta || '') + newDeltaText;
      } else {
        // First delta of this type we've seen
        deltaEvents[deltaType] = {...event};
        if (deltaType === "response.audio_transcript.delta") {
          deltaEvents[deltaType].delta = newDeltaText;
        }
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
        <Event key={`${event.event_id || event.type}-${i}-${Date.now()}`} event={event} timestamp={event.timestamp} />
      );
    } else {
      // Add non-delta events to normal events list
      normalEvents.unshift(
        <Event key={`${event.event_id || event.type}-${i}-${Date.now()}`} event={event} timestamp={event.timestamp} />
      );
    }
  }

  // Update transcript state if it changed
  if (currentTranscript !== transcript) {
    // Fix any remaining spacing issues with question marks
    const fixedTranscript = currentTranscript.replace(/ \?/g, '?');
    setTranscript(fixedTranscript);
  }
  
  // Auto-scroll transcript container to bottom when transcript changes
  useEffect(() => {
    if (!transcriptRef.current) return;
    
    // Function to scroll to bottom
    const scrollToBottom = () => {
      if (transcriptRef.current) {
        transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
      }
    };
    
    // Initial scroll
    scrollToBottom();
    
    // Set up a MutationObserver to watch for content changes
    const observer = new MutationObserver(() => {
      scrollToBottom();
    });
    
    // Start observing
    observer.observe(transcriptRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Also use a timeout as a fallback
    setTimeout(scrollToBottom, 100);
    
    return () => {
      // Clean up observer on unmount
      observer.disconnect();
    };
  }, [transcript]);
  
  // Create a list of accumulated delta events for display
  const deltaEventsDisplay = Object.entries(deltaEvents).map(([deltaType, deltaEvent]) => (
    <Event 
      key={`delta-${deltaType}`} 
      event={deltaEvent} 
      timestamp={deltaEvent.timestamp} 
    />
  ));

  return (
    <div className="h-full w-full">
      <div className="grid grid-cols-3 gap-4 h-full">
        <Panel title="Transcription" contentRef={transcriptRef}>
          <div 
            className="whitespace-pre-wrap text-gray-700 w-full"
            style={{
              scrollBehavior: "smooth"
            }}
          >
            {transcript || "En attente de transcription..."}
          </div>
        </Panel>
        
        <Panel title="Événements Normaux">
          {normalEvents.length > 0 ? 
            normalEvents : 
            <div className="text-gray-500">Pas d'événements pour le moment...</div>
          }
        </Panel>
        
        <Panel title="Événements Delta">
          {deltaEventsDisplay.length > 0 ? 
            deltaEventsDisplay : 
            <div className="text-gray-500">Pas d'événements delta pour le moment...</div>
          }
        </Panel>
      </div>
    </div>
  );
}

